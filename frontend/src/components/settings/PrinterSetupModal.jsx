import { useState, useEffect } from 'react';
import { cacheBtDevice, scanForPrinter, sendTestTicket, getWindowsPrinters } from '../../services/printerService';
import { isCapacitor, isElectron } from '../../services/runtimeEnv';
import { buildTestTicket } from '../../services/ticketBuilder';

/* ═══════════════════════════════════════════════════════════════════════════
   Recuperar referencia BT guardada sin pedir al usuario que reseleccione
   ELECTRON: no aplica — no hay BLE.
   CAPACITOR: el emparejamiento vive a nivel sistema Android.
   WEB: busca en navigator.bluetooth.getDevices().
═══════════════════════════════════════════════════════════════════════════ */
async function getStoredBtDevice(address) {
  if (isElectron() || isCapacitor()) {
    return address ? { id: address, name: null, __stub: true } : null;
  }
  if (!navigator.bluetooth?.getDevices) return null;
  const devices = await navigator.bluetooth.getDevices();
  return devices.find(d => d.id === address || d.name === address) ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PrinterSetupModal
   Props:
     existingDevice  – objeto del dispositivo si se está editando, null si es nuevo
     onSave(device)  – callback con el objeto listo para guardar
     onClose()       – callback para cerrar sin guardar
═══════════════════════════════════════════════════════════════════════════ */
export default function PrinterSetupModal({ existingDevice, onSave, onClose }) {

  const [step, setStep] = useState(existingDevice ? 2 : 1);
  const [connectionType, setConnectionType] = useState(existingDevice?.connectionType ?? '');
  const [printerName, setPrinterName] = useState(existingDevice?.name ?? 'Impresora de tickets');
  const [address, setAddress] = useState(existingDevice?.address ?? '');

  /* Configuraciones */
  const [autoPrint, setAutoPrint]     = useState(existingDevice?.config?.autoPrint ?? false);
  const [openDrawer, setOpenDrawer]   = useState(existingDevice?.config?.openDrawer ?? false);
  const [ticketWidth, setTicketWidth] = useState(existingDevice?.config?.ticketWidth ?? '58');

  /* Bluetooth (web + capacitor) */
  const [btDevice, setBtDevice]   = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [btError, setBtError]     = useState('');
  const [restoring, setRestoring] = useState(false);

  /* Impresoras de Windows (solo Electron) */
  const [winPrinters, setWinPrinters]         = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  /* Prueba de impresión */
  const [testStatus, setTestStatus] = useState('idle');
  const [testError, setTestError]   = useState('');

  /* ── En Electron: cargar impresoras del sistema al abrir ─────────────── */
  useEffect(() => {
    if (!isElectron()) return;
    setLoadingPrinters(true);
    getWindowsPrinters()
      .then(list => setWinPrinters(list))
      .catch(() => setWinPrinters([]))
      .finally(() => setLoadingPrinters(false));
  }, []);

  /* ── Al abrir en modo edición: recuperar referencia BT ──────────────── */
  useEffect(() => {
    if (!existingDevice || existingDevice.connectionType !== 'bluetooth') return;
    if (!existingDevice.address) return;

    setRestoring(true);
    getStoredBtDevice(existingDevice.address)
      .then(found => {
        if (found) {
          setBtDevice({ id: found.id, name: found.name, raw: found.__stub ? null : found });
        }
      })
      .catch(() => { /* el usuario tendrá que re-vincular */ })
      .finally(() => setRestoring(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Seleccionar tipo de conexión ── */
  const handleSelectType = (type) => {
    setConnectionType(type);
    setStep(2);
  };

  /* ── Escaneo BT (web + capacitor) ── */
  const handleBluetoothScan = async () => {
    setBtError('');
    setScanning(true);
    try {
      const found = await scanForPrinter();
      setBtDevice(found);
      setAddress(found.id ?? '');
      if (printerName === 'Impresora de tickets' && found.name) {
        setPrinterName(found.name);
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') setBtError('Error: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  /* ── Seleccionar impresora de Windows (Electron) ── */
  const handleSelectWinPrinter = (name) => {
    setAddress(name);
    if (printerName === 'Impresora de tickets') setPrinterName(name);
  };

  /* ── Prueba de impresión ── */
  const handleTestPrint = async () => {
    setTestStatus('printing');
    setTestError('');
    try {
      const ticket = buildTestTicket(printerName, ticketWidth);

      if (isElectron()) {
        // En Electron: mandamos directo al adapter por IPC
        if (!address) throw new Error('Selecciona una impresora primero.');
        await sendTestTicket(address, null, ticket);

      } else if (connectionType === 'bluetooth') {
        if (!btDevice) throw new Error('No hay dispositivo Bluetooth vinculado.');
        await sendTestTicket(btDevice.id, btDevice.raw, ticket);

      } else {
        // Windows en web (ventana de impresión del sistema)
        const win = window.open('', '_blank', 'width=300,height=400');
        if (!win) throw new Error('El navegador bloqueó la ventana emergente.');
        win.document.write(`
          <html><head>
            <style>
              @page { margin: 0; size: ${ticketWidth}mm auto; }
              body { font-family: monospace; font-size: 12px;
                     width: ${ticketWidth}mm; padding: 4mm; }
              h2 { text-align: center; font-size: 16px; }
              hr { border-top: 1px dashed #000; }
            </style>
          </head><body>
            <h2>Hola Mundo</h2>
            <hr/>
            <p>Dispositivo : ${printerName}</p>
            <p>Ancho papel : ${ticketWidth} mm</p>
            <p>Prueba de impresion</p>
          </body></html>`);
        win.document.close();
        win.focus();
        win.print();
        win.close();
      }
      setTestStatus('ok');
    } catch (err) {
      setTestStatus('error');
      setTestError(err.message);
    }
  };

  /* ── Guardar ── */
  const handleSave = () => {
    const saved = {
      id: existingDevice?.id ?? `device_${Date.now()}`,
      type: 'printer',
      model: '5890Z-l',
      name: printerName.trim() || 'Impresora de tickets',
      connectionType: isElectron() ? 'windows' : connectionType,
      address,
      config: { autoPrint, openDrawer, ticketWidth },
    };

    if (!isElectron() && connectionType === 'bluetooth' && btDevice?.raw) {
      cacheBtDevice(saved.address, btDevice.raw);
    }

    onSave(saved);
  };

  const canSave = printerName.trim().length > 0 && address.trim().length > 0;

  const canTest = testStatus !== 'printing' && (
    isElectron()
      ? address.trim().length > 0
      : (connectionType === 'bluetooth' && btDevice !== null) ||
        (connectionType === 'windows' && address.trim().length > 0)
  );

  /* ══════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-surface-bright w-full md:w-[440px] md:rounded-2xl rounded-t-2xl
                border border-outline-variant shadow-xl flex flex-col max-h-[90dvh] overflow-hidden
                mb-[76px] md:mb-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
          {step === 2 && !isElectron() && (
            <button
              onClick={() => { if (!existingDevice) setStep(1); }}
              disabled={!!existingDevice}
              className="p-1 -ml-1 rounded-lg hover:bg-surface-container transition-colors
                         disabled:opacity-0 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_back</span>
            </button>
          )}
          <span className="material-symbols-outlined text-secondary text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}>
            receipt_long
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-on-surface text-[15px] leading-tight">
              {isElectron()
                ? (existingDevice ? 'Editar impresora' : 'Agregar impresora de tickets')
                : step === 1 ? 'Agregar impresora de tickets'
                : existingDevice ? 'Editar impresora' : 'Configurar impresora'}
            </h3>
            {(step === 2 || isElectron()) && (
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Modelo: POS 5890Z-l · {isElectron() || connectionType === 'windows' ? 'Cola de impresión Windows' : 'Bluetooth'}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto custom-scrollbar flex-1 px-5 py-4">

          {/* ── ELECTRON: siempre va directo al selector de impresoras ── */}
          {isElectron() ? (
            <div className="flex flex-col gap-5">

              <FormField label="Nombre del dispositivo">
                <input type="text" value={printerName}
                  onChange={e => setPrinterName(e.target.value)}
                  placeholder="Impresora de tickets"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg
                             px-3 py-2 text-[13px] text-on-surface placeholder:text-on-surface-variant/50
                             focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary" />
              </FormField>

              {/* Selector de impresoras del sistema */}
              <FormField label="Impresora de Windows"
                hint="Selecciona la impresora térmica instalada en este equipo.">

                {loadingPrinters ? (
                  <div className="flex items-center gap-2 py-3 text-on-surface-variant text-[13px]">
                    <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                    Cargando impresoras…
                  </div>
                ) : winPrinters.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] text-on-surface-variant/60">
                      No se encontraron impresoras instaladas. También puedes ingresar el nombre manualmente:
                    </p>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder="Termica58  ó  \\PC-CAJA\Termica58"
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg
                                 px-3 py-2 text-[13px] text-on-surface font-mono
                                 placeholder:text-on-surface-variant/40 placeholder:font-sans
                                 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {winPrinters.map(p => (
                      <button
                        key={p.name}
                        onClick={() => handleSelectWinPrinter(p.name)}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border-2 text-left transition-all
                          ${address === p.name
                            ? 'border-secondary bg-secondary/10'
                            : 'border-outline-variant hover:border-secondary/40 hover:bg-surface-container'}`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${address === p.name ? 'text-secondary' : 'text-on-surface-variant'}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                          print
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${address === p.name ? 'text-secondary' : 'text-on-surface'}`}>
                            {p.name}
                          </p>
                          {p.isDefault && (
                            <p className="text-[10px] text-on-surface-variant/60">Predeterminada</p>
                          )}
                        </div>
                        {address === p.name && (
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0"
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </FormField>

              <SectionDivider label="Configuración" />

              <FormField label="Ancho del ticket">
                <div className="flex gap-2">
                  {['58', '80'].map(w => (
                    <button key={w} onClick={() => setTicketWidth(w)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
                        ${ticketWidth === w
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-outline-variant text-on-surface-variant hover:border-secondary/40 hover:bg-surface-container'}`}>
                      <div className="flex items-end gap-0.5">
                        <div className={`rounded-sm transition-all ${ticketWidth === w ? 'bg-secondary' : 'bg-on-surface-variant/30'}`}
                          style={{ width: w === '58' ? 20 : 28, height: 32 }} />
                      </div>
                      <span className="text-[13px] font-semibold">{w} mm</span>
                    </button>
                  ))}
                </div>
              </FormField>

              <ToggleRow icon="receipt_long" title="Imprimir al vender"
                description="Imprime el ticket automáticamente al cerrar la venta"
                checked={autoPrint} onChange={setAutoPrint} />

              <ToggleRow icon="point_of_sale" title="Abrir cajón de dinero"
                description="Envía el pulso para abrir el cajón al imprimir"
                checked={openDrawer} onChange={setOpenDrawer} />

              <SectionDivider label="Prueba" />

              <button onClick={handleTestPrint} disabled={!canTest}
                className="flex items-center justify-center gap-2 w-full py-2.5
                           border border-outline-variant rounded-lg text-on-surface-variant
                           text-[13px] hover:bg-surface-container transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed">
                {testStatus === 'printing' && <><span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>Enviando…</>}
                {testStatus === 'ok'       && <><span className="material-symbols-outlined text-[16px] text-[#009668]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>¡Impreso correctamente!</>}
                {testStatus === 'error'    && <><span className="material-symbols-outlined text-[16px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>Error al imprimir</>}
                {testStatus === 'idle'     && <><span className="material-symbols-outlined text-[16px]">print</span>Imprimir "Hola Mundo"</>}
              </button>

              {testStatus === 'error' && testError && (
                <p className="text-error/80 text-[10px] -mt-3 leading-snug bg-error/5
                              border border-error/20 rounded-lg px-3 py-2">
                  {testError}
                </p>
              )}
            </div>

          ) : (
          /* ── WEB / CAPACITOR: flujo original de dos pasos ── */
          <>
            {/* Paso 1 — elegir tipo de conexión */}
            {step === 1 && (
              <div className="flex flex-col gap-2">
                <p className="text-on-surface-variant text-[12px] mb-1">¿Cómo vas a conectar la impresora?</p>
                <ConnectionOption icon="bluetooth" title="Bluetooth"
                  description="Para celular o tableta Android"
                  onClick={() => handleSelectType('bluetooth')} />
                <ConnectionOption icon="computer" title="Cola de impresión Windows"
                  description="Para PC con impresora conectada por USB"
                  onClick={() => handleSelectType('windows')} />
              </div>
            )}

            {/* Paso 2 — configurar */}
            {step === 2 && (
              <div className="flex flex-col gap-5">

                <FormField label="Nombre del dispositivo">
                  <input type="text" value={printerName}
                    onChange={e => setPrinterName(e.target.value)}
                    placeholder="Impresora de tickets"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg
                               px-3 py-2 text-[13px] text-on-surface placeholder:text-on-surface-variant/50
                               focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary" />
                </FormField>

                {/* Bluetooth */}
                {connectionType === 'bluetooth' && (
                  <FormField label="Dispositivo Bluetooth"
                    hint="Asegúrate de que la impresora esté encendida y en rango.">

                    {restoring && (
                      <div className="flex items-center gap-2 py-2.5 text-on-surface-variant text-[13px]">
                        <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                        Buscando dispositivo guardado…
                      </div>
                    )}

                    {!restoring && btDevice && (
                      <div className="flex items-center gap-3 bg-secondary/10 border border-secondary/20
                                      rounded-lg px-3 py-2.5">
                        <span className="material-symbols-outlined text-[18px] text-secondary"
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                          bluetooth_connected
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-secondary font-medium text-[13px] truncate">
                            {btDevice.name || 'Dispositivo sin nombre'}
                          </p>
                          <p className="text-secondary/70 text-[10px]">Vinculado correctamente</p>
                        </div>
                        <button onClick={() => { setBtDevice(null); setAddress(''); }}
                          className="p-1 rounded-md text-secondary/70 hover:text-error hover:bg-error/10 transition-colors">
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </div>
                    )}

                    {!restoring && !btDevice && (
                      <button onClick={handleBluetoothScan} disabled={scanning}
                        className="flex items-center justify-center gap-2 w-full py-2.5
                                   border-2 border-dashed border-secondary/40 rounded-lg
                                   text-secondary text-[13px] font-medium
                                   hover:bg-secondary/5 transition-colors disabled:opacity-60">
                        <span className={`material-symbols-outlined text-[18px] ${scanning ? 'animate-spin' : ''}`}>
                          {scanning ? 'autorenew' : 'bluetooth_searching'}
                        </span>
                        {scanning ? 'Buscando dispositivos…' : 'Buscar impresora'}
                      </button>
                    )}

                    {btError && (
                      <p className="flex items-start gap-1.5 text-error text-[11px] mt-2 leading-snug">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">error</span>
                        {btError}
                      </p>
                    )}
                  </FormField>
                )}

                {/* Windows manual (en web) */}
                {connectionType === 'windows' && (
                  <FormField label="Nombre de la impresora en Windows"
                    hint={<>Nombre exacto en <em>Configuración → Impresoras</em>. Red: <code className="bg-surface-container rounded px-1">\\PC-CAJA\Termica58</code></>}>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder="Termica58  ó  \\PC-CAJA\Termica58"
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg
                                 px-3 py-2 text-[13px] text-on-surface font-mono
                                 placeholder:text-on-surface-variant/40 placeholder:font-sans
                                 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary" />
                  </FormField>
                )}

                <SectionDivider label="Configuración" />

                <FormField label="Ancho del ticket">
                  <div className="flex gap-2">
                    {['58', '80'].map(w => (
                      <button key={w} onClick={() => setTicketWidth(w)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
                          ${ticketWidth === w
                            ? 'border-secondary bg-secondary/10 text-secondary'
                            : 'border-outline-variant text-on-surface-variant hover:border-secondary/40 hover:bg-surface-container'}`}>
                        <div className="flex items-end gap-0.5">
                          <div className={`rounded-sm transition-all ${ticketWidth === w ? 'bg-secondary' : 'bg-on-surface-variant/30'}`}
                            style={{ width: w === '58' ? 20 : 28, height: 32 }} />
                        </div>
                        <span className="text-[13px] font-semibold">{w} mm</span>
                      </button>
                    ))}
                  </div>
                </FormField>

                <ToggleRow icon="receipt_long" title="Imprimir al vender"
                  description="Imprime el ticket automáticamente al cerrar la venta"
                  checked={autoPrint} onChange={setAutoPrint} />

                <ToggleRow icon="point_of_sale" title="Abrir cajón de dinero"
                  description="Envía el pulso para abrir el cajón al imprimir"
                  checked={openDrawer} onChange={setOpenDrawer} />

                <SectionDivider label="Prueba" />

                <button onClick={handleTestPrint} disabled={!canTest}
                  className="flex items-center justify-center gap-2 w-full py-2.5
                             border border-outline-variant rounded-lg text-on-surface-variant
                             text-[13px] hover:bg-surface-container transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  {testStatus === 'printing' && <><span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>Enviando…</>}
                  {testStatus === 'ok'       && <><span className="material-symbols-outlined text-[16px] text-[#009668]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>¡Impreso correctamente!</>}
                  {testStatus === 'error'    && <><span className="material-symbols-outlined text-[16px] text-error" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>Error al imprimir</>}
                  {testStatus === 'idle'     && <><span className="material-symbols-outlined text-[16px]">print</span>Imprimir "Hola Mundo"</>}
                </button>

                {!canTest && testStatus === 'idle' && (
                  <p className="text-on-surface-variant/50 text-[10px] -mt-3 text-center">
                    {connectionType === 'bluetooth'
                      ? 'Vincula la impresora primero para probar'
                      : 'Ingresa el nombre de la impresora primero'}
                  </p>
                )}

                {testStatus === 'error' && testError && (
                  <p className="text-error/80 text-[10px] -mt-3 leading-snug bg-error/5
                                border border-error/20 rounded-lg px-3 py-2">
                    {testError}
                  </p>
                )}
              </div>
            )}
          </>
          )}
        </div>

        {/* Footer */}
        {(step === 2 || isElectron()) && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-outline-variant shrink-0">
            <button onClick={onClose}
              className="px-4 py-2 text-[13px] text-on-surface-variant
                         hover:bg-surface-container rounded-lg transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave}
              className="px-4 py-2 text-[13px] font-medium bg-secondary text-on-secondary
                         rounded-lg hover:bg-secondary/90 active:scale-95 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
              {existingDevice ? 'Guardar cambios' : 'Agregar impresora'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Sub-componentes ──────────────────────────────────────────────── */

function ConnectionOption({ icon, title, description, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl border-2 border-outline-variant
                 hover:border-secondary hover:bg-secondary/5 active:bg-secondary/10
                 transition-all text-left group w-full">
      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center
                      shrink-0 group-hover:bg-secondary/10 transition-colors">
        <span className="material-symbols-outlined text-[20px] text-secondary">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-on-surface font-medium text-[13px]">{title}</p>
        <p className="text-on-surface-variant text-[11px] mt-0.5">{description}</p>
      </div>
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-secondary transition-colors">
        chevron_right
      </span>
    </button>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-on-surface-variant/60 text-[10px] leading-relaxed">{hint}</p>}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 -mx-1">
      <div className="flex-1 h-px bg-outline-variant" />
      <span className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-outline-variant" />
    </div>
  );
}

function ToggleRow({ icon, title, description, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-3 w-full text-left py-1 group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
        ${checked ? 'bg-secondary/15' : 'bg-surface-container'}`}>
        <span className={`material-symbols-outlined text-[18px] transition-colors ${checked ? 'text-secondary' : 'text-on-surface-variant'}`}
          style={{ fontVariationSettings: checked ? "'FILL' 1" : "'FILL' 0" }}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium transition-colors ${checked ? 'text-on-surface' : 'text-on-surface-variant'}`}>
          {title}
        </p>
        <p className="text-on-surface-variant/60 text-[10px] mt-0.5 leading-tight">{description}</p>
      </div>
      <div className={`relative rounded-full shrink-0 transition-colors duration-200 ${checked ? 'bg-secondary' : 'bg-outline-variant'}`}
        style={{ height: '22px', width: '40px' }}>
        <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? 'left-[20px]' : 'left-[3px]'}`} />
      </div>
    </button>
  );
}