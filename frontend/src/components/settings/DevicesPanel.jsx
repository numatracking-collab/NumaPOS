import { useState, useEffect, useRef, useCallback } from 'react';
import PrinterSetupModal from './PrinterSetupModal';
import { reconnectBTPrinters, getBTWatcherStatus } from '../../services/printerService';
import { isCapacitor } from '../../services/runtimeEnv';

/* ─────────────────────────────────────────────────────────────────────────
   DevicesPanel
   ───────────────────────────────────────────────────────────────────────────
   FASE 2: este panel ya NO llama navigator.bluetooth directamente. Toda la
   lógica de "intentar reconectar las impresoras BT guardadas" vive ahora en
   printerService.reconnectBTPrinters(), que internamente decide la rama
   correcta (Web Bluetooth o el adapter de Capacitor). Este componente solo
   dispara esa función y lee su resultado a través de getBTWatcherStatus().

   Esto también es lo que queremos para la futura Fase 3 (Electron): cuando
   exista un adapter USB para Electron, el panel seguirá sin cambios — toda
   la decisión de entorno queda centralizada en printerService.js.
   ───────────────────────────────────────────────────────────────────────── */
export default function DevicesPanel() {
  const [devices, setDevices]                   = useState([]);
  const [showAddMenu, setShowAddMenu]           = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingDevice, setEditingDevice]       = useState(null);

  /* status map: deviceId → 'online' | 'offline' | 'checking' | 'unknown' */
  const [statusMap, setStatusMap] = useState({});

  const menuRef = useRef(null);

  /* ── Cargar dispositivos guardados ─────────────────────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_devices');
      if (saved) setDevices(JSON.parse(saved));
    } catch { /* noop */ }
  }, []);

  /* ── Cerrar menú al hacer clic fuera ───────────────────────────── */
  useEffect(() => {
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  /* ── Aplica el resultado de reconnectBTPrinters() al statusMap ──────────
     reconnectBTPrinters() (en printerService.js) ya intentó conectar todas
     las impresoras BT guardadas y dejó en getBTWatcherStatus() cuáles NO
     se pudieron alcanzar (missingDevices). Lo demás se asume conectado. ── */
  const applyWatcherStatus = useCallback((btDevices) => {
    const { missingDevices } = getBTWatcherStatus();
    const missingIds = new Set(missingDevices.map(d => d.id));

    setStatusMap(prev => {
      const next = { ...prev };
      for (const d of btDevices) {
        next[d.id] = missingIds.has(d.id) ? 'offline' : 'online';
      }
      return next;
    });
  }, []);

  /* ── Ping de un solo dispositivo (botón de refresh manual) ───────────────
     Reutiliza reconnectBTPrinters() — es más simple y consistente que tener
     una ruta de reconexión paralela solo para el botón manual. */
  const pingDevice = useCallback(async (device) => {
    if (device.connectionType === 'windows') {
      setStatusMap(prev => ({ ...prev, [device.id]: 'online' }));
      return;
    }

    setStatusMap(prev => ({ ...prev, [device.id]: 'checking' }));
    await reconnectBTPrinters();
    applyWatcherStatus([device]);
  }, [applyWatcherStatus]);

  /* ── Al cargar: intentar reconectar impresoras BT automáticamente ───────
     Antes este efecto reimplementaba todo el ciclo de getDevices() +
     gatt.connect() a mano. Ahora delega por completo en
     reconnectBTPrinters(), que ya sabe distinguir web de Capacitor. ──────── */
  useEffect(() => {
    const run = async () => {
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem('pos_devices') || '[]'); } catch { return; }

      const btPrinters = saved.filter(d => d.connectionType === 'bluetooth' && d.address);
      if (btPrinters.length === 0) return;

      await reconnectBTPrinters();
      applyWatcherStatus(btPrinters);
    };

    run();
  }, [applyWatcherStatus]); // solo al montar (applyWatcherStatus es estable)

  /* ── Guardar (crear o editar) ───────────────────────────────────── */
  const handleSaveDevice = (device) => {
    setDevices(prev => {
      const filtered = prev.filter(d => d.id !== device.id);
      const updated  = [...filtered, device];
      localStorage.setItem('pos_devices', JSON.stringify(updated));
      return updated;
    });
    setShowPrinterModal(false);
    setEditingDevice(null);
  };

  /* ── Eliminar ───────────────────────────────────────────────────── */
  const handleRemove = (id) => {
    setStatusMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setDevices(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem('pos_devices', JSON.stringify(updated));
      return updated;
    });
  };

  /* ── Editar ─────────────────────────────────────────────────────── */
  const handleEdit = (device) => {
    setEditingDevice(device);
    setShowPrinterModal(true);
  };

  /* ── Forzar re-ping manual ──────────────────────────────────────── */
  const handleRefreshStatus = (device) => {
    pingDevice(device);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">

      {/* ── Encabezado del panel ──────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-on-surface font-semibold text-base">Dispositivos vinculados</h2>
          <p className="text-on-surface-variant text-[12px] mt-0.5">
            Administra los periféricos conectados a tu POS
          </p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="flex items-center gap-1.5 bg-secondary text-on-secondary
                       px-3.5 py-2 rounded-lg text-[13px] font-medium
                       hover:bg-secondary/90 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            Agregar
          </button>

          {showAddMenu && (
            <div className="absolute right-0 mt-1.5 w-52 bg-surface-bright border border-outline-variant
                            rounded-xl shadow-lg z-20 overflow-hidden py-1">
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setEditingDevice(null);
                  setShowPrinterModal(true);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left
                           text-[13px] text-on-surface hover:bg-surface-container transition-colors"
              >
                <span
                  className="material-symbols-outlined text-[19px] text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  receipt_long
                </span>
                Impresora de tickets
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Lista de dispositivos / Estado vacío ──────────────────── */}
      {devices.length === 0 ? (

        <div className="flex flex-col items-center justify-center py-16 text-center select-none">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
            <span
              className="material-symbols-outlined text-[32px] text-on-surface-variant"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              print_disabled
            </span>
          </div>
          <p className="text-on-surface-variant text-[13px] font-medium">Sin dispositivos vinculados</p>
          <p className="text-on-surface-variant/50 text-[11px] mt-1 max-w-xs">
            Usa el botón <strong>Agregar</strong> para conectar una impresora de tickets
          </p>
        </div>

      ) : (

        <div className="flex flex-col gap-2">
          {devices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              status={statusMap[device.id] ?? 'unknown'}
              onEdit={() => handleEdit(device)}
              onRemove={() => handleRemove(device.id)}
              onRefresh={() => handleRefreshStatus(device)}
            />
          ))}
        </div>

      )}

      {/* ── Modal impresora ───────────────────────────────────────── */}
      {showPrinterModal && (
        <PrinterSetupModal
          existingDevice={editingDevice}
          onSave={handleSaveDevice}
          onClose={() => { setShowPrinterModal(false); setEditingDevice(null); }}
        />
      )}
    </div>
  );
}

/* ── Chip de estado ───────────────────────────────────────────────── */
function StatusChip({ status }) {
  const configs = {
    online:   { dot: 'bg-[#009668]',              label: 'En línea',    text: 'text-[#009668]'              },
    offline:  { dot: 'bg-error animate-pulse',     label: 'Sin conexión', text: 'text-error'                 },
    checking: { dot: 'bg-secondary animate-pulse', label: 'Verificando', text: 'text-secondary'              },
    unknown:  { dot: 'bg-on-surface-variant/30',   label: 'Desconocido', text: 'text-on-surface-variant/60' },
  };
  const c = configs[status] ?? configs.unknown;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ── Tarjeta de dispositivo ───────────────────────────────────────── */
function DeviceCard({ device, status, onEdit, onRemove, onRefresh }) {
  const isBT = device.connectionType === 'bluetooth';

  return (
    <div className="flex items-center gap-3 bg-surface-bright border border-outline-variant
                    rounded-xl px-4 py-3.5 group transition-shadow hover:shadow-sm">
      {/* Ícono */}
      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
        <span
          className="material-symbols-outlined text-[20px] text-secondary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          receipt_long
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-on-surface font-medium text-[13px] truncate">{device.name}</p>
          <StatusChip status={status} />
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span
            className="material-symbols-outlined text-[12px] text-on-surface-variant"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {isBT ? 'bluetooth' : 'computer'}
          </span>
          <p className="text-on-surface-variant text-[11px]">
            {isBT ? 'Bluetooth' : 'Cola de impresión Windows'}
            {device.address && (
              <span className="font-mono ml-1.5 text-[10px] opacity-70">{device.address}</span>
            )}
          </p>

          {/* Badges de configuración */}
          {device.config?.ticketWidth && (
            <span className="text-[9px] bg-surface-container text-on-surface-variant
                             px-1.5 py-0.5 rounded-full font-medium">
              {device.config.ticketWidth} mm
            </span>
          )}
          {device.config?.autoPrint && (
            <span className="text-[9px] bg-secondary/10 text-secondary
                             px-1.5 py-0.5 rounded-full font-medium">
              Auto
            </span>
          )}
          {device.config?.openDrawer && (
            <span className="text-[9px] bg-surface-container text-on-surface-variant
                             px-1.5 py-0.5 rounded-full font-medium">
              Cajón
            </span>
          )}
        </div>
      </div>

      {/* Acciones
          · Móvil  (< md): siempre visibles — el hover no existe en touch
          · Desktop (md+): aparecen al hover, igual que antes              */}
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {/* Solo Bluetooth puede re-pinguear manualmente */}
        {isBT && (
          <button
            onClick={onRefresh}
            title="Verificar conexión"
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container active:bg-surface-container transition-colors"
          >
            <span className={`material-symbols-outlined text-[17px] ${status === 'checking' ? 'animate-spin' : ''}`}>
              sync
            </span>
          </button>
        )}
        <button
          onClick={onEdit}
          title="Editar"
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container active:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[17px]">edit</span>
        </button>
        <button
          onClick={onRemove}
          title="Eliminar"
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error active:bg-error/10 active:text-error transition-colors"
        >
          <span className="material-symbols-outlined text-[17px]">delete</span>
        </button>
      </div>
    </div>
  );
}