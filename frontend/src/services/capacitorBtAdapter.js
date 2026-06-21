/* ═══════════════════════════════════════════════════════════════════════════
   capacitorBtAdapter.js
   ───────────────────────────────────────────────────────────────────────────
   Adapter de impresión Bluetooth para el entorno Capacitor (Android nativo).

   Por qué existe este archivo aparte:
   En web usamos navigator.bluetooth (Web Bluetooth API), que no existe dentro
   del WebView de Capacitor. Ahí usamos en su lugar el plugin nativo
   @capacitor-community/bluetooth-le, que habla directo con el stack BLE de
   Android — esto es justamente lo que resuelve, de raíz, el problema original
   de "la impresora se desvincula al cerrar la app": en Android nativo el
   emparejamiento vive a nivel sistema operativo, no a nivel "permiso de un
   origin en el navegador".

   Diferencia clave de modelo frente a Web Bluetooth:
   - Web Bluetooth te da un objeto `device` con `.gatt.connect()`, `.gatt
     .disconnect()`, etc. — un objeto vivo que conservas en memoria.
   - bluetooth-le identifica todo por un `deviceId` (string). No hay objeto
     "vivo" que guardar: para reconectar, vuelves a llamar connect(deviceId).
     Por eso este adapter expone una interfaz por deviceId en vez de por
     objeto device, y es lo que cambia en printerService.js al integrarlo.

   Este archivo NO modifica ticketBuilder.js ni la lógica de armado del
   ticket — solo el "transporte" de los bytes ya generados.
   ═══════════════════════════════════════════════════════════════════════════ */

import { BleClient } from '@capacitor-community/bluetooth-le';

/* ── Mismos UUIDs de perfiles que ya usa printerService.js en web ───────────
   Los mantenemos en este archivo (no importados desde printerService.js)
   para que este adapter sea autocontenido y no dependa del entorno web.
   Si agregas un perfil nuevo, agrégalo en AMBOS archivos.
──────────────────────────────────────────────────────────────────────────── */
const PRINTER_PROFILES = [
  { service: '0000fff0-0000-1000-8000-00805f9b34fb', chr: '0000fff2-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff80-0000-1000-8000-00805f9b34fb', chr: '0000ff82-0000-1000-8000-00805f9b34fb' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
];

let _initialized = false;
const _profileCache = new Map(); // deviceId -> { service, chr }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ensureInitialized() {
  if (_initialized) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  _initialized = true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   requestDevice
   Abre el selector nativo de Android para elegir una impresora BLE cercana.
   Equivalente a navigator.bluetooth.requestDevice() en web.

   @returns {Promise<{deviceId: string, name: string}>}
   ═══════════════════════════════════════════════════════════════════════════ */
export async function requestDevice() {
  await ensureInitialized();

  const device = await BleClient.requestDevice({
    services: PRINTER_PROFILES.map(p => p.service),
    optionalServices: PRINTER_PROFILES.map(p => p.service),
    // allowDuplicates: false (default) — un resultado por dispositivo
  });

  return { deviceId: device.deviceId, name: device.name ?? 'Impresora' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   connect
   Conecta (o reconecta) al dispositivo por su deviceId.
   Idempotente: si ya está conectado, bluetooth-le lo maneja internamente,
   pero igual envolvemos con manejo de error explícito para dar mensajes
   claros al usuario.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function connect(deviceId) {
  await ensureInitialized();

  try {
    await BleClient.connect(deviceId, () => {
      // Callback de desconexión inesperada — solo lo logueamos, la
      // reconexión la dispara printerService.js a través de su propio
      // watcher (reconnectBTPrinters), igual que en web.
      console.info(`[CapacitorBT] Dispositivo ${deviceId} se desconectó`);
    });
  } catch (e) {
    throw new Error(
      'No se pudo conectar a la impresora. Verifica que esté encendida y en rango.'
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   isConnected
   bluetooth-le no expone un "estado" directo simple, así que lo inferimos
   intentando obtener servicios — si falla, no hay conexión activa.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function isConnected(deviceId) {
  try {
    await BleClient.getServices(deviceId);
    return true;
  } catch {
    return false;
  }
}

/* ── Encuentra qué perfil (service/characteristic) responde para este device ─
   Mismo patrón de "probar perfiles conocidos" que ya tienes en web, pero
   usando getServices() de bluetooth-le para enumerar lo que el dispositivo
   realmente expone.
──────────────────────────────────────────────────────────────────────────── */
async function findWritableProfile(deviceId) {
  const cached = _profileCache.get(deviceId);
  if (cached) {
    try {
      // Validamos que el perfil cacheado siga respondiendo en este device
      const services = await BleClient.getServices(deviceId);
      const match = services.find(s => s.uuid.toLowerCase() === cached.service.toLowerCase());
      if (match) return cached;
    } catch { /* cae al loop de abajo */ }
    _profileCache.delete(deviceId);
  }

  const services = await BleClient.getServices(deviceId);

  for (const profile of PRINTER_PROFILES) {
    const svc = services.find(
      s => s.uuid.toLowerCase() === profile.service.toLowerCase()
    );
    if (!svc) continue;

    // Verifica que la característica exista y soporte escritura
    const chr = svc.characteristics?.find(
      c => c.uuid.toLowerCase() === profile.chr.toLowerCase()
    );

    const writable = chr?.properties?.write || chr?.properties?.writeWithoutResponse;

    if (chr && writable) {
      const found = { service: profile.service, chr: profile.chr };
      _profileCache.set(deviceId, found);
      console.info(`[CapacitorBT] Perfil encontrado → service: ${profile.service}`);
      return found;
    }

    // Fallback: cualquier característica escribible dentro de ese servicio
    const anyWritable = svc.characteristics?.find(
      c => c.properties?.write || c.properties?.writeWithoutResponse
    );
    if (anyWritable) {
      const found = { service: profile.service, chr: anyWritable.uuid };
      _profileCache.set(deviceId, found);
      console.info(`[CapacitorBT] Perfil (fallback) encontrado → service: ${profile.service} chr: ${anyWritable.uuid}`);
      return found;
    }
  }

  throw new Error(
    'No se encontró servicio de impresión compatible. ' +
    'Verifica que la impresora esté encendida y en rango.'
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   writeBytes
   Envía el Uint8Array completo en chunks, igual que writeChunked() en web.
   bluetooth-le trabaja con DataView, así que convertimos cada chunk.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function writeBytes(deviceId, data) {
  await ensureInitialized();

  const connected = await isConnected(deviceId);
  if (!connected) {
    await connect(deviceId);
    await sleep(300);
  }

  const profile = await findWritableProfile(deviceId);

  const CHUNK_SIZE = 20;
  const CHUNK_DELAY = 120;

  console.info(`[CapacitorBT] Enviando ${data.length} bytes en chunks de ${CHUNK_SIZE}`);

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    try {
      // writeWithoutResponse es más rápido y es lo que la mayoría de
      // impresoras térmicas BLE esperan; si el perfil exige respuesta,
      // bluetooth-le internamente usa el modo correcto según characteristic.
      await BleClient.writeWithoutResponse(deviceId, profile.service, profile.chr, view);
    } catch (e) {
      console.warn(`[CapacitorBT] writeWithoutResponse falló en offset ${offset}, reintentando con write():`, e.message);
      try {
        await BleClient.write(deviceId, profile.service, profile.chr, view);
      } catch (e2) {
        throw new Error(`Error al enviar datos en offset ${offset}/${data.length}: ${e2.message}`);
      }
    }

    if (offset + CHUNK_SIZE < data.length) {
      await sleep(CHUNK_DELAY);
    }
  }

  console.info('[CapacitorBT] Envío completo');
}

/* ═══════════════════════════════════════════════════════════════════════════
   disconnect
   ═══════════════════════════════════════════════════════════════════════════ */
export async function disconnect(deviceId) {
  try {
    await BleClient.disconnect(deviceId);
  } catch { /* noop — puede que ya estuviera desconectado */ }
  _profileCache.delete(deviceId);
}

/* ═══════════════════════════════════════════════════════════════════════════
   getKnownDevices
   bluetooth-le no tiene un equivalente directo a navigator.bluetooth
   .getDevices() (dispositivos previamente autorizados). En Android, el
   emparejamiento a nivel sistema es lo que persiste — por eso este adapter
   no necesita "recordar" devices entre sesiones del mismo modo que web:
   el deviceId que el usuario vinculó una vez sigue siendo válido mientras
   el teléfono tenga el dispositivo emparejado a nivel OS.

   Esta función existe como punto de extensión por si más adelante quieres
   listar dispositivos ya emparejados a nivel sistema (Android permite
   consultarlo vía BleClient en algunas versiones del plugin). Por ahora
   retorna vacío — reconnectBTPrinters() en printerService.js simplemente
   reintenta connect(deviceId) directo con la dirección guardada en
   localStorage, lo cual ya es suficiente.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getKnownDevices() {
  return [];
}