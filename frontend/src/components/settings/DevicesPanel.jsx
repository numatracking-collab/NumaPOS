import { useState, useEffect, useRef, useCallback } from 'react';
import PrinterSetupModal from './PrinterSetupModal';
import { reconnectBTPrinters, getBTWatcherStatus } from '../../services/printerService';
import { isCapacitor } from '../../services/runtimeEnv';
import { getBusinessSettings, saveTicketConfig } from '../../services/businessService';

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
  const [devices, setDevices] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

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
      const updated = [...filtered, device];
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
    <div className="w-full h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">

        {/* ── Encabezado del panel ──────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-on-surface font-semibold text-base">Dispositivos vinculados</h2>
            <p className="text-on-surface-variant text-[12px] mt-0.5">
              Administra los periféricos conectados a tu POS
            </p>
          </div>

          <div className="relative self-start md:self-auto" ref={menuRef}>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="flex items-center gap-1.5 bg-primary text-on-primary
                         px-3.5 py-2 rounded-lg text-[13px] font-medium
                         hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
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

        {/* ── Card principal: dispositivos + formato de ticket ───────── */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-4 md:p-6 flex flex-col gap-5">

          {/* Lista de dispositivos / Estado vacío */}
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
              <p className="text-on-surface text-[13px] font-medium">
                Sin dispositivos vinculados
              </p>
              <p className="text-on-surface-variant text-[12px] leading-relaxed mt-1.5 max-w-[220px]">
                Usa el botón <span className="font-semibold text-on-surface">Agregar</span> para conectar una impresora de tickets
              </p>
            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <hr className="border-outline-variant" />

          <TicketFormatSection />
        </div>

        {/* ── Modal impresora ───────────────────────────────────────── */}
        {showPrinterModal && (
          <PrinterSetupModal
            existingDevice={editingDevice}
            onSave={handleSaveDevice}
            onClose={() => { setShowPrinterModal(false); setEditingDevice(null); }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Chip de estado ───────────────────────────────────────────────── */
function StatusChip({ status }) {
  const configs = {
    online: { dot: 'bg-[#009668]', label: 'En línea', text: 'text-[#009668]', bg: 'bg-[#009668]/10' },
    offline: { dot: 'bg-error animate-pulse', label: 'Sin conexión', text: 'text-error', bg: 'bg-error/10' },
    checking: { dot: 'bg-secondary animate-pulse', label: 'Verificando', text: 'text-secondary', bg: 'bg-secondary/10' },
    unknown: { dot: 'bg-on-surface-variant/30', label: 'Desconocido', text: 'text-on-surface-variant/60', bg: 'bg-surface-container' },
  };
  const c = configs[status] ?? configs.unknown;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${c.text} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ── Tarjeta de dispositivo ───────────────────────────────────────── */
function DeviceCard({ device, status, onEdit, onRemove, onRefresh }) {
  const isBT = device.connectionType === 'bluetooth';

  return (
    <div className="bg-surface-bright border border-outline-variant rounded-xl p-4
                    flex flex-col gap-3 group transition-shadow hover:shadow-sm">

      {/* Encabezado: ícono + acciones */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-[20px] text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            receipt_long
          </span>
        </div>

        {/* Acciones
            · Móvil  (< md): siempre visibles — el hover no existe en touch
            · Desktop (md+): aparecen al hover, igual que antes              */}
        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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

      {/* Info */}
      <div className="min-w-0">
        <p className="text-on-surface font-medium text-[13px] truncate">{device.name}</p>
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
        </div>
      </div>

      {/* Estado + Badges de configuración */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusChip status={status} />
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
  );
}

/* ── Formato de ticket ────────────────────────────────────────────────
   Toggles que controlan business_settings.ticket_config en el backend.
   Actualización optimista: cambia el UI de inmediato y revierte si el
   PUT falla. Es un acordeón: se despliega/oculta, y a la derecha (en
   desktop) o debajo (en móvil) se muestra una vista previa del ticket
   que se actualiza en tiempo real según los toggles activos. ─────────── */
const TICKET_FIELDS = [
  { key: 'show_logo',          icon: 'image',        label: 'Logo del negocio',        description: 'Impreso al inicio del ticket (impresoras térmicas)' },
  { key: 'show_business_name', icon: 'store',         label: 'Nombre del negocio',      description: '' },
  { key: 'show_phone',         icon: 'call',          label: 'Teléfono',                description: '' },
  { key: 'show_email',         icon: 'mail',          label: 'Correo electrónico',      description: '' },
  { key: 'show_address',       icon: 'location_on',   label: 'Ubicación',               description: '' },
  { key: 'show_sku',           icon: 'qr_code_2',     label: 'Clave del producto',      description: '' },
  { key: 'show_discounts',     icon: 'sell',          label: 'Descuentos y promociones', description: '' },
  { key: 'show_cashier',       icon: 'person',        label: 'Nombre del cajero',       description: '' },
  { key: 'show_caja',          icon: 'point_of_sale', label: 'Caja utilizada',          description: '' },
];

function TicketFormatSection() {
  const [config, setConfig]     = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [isOpen, setIsOpen]     = useState(true);

  useEffect(() => {
    getBusinessSettings()
      .then(data => {
        setConfig(data.ticket_config);
        setBusiness(data);
      })
      .catch(err => console.warn('[Business] No se pudo cargar ticket_config:', err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key) => {
    setConfig(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveTicketConfig(next).catch(() => {
        setConfig(prev2 => ({ ...prev2, [key]: !next[key] }));
      });
      return next;
    });
  };

  if (loading || !config) return null;

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden">

      {/* Header del acordeón */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left
                   hover:bg-surface-container-low transition-colors"
      >
        <div>
          <h3 className="text-on-surface font-semibold text-[13px]">Formato de ticket</h3>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            Elige qué información se imprime en cada venta
          </p>
        </div>
        <span
          className={`material-symbols-outlined text-on-surface-variant text-[22px] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {/* Contenido del acordeón */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-outline-variant">

          {/* Columna de toggles */}
          <div className="flex flex-col gap-1 p-4 border-b md:border-b-0 md:border-r border-outline-variant">
            {TICKET_FIELDS.map(f => (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                className="flex items-center gap-3 w-full text-left py-1.5 group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
                  ${config[f.key] ? 'bg-secondary/15' : 'bg-surface-container'}`}>
                  <span className={`material-symbols-outlined text-[18px] transition-colors ${config[f.key] ? 'text-secondary' : 'text-on-surface-variant'}`}
                    style={{ fontVariationSettings: config[f.key] ? "'FILL' 1" : "'FILL' 0" }}>
                    {f.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium transition-colors ${config[f.key] ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {f.label}
                  </p>
                  {f.description && (
                    <p className="text-on-surface-variant/60 text-[10px] mt-0.5 leading-tight">{f.description}</p>
                  )}
                </div>
                <div className={`relative rounded-full shrink-0 transition-colors duration-200 ${config[f.key] ? 'bg-secondary' : 'bg-outline-variant'}`}
                  style={{ height: '22px', width: '40px' }}>
                  <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${config[f.key] ? 'left-[20px]' : 'left-[3px]'}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Columna de vista previa */}
          <div className="bg-surface-container p-5 flex flex-col items-center">
            <h4 className="text-on-surface font-medium text-[13px] mb-4 self-stretch text-center">Vista previa</h4>
            <TicketPreview config={config} business={business} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Vista previa del ticket ───────────────────────────────────────────
   Renderiza en vivo el ticket de venta según los toggles activos y los
   datos reales del negocio. Los datos de la venta son de ejemplo. ────── */
function TicketPreview({ config, business }) {
  return (
    <div className="w-full max-w-[240px]">
      <div className="bg-white shadow-md p-4 text-center font-mono text-[11px] text-on-surface-variant flex flex-col gap-2">

        {config.show_logo && (
          <div className="mb-1">
            {business?.logo_url
              ? <img src={business.logo_url} alt="Logo" className="h-10 w-auto mx-auto object-contain" />
              : <span className="material-symbols-outlined text-[28px] text-on-surface-variant">store</span>}
          </div>
        )}

        {config.show_business_name && (
          <p className="font-bold text-on-surface text-[13px]">{business?.business_name || 'NOMBRE DEL NEGOCIO'}</p>
        )}
        {config.show_phone && business?.phone && (
          <p>Tel: {business.phone}</p>
        )}
        {config.show_email && business?.email && (
          <p className="text-[10px] break-words">{business.email}</p>
        )}
        {config.show_address && business?.address && (
          <p className="text-[10px] mt-0.5">{business.address}</p>
        )}

        <hr className="border-dashed border-outline-variant my-1" />

        {/* Venta de ejemplo */}
        <div className="text-left text-[10px] flex flex-col gap-1.5">
          <div>
            <p className="text-on-surface flex justify-between">
              <span>1x Producto A</span><span>$10.00</span>
            </p>
            {config.show_sku && <p className="text-outline">Clave: PROD-001</p>}
            {config.show_discounts && (
              <p className="text-primary flex justify-between">
                <span>- Desc. 10%</span><span>-$1.00</span>
              </p>
            )}
          </div>
        </div>

        <hr className="border-dashed border-outline-variant my-1" />

        <p className="font-bold text-on-surface text-right text-[13px]">Total: $9.00</p>

        {(config.show_cashier || config.show_caja) && (
          <div className="mt-1.5 text-[10px] text-left">
            {config.show_cashier && <p>Cajero: Administrador</p>}
            {config.show_caja && <p>Caja: Caja Principal 1</p>}
          </div>
        )}

        <p className="mt-1.5 text-center text-outline text-[9px]">
          {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Filo dentado del ticket */}
      <div
        className="w-full h-2"
        style={{
          backgroundImage:
            'linear-gradient(135deg, white 25%, transparent 25%), linear-gradient(225deg, white 25%, transparent 25%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0',
        }}
      />
    </div>
  );
}