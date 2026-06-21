/* ═══════════════════════════════════════════════════════════════════════════
   TopAppBar.jsx
   Barra superior del POS.
   — Selector de caja: menú compacto con acordeón para elegir caja,
     y accesos directos grandes a Movimiento de caja / Realizar corte.
   — Selector de serie de facturación.
   — Los menús desplegables se renderizan vía Portal a document.body para
     evitar que contenedores con overflow (ej. la fila scrolleable en móvil)
     los recorten. Ver DropdownPortal más abajo.
═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cajasService, seriesService as invoiceSeriesService } from '../services/api';
import MovimientoCajaModal from './MovimientoCajaModal';
import CorteCajaModal      from './CorteCajaModal';

/* ══════════════════════════════════════════════════════════════════════════
   DropdownPortal
   Renderiza su contenido directamente en document.body, posicionado con
   `position: fixed` según la posición real del botón que lo dispara
   (anchorRef). Esto evita que contenedores padre con overflow-x/y lo recorten
   (problema típico en filas con scroll horizontal en móvil/Android WebView).
══════════════════════════════════════════════════════════════════════════ */
function DropdownPortal({ anchorRef, open, onClose, width = 288, children }) {
    const portalRef = useRef(null);
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current) return;

        const update = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w  = Math.min(width, vw - 16);

            let left = Math.max(8, Math.min(rect.left, vw - w - 8));
            let top  = rect.bottom + 4;

            // Si no cabe debajo, lo abrimos hacia arriba del botón.
            const maxDropHeight = Math.min(360, vh * 0.7);
            if (top + maxDropHeight > vh - 8 && rect.top - maxDropHeight > 8) {
                top = rect.top - maxDropHeight - 4;
            }

            setPos({ top, left, width: w, maxHeight: maxDropHeight });
        };

        update();
        // capture: true para detectar scroll de CUALQUIER contenedor anidado,
        // no solo el de window (ej. la fila horizontal scrolleable en móvil).
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, anchorRef, width]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (portalRef.current?.contains(e.target)) return;
            if (anchorRef.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onClose, anchorRef]);

    if (!open || !pos) return null;

    return createPortal(
        <div
            ref={portalRef}
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: 9999,
            }}
            className="overflow-y-auto"
        >
            {children}
        </div>,
        document.body
    );
}

export default function TopAppBar({
    searchValue,
    onSearchChange,
    placeholder = 'Escanear o buscar productos...',
    hideActions = false,
    onCajaChange,
    onSeriesChange,
    mobileView = 'products',
}) {
    const [cajas,         setCajas]         = useState([]);
    const [series,        setSeries]        = useState([]);
    const [selectedCaja,  setSelectedCaja]  = useState(null);
    const [selectedSerie, setSelectedSerie] = useState(null);

    // Dropdowns desktop / móvil
    const [cajaOpenD,  setCajaOpenD]  = useState(false);
    const [serieOpenD, setSerieOpenD] = useState(false);
    const [cajaOpenM,  setCajaOpenM]  = useState(false);
    const [serieOpenM, setSerieOpenM] = useState(false);

    // Formularios inline de creación
    const [cajaForm,    setCajaForm]    = useState(false);
    const [serieForm,   setSerieForm]   = useState(false);
    const [newCajaName, setNewCajaName] = useState('');
    const [newSerie,    setNewSerie]    = useState({ name: '', prefix: '', next_folio: '1' });
    const [creating,    setCreating]    = useState(false);
    const [cajaError,   setCajaError]   = useState('');
    const [serieError,  setSerieError]  = useState('');

    // Modales de caja
    const [showMovimiento, setShowMovimiento] = useState(false);
    const [showCorte,      setShowCorte]      = useState(false);

    // Refs de los botones que disparan cada dropdown (anclas para el portal)
    const cajaBtnRefD  = useRef(null);
    const serieBtnRefD = useRef(null);
    const cajaBtnRefM  = useRef(null);
    const serieBtnRefM = useRef(null);

    useEffect(() => {
        fetchCajas();
        fetchSeries();
    }, []);

    /* ── Helpers de cierre ─────────────────────────────────────────────── */
    const closeCajaDropdown  = () => { setCajaOpenD(false);  setCajaOpenM(false);  setCajaForm(false);  setNewCajaName(''); setCajaError(''); };
    const closeSerieDropdown = () => { setSerieOpenD(false); setSerieOpenM(false); setSerieForm(false); setNewSerie({ name: '', prefix: '', next_folio: '1' }); setSerieError(''); };

    /* ── Abrir modales de caja ─────────────────────────────────────────── */
    const handleOpenMovimiento = () => { closeCajaDropdown(); setShowMovimiento(true); };
    const handleOpenCorte      = () => { closeCajaDropdown(); setShowCorte(true);      };

    /* ── Cajas ─────────────────────────────────────────────────────────── */
    const fetchCajas = async () => {
        try {
            const data    = await cajasService.getAll();
            setCajas(data);
            const savedId = localStorage.getItem('numa_caja_id');
            const match   = savedId ? data.find(c => String(c.id) === savedId) : null;
            const target  = match || data[0] || null;
            if (target) applySelectCaja(target, false);
        } catch (err) { console.error('Error cargando cajas:', err); }
    };

    const applySelectCaja = (caja, closeDropdown = true) => {
        setSelectedCaja(caja);
        localStorage.setItem('numa_caja_id', String(caja.id));
        onCajaChange?.(caja);
        if (closeDropdown) closeCajaDropdown();
    };

    const handleCreateCaja = async () => {
        if (!newCajaName.trim()) { setCajaError('Escribe un nombre.'); return; }
        setCreating(true); setCajaError('');
        try {
            const created = await cajasService.create({ name: newCajaName.trim() });
            setCajas(prev => [...prev, created]);
            applySelectCaja(created);
        } catch (err) {
            setCajaError(err.message || 'Error al crear la caja.');
        } finally { setCreating(false); }
    };

    /* ── Series ────────────────────────────────────────────────────────── */
    const fetchSeries = async () => {
        try {
            const data    = await invoiceSeriesService.getAll();
            setSeries(data);
            const savedId = localStorage.getItem('numa_series_id');
            const match   = savedId ? data.find(s => String(s.id) === savedId) : null;
            const target  = match || data.find(s => s.is_default) || data[0] || null;
            if (target) applySelectSerie(target, false);
        } catch (err) { console.error('Error cargando series:', err); }
    };

    const applySelectSerie = async (serie, closeDropdown = true) => {
        try {
            if (!serie.is_default) {
                await invoiceSeriesService.setDefault(serie.id);
                setSeries(prev => prev.map(s => ({ ...s, is_default: s.id === serie.id })));
            }
        } catch (err) { console.error('Error cambiando serie default:', err); }
        setSelectedSerie(serie);
        localStorage.setItem('numa_series_id', String(serie.id));
        onSeriesChange?.(serie);
        if (closeDropdown) closeSerieDropdown();
    };

    const handleCreateSerie = async () => {
        if (!newSerie.name.trim())   { setSerieError('El nombre es requerido.'); return; }
        if (!newSerie.prefix.trim()) { setSerieError('El prefijo es requerido.'); return; }
        setCreating(true); setSerieError('');
        try {
            const created = await invoiceSeriesService.create({
                name:       newSerie.name.trim(),
                prefix:     newSerie.prefix.trim().toUpperCase(),
                next_folio: Math.max(1, Number(newSerie.next_folio) || 1),
            });
            setSeries(prev => [...prev, created]);
            await applySelectSerie(created);
        } catch (err) {
            setSerieError(err.message || 'Error al crear la serie.');
        } finally { setCreating(false); }
    };

    const nextFolioLabel = selectedSerie
        ? `${selectedSerie.prefix}${String(selectedSerie.next_folio).padStart(4, '0')}`
        : '—';

    /* ── Props comunes para ambas instancias de CajaDropdownContent ────── */
    const cajaDropdownCommonProps = {
        cajas, selectedCaja,
        cajaForm, newCajaName, cajaError, creating,
        onSelect:      applySelectCaja,
        onShowForm:    () => setCajaForm(true),
        onNameChange:  e  => { setNewCajaName(e.target.value); setCajaError(''); },
        onCancel:      closeCajaDropdown,
        onCreate:      handleCreateCaja,
        onMovimiento:  handleOpenMovimiento,
        onCorte:       handleOpenCorte,
    };

    const serieDropdownCommonProps = {
        series, selectedSerie,
        serieForm, newSerie, serieError, creating,
        onSelect:      applySelectSerie,
        onShowForm:    () => setSerieForm(true),
        onSerieChange: (field, val) => setNewSerie(p => ({ ...p, [field]: val })),
        onCancel:      closeSerieDropdown,
        onCreate:      handleCreateSerie,
    };

    const UtilIcons = () => (
        <div className="flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-secondary transition-colors">sync</span>
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-secondary transition-colors">notifications</span>
        </div>
    );

    /* ══════════════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════════════ */
    return (
        <>
            {/* ── Modales de caja ── */}
            <MovimientoCajaModal
                isOpen={showMovimiento}
                onClose={() => setShowMovimiento(false)}
                caja={selectedCaja}
                onMovementCreated={() => {/* opcional: recargar algo */}}
            />
            <CorteCajaModal
                isOpen={showCorte}
                onClose={() => setShowCorte(false)}
                caja={selectedCaja}
            />

            <header className="w-full shrink-0 z-50 bg-surface-bright border-b border-outline-variant">

                {/* ════ DESKTOP ════ */}
                <div className="hidden md:flex items-center justify-between px-lg h-[64px]">

                    <div className="flex items-center gap-md">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
                            <input
                                type="text"
                                className="pl-xl pr-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:outline-none font-body-sm w-[450px] py-sm text-body-md"
                                placeholder={placeholder}
                                value={searchValue || ''}
                                onChange={e => onSearchChange?.(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-sm">
                        {!hideActions && (
                            <>
                                <button className="flex items-center gap-xs px-md py-sm bg-surface-container-low text-secondary font-label-bold text-label-bold rounded-lg hover:bg-surface-container-high transition-all active:scale-95">
                                    <span className="material-symbols-outlined">pause_circle</span>
                                    Ventas en Espera
                                </button>
                                <button className="flex items-center gap-xs px-md py-sm bg-surface-container-low text-secondary font-label-bold text-label-bold rounded-lg hover:bg-surface-container-high transition-all active:scale-95">
                                    <span className="material-symbols-outlined">percent</span>
                                    Aplicar Descuento
                                </button>

                                <div className="h-8 w-[1px] bg-outline-variant mx-xs" />

                                {/* Caja — desktop */}
                                <div className="relative">
                                    <button
                                        ref={cajaBtnRefD}
                                        onClick={() => { setCajaOpenD(o => !o); setSerieOpenD(false); }}
                                        className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border transition-all text-[13px] font-medium ${cajaOpenD ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container-high'}`}
                                    >
                                        <span className="material-symbols-outlined text-[17px] text-secondary">point_of_sale</span>
                                        <span className="max-w-[110px] truncate">{selectedCaja ? selectedCaja.name : 'Sin caja'}</span>
                                        <span className={`material-symbols-outlined text-[16px] text-outline-variant transition-transform ${cajaOpenD ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                </div>
                                <DropdownPortal anchorRef={cajaBtnRefD} open={cajaOpenD} onClose={closeCajaDropdown} width={288}>
                                    <CajaDropdownContent {...cajaDropdownCommonProps} />
                                </DropdownPortal>

                                {/* Serie — desktop */}
                                <div className="relative">
                                    <button
                                        ref={serieBtnRefD}
                                        onClick={() => { setSerieOpenD(o => !o); setCajaOpenD(false); }}
                                        className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border transition-all text-[13px] font-medium ${serieOpenD ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container-high'}`}
                                    >
                                        <span className="material-symbols-outlined text-[17px] text-secondary">receipt_long</span>
                                        <span className="font-mono text-[12px]">{nextFolioLabel}</span>
                                        <span className={`material-symbols-outlined text-[16px] text-outline-variant transition-transform ${serieOpenD ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                </div>
                                <DropdownPortal anchorRef={serieBtnRefD} open={serieOpenD} onClose={closeSerieDropdown} width={288}>
                                    <SerieDropdownContent {...serieDropdownCommonProps} />
                                </DropdownPortal>

                                <div className="h-8 w-[1px] bg-outline-variant mx-xs" />
                            </>
                        )}
                        <UtilIcons />
                    </div>
                </div>

                {/* ════ MÓVIL ════ */}
                <div className="md:hidden h-[52px] flex items-center justify-between px-3 gap-2">
                    {mobileView === 'products' ? (
                        <>
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:outline-none text-[13px]"
                                    placeholder={placeholder}
                                    value={searchValue || ''}
                                    onChange={e => onSearchChange?.(e.target.value)}
                                />
                            </div>
                            <UtilIcons />
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                                <button className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-low text-secondary rounded-lg active:scale-95 shrink-0 border border-outline-variant/50">
                                    <span className="material-symbols-outlined text-[17px]">pause_circle</span>
                                </button>
                                <button className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-low text-secondary rounded-lg active:scale-95 shrink-0 border border-outline-variant/50">
                                    <span className="material-symbols-outlined text-[17px]">percent</span>
                                </button>

                                <div className="h-6 w-[1px] bg-outline-variant shrink-0" />

                                {/* Caja — móvil */}
                                <div className="relative shrink-0">
                                    <button
                                        ref={cajaBtnRefM}
                                        onClick={() => { setCajaOpenM(o => !o); setSerieOpenM(false); }}
                                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[11px] font-medium ${cajaOpenM ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface'}`}
                                    >
                                        <span className="material-symbols-outlined text-[15px] text-secondary">point_of_sale</span>
                                        <span className="max-w-[72px] truncate">{selectedCaja ? selectedCaja.name : 'Sin caja'}</span>
                                        <span className={`material-symbols-outlined text-[13px] text-outline-variant transition-transform ${cajaOpenM ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                </div>
                                <DropdownPortal anchorRef={cajaBtnRefM} open={cajaOpenM} onClose={closeCajaDropdown} width={272}>
                                    <CajaDropdownContent {...cajaDropdownCommonProps} />
                                </DropdownPortal>

                                {/* Serie — móvil */}
                                <div className="relative shrink-0">
                                    <button
                                        ref={serieBtnRefM}
                                        onClick={() => { setSerieOpenM(o => !o); setCajaOpenM(false); }}
                                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[11px] font-medium ${serieOpenM ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface'}`}
                                    >
                                        <span className="material-symbols-outlined text-[15px] text-secondary">receipt_long</span>
                                        <span className="font-mono text-[11px]">{nextFolioLabel}</span>
                                        <span className={`material-symbols-outlined text-[13px] text-outline-variant transition-transform ${serieOpenM ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>
                                </div>
                                <DropdownPortal anchorRef={serieBtnRefM} open={serieOpenM} onClose={closeSerieDropdown} width={272}>
                                    <SerieDropdownContent {...serieDropdownCommonProps} />
                                </DropdownPortal>
                            </div>
                            <UtilIcons />
                        </>
                    )}
                </div>
            </header>
        </>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CajaDropdownContent
   Contenido del menú de caja. Ya NO incluye posicionamiento absolute/fixed
   ni z-index: eso lo resuelve DropdownPortal, que es quien lo monta.
   — "Caja actual" como acordeón: al tocarlo se despliega la lista de cajas
     (y la opción de crear una nueva) dentro del mismo menú, sin cerrarlo.
   — Movimiento de caja / Realizar corte como acciones principales, grandes
     y con más espacio táctil — son las que más se usan en el día a día.
══════════════════════════════════════════════════════════════════════════ */
function CajaDropdownContent({
    cajas, selectedCaja,
    cajaForm, newCajaName, cajaError, creating,
    onSelect, onShowForm, onNameChange, onCancel, onCreate,
    onMovimiento, onCorte,
}) {
    const [selectorOpen, setSelectorOpen] = useState(false);

    return (
        <div className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden">

            {/* ── Selector de caja (acordeón) ── */}
            <div className="border-b border-outline-variant/20">
                <button
                    onClick={() => setSelectorOpen(o => !o)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-container transition-colors"
                >
                    <span className="flex items-center gap-2.5 text-[14px] font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-[18px] text-secondary">point_of_sale</span>
                        {selectedCaja ? selectedCaja.name : 'Sin caja'}
                    </span>
                    <span className={`material-symbols-outlined text-[18px] text-outline-variant transition-transform ${selectorOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>

                {selectorOpen && (
                    <div className="pb-2 bg-surface-container-low/40">
                        {cajas.length === 0 ? (
                            <p className="px-4 py-2 text-[12px] text-on-surface-variant">No hay cajas creadas.</p>
                        ) : (
                            cajas.map(caja => (
                                <button
                                    key={caja.id}
                                    onClick={() => { onSelect(caja); setSelectorOpen(false); }}
                                    className="w-full pl-10 pr-4 py-2 flex items-center gap-2.5 hover:bg-surface-container text-[13px] text-left transition-colors"
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${selectedCaja?.id === caja.id ? 'text-secondary' : 'text-transparent'}`}>check</span>
                                    {caja.name}
                                </button>
                            ))
                        )}

                        {/* Crear nueva caja */}
                        {!cajaForm ? (
                            <button
                                onClick={onShowForm}
                                className="w-full pl-10 pr-4 py-2 flex items-center gap-2 hover:bg-surface-container text-[13px] text-secondary font-medium text-left transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                Nueva caja
                            </button>
                        ) : (
                            <div className="px-4 pt-1 pb-1 flex flex-col gap-2">
                                <input
                                    autoFocus
                                    value={newCajaName}
                                    onChange={onNameChange}
                                    onKeyDown={e => e.key === 'Enter' && onCreate()}
                                    placeholder="Ej. Caja Principal"
                                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary"
                                />
                                {cajaError && <p className="text-error text-[11px]">{cajaError}</p>}
                                <div className="flex gap-2">
                                    <button onClick={onCancel} className="flex-1 py-1.5 text-[12px] text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">Cancelar</button>
                                    <button onClick={onCreate} disabled={creating} className="flex-1 py-1.5 text-[12px] bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50">{creating ? '...' : 'Crear'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Acciones principales: Movimiento / Corte ── */}
            <button
                onClick={onMovimiento}
                disabled={!selectedCaja}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-surface-container text-[14px] font-medium text-on-surface text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-[20px] text-secondary">swap_vert</span>
                Movimiento de caja
            </button>
            <button
                onClick={onCorte}
                disabled={!selectedCaja}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-surface-container text-[14px] font-medium text-on-surface text-left transition-colors border-t border-outline-variant/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-[20px] text-secondary">point_of_sale</span>
                Realizar corte
            </button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SerieDropdownContent
══════════════════════════════════════════════════════════════════════════ */
function SerieDropdownContent({ series, selectedSerie, serieForm, newSerie, serieError, creating, onSelect, onShowForm, onSerieChange, onCancel, onCreate }) {
    return (
        <div className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden">
            {series.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-on-surface-variant">No hay series creadas.</p>
            ) : (
                series.map(s => (
                    <button key={s.id} onClick={() => onSelect(s)}
                        className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-surface-container text-left transition-colors">
                        <span className={`material-symbols-outlined text-[16px] shrink-0 ${selectedSerie?.id === s.id ? 'text-secondary' : 'text-transparent'}`}>check</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-on-surface leading-tight">{s.name}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono">{s.prefix ? `${s.prefix}-` : ''}xxxx · próximo: {String(s.next_folio).padStart(4, '0')}</p>
                        </div>
                        {s.is_default && <span className="text-[9px] font-bold bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full shrink-0">Default</span>}
                    </button>
                ))
            )}
            <div className="border-t border-outline-variant/20">
                {!serieForm ? (
                    <button onClick={onShowForm}
                        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-surface-container text-[13px] text-secondary font-medium text-left transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Nueva serie
                    </button>
                ) : (
                    <div className="p-3 flex flex-col gap-2">
                        <input
                            autoFocus
                            value={newSerie.name}
                            onChange={e => onSerieChange('name', e.target.value)}
                            placeholder="Nombre (ej. Principal)"
                            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary"
                        />
                        <div className="flex gap-2">
                            <div className="flex flex-col gap-0.5 w-20">
                                <span className="text-[10px] text-on-surface-variant px-0.5">Prefijo</span>
                                <input
                                    value={newSerie.prefix}
                                    onChange={e => onSerieChange('prefix', e.target.value.toUpperCase().slice(0, 5))}
                                    placeholder="A"
                                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-secondary"
                                />
                            </div>
                            <div className="flex flex-col gap-0.5 flex-1">
                                <span className="text-[10px] text-on-surface-variant px-0.5">Folio inicial</span>
                                <input
                                    type="number" min="1"
                                    value={newSerie.next_folio}
                                    onChange={e => onSerieChange('next_folio', e.target.value)}
                                    placeholder="1"
                                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary"
                                />
                            </div>
                        </div>
                        {serieError && <p className="text-error text-[11px]">{serieError}</p>}
                        <div className="flex gap-2">
                            <button onClick={onCancel} className="flex-1 py-1.5 text-[12px] text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">Cancelar</button>
                            <button onClick={onCreate} disabled={creating} className="flex-1 py-1.5 text-[12px] bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50">{creating ? '...' : 'Crear'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}