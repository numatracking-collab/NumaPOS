import { useState, useEffect, useRef } from 'react';
import { cajasService, invoiceSeriesService } from '../services/api';

export default function TopAppBar({
  searchValue,
  onSearchChange,
  placeholder = 'Escanear o buscar productos...',
  hideActions = false,
  onCajaChange,
  onSeriesChange,
  mobileView = 'products', // ← nuevo prop: 'products' | 'ticket'
}) {
  const [cajas, setCajas] = useState([]);
  const [series, setSeries] = useState([]);
  const [selectedCaja, setSelectedCaja] = useState(null);
  const [selectedSerie, setSelectedSerie] = useState(null);
  const [cajaOpen, setCajaOpen] = useState(false);
  const [serieOpen, setSerieOpen] = useState(false);

  const [cajaForm, setCajaForm] = useState(false);
  const [serieForm, setSerieForm] = useState(false);
  const [newCajaName, setNewCajaName] = useState('');
  const [newSerie, setNewSerie] = useState({ name: '', prefix: '', next_folio: '1' });
  const [creating, setCreating] = useState(false);
  const [cajaError, setCajaError] = useState('');
  const [serieError, setSerieError] = useState('');

  const cajaRef = useRef(null);
  const serieRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) closeCajaDropdown();
      if (serieRef.current && !serieRef.current.contains(e.target)) closeSerieDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetchCajas();
    fetchSeries();
  }, []);

  const closeCajaDropdown = () => { setCajaOpen(false); setCajaForm(false); setNewCajaName(''); setCajaError(''); };
  const closeSerieDropdown = () => { setSerieOpen(false); setSerieForm(false); setNewSerie({ name: '', prefix: '', next_folio: '1' }); setSerieError(''); };

  const fetchCajas = async () => {
    try {
      const data = await cajasService.getAll();
      setCajas(data);
      const savedId = localStorage.getItem('numa_caja_id');
      const match = savedId ? data.find(c => String(c.id) === savedId) : null;
      const target = match || data[0] || null;
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
    } catch (err) { setCajaError(err.message || 'Error al crear la caja.');
    } finally { setCreating(false); }
  };

  const fetchSeries = async () => {
    try {
      const data = await invoiceSeriesService.getAll();
      setSeries(data);
      const savedId = localStorage.getItem('numa_series_id');
      const match = savedId ? data.find(s => String(s.id) === savedId) : null;
      const target = match || data.find(s => s.is_default) || data[0] || null;
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
    if (!newSerie.name.trim()) { setSerieError('El nombre es requerido.'); return; }
    if (!newSerie.prefix.trim()) { setSerieError('El prefijo es requerido.'); return; }
    setCreating(true); setSerieError('');
    try {
      const created = await invoiceSeriesService.create({
        name: newSerie.name.trim(),
        prefix: newSerie.prefix.trim().toUpperCase(),
        next_folio: Math.max(1, Number(newSerie.next_folio) || 1),
      });
      setSeries(prev => [...prev, created]);
      await applySelectSerie(created);
    } catch (err) { setSerieError(err.message || 'Error al crear la serie.');
    } finally { setCreating(false); }
  };

  const nextFolioLabel = selectedSerie
    ? `${selectedSerie.prefix}${String(selectedSerie.next_folio).padStart(4, '0')}`
    : '—';

  // ── Íconos de utilidad (compartidos en todas las vistas) ──────────────────
  const UtilIcons = () => (
    <div className="flex items-center gap-sm shrink-0">
      <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-secondary transition-colors">sync</span>
      <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-secondary transition-colors">notifications</span>
    </div>
  );

  return (
    <header className="w-full shrink-0 z-50 bg-surface-bright border-b border-outline-variant">

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP — layout original, sin cambios
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex items-center justify-between px-lg h-[64px]">

        {/* Buscador */}
        <div className="flex items-center gap-md">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              type="text"
              className="pl-xl pr-md bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:outline-none font-body-sm w-[450px] py-sm text-body-md"
              placeholder={placeholder}
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
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

              {/* Selector Caja */}
              <div ref={cajaRef} className="relative">
                <button
                  onClick={() => { setCajaOpen(o => !o); setSerieOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border transition-all text-[13px] font-medium ${cajaOpen ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[17px] text-secondary">point_of_sale</span>
                  <span className="max-w-[110px] truncate">{selectedCaja ? selectedCaja.name : 'Sin caja'}</span>
                  <span className={`material-symbols-outlined text-[16px] text-outline-variant transition-transform duration-150 ${cajaOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {cajaOpen && <CajaDropdown cajas={cajas} selectedCaja={selectedCaja} cajaForm={cajaForm} newCajaName={newCajaName} cajaError={cajaError} creating={creating} onSelect={applySelectCaja} onShowForm={() => setCajaForm(true)} onNameChange={e => { setNewCajaName(e.target.value); setCajaError(''); }} onCancel={closeCajaDropdown} onCreate={handleCreateCaja} />}
              </div>

              {/* Selector Serie */}
              <div ref={serieRef} className="relative">
                <button
                  onClick={() => { setSerieOpen(o => !o); setCajaOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border transition-all text-[13px] font-medium ${serieOpen ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[17px] text-secondary">receipt_long</span>
                  <span className="font-mono text-[12px]">{nextFolioLabel}</span>
                  <span className={`material-symbols-outlined text-[16px] text-outline-variant transition-transform duration-150 ${serieOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {serieOpen && <SerieDropdown series={series} selectedSerie={selectedSerie} serieForm={serieForm} newSerie={newSerie} serieError={serieError} creating={creating} onSelect={applySelectSerie} onShowForm={() => setSerieForm(true)} onSerieChange={(field, val) => setNewSerie(p => ({ ...p, [field]: val }))} onCancel={closeSerieDropdown} onCreate={handleCreateSerie} />}
              </div>

              <div className="h-8 w-[1px] bg-outline-variant mx-xs" />
            </>
          )}
          <UtilIcons />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MÓVIL — cambia según mobileView
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden h-[52px] flex items-center justify-between px-3 gap-2">

        {mobileView === 'products' ? (
          /* ── Vista Productos: solo buscador + utilidades ── */
          <>
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary focus:outline-none text-[13px]"
                placeholder={placeholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
            <UtilIcons />
          </>

        ) : (
          /* ── Vista Ticket: caja, folio, descuento, espera + utilidades ── */
          <>
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">

              {/* Ventas en Espera — icono compacto */}
              <button className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-low text-secondary rounded-lg hover:bg-surface-container-high transition-all active:scale-95 shrink-0 border border-outline-variant/50">
                <span className="material-symbols-outlined text-[17px]">pause_circle</span>
                <span className="text-[11px] font-bold hidden xs:inline">Espera</span>
              </button>

              {/* Descuento — icono compacto */}
              <button className="flex items-center gap-1 px-2 py-1.5 bg-surface-container-low text-secondary rounded-lg hover:bg-surface-container-high transition-all active:scale-95 shrink-0 border border-outline-variant/50">
                <span className="material-symbols-outlined text-[17px]">percent</span>
                <span className="text-[11px] font-bold hidden xs:inline">Desc.</span>
              </button>

              <div className="h-6 w-[1px] bg-outline-variant shrink-0" />

              {/* Selector Caja compacto */}
              <div ref={cajaRef} className="relative shrink-0">
                <button
                  onClick={() => { setCajaOpen(o => !o); setSerieOpen(false); }}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[11px] font-medium ${cajaOpen ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[15px] text-secondary">point_of_sale</span>
                  <span className="max-w-[70px] truncate">{selectedCaja ? selectedCaja.name : 'Sin caja'}</span>
                  <span className={`material-symbols-outlined text-[13px] text-outline-variant transition-transform duration-150 ${cajaOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {cajaOpen && <CajaDropdown cajas={cajas} selectedCaja={selectedCaja} cajaForm={cajaForm} newCajaName={newCajaName} cajaError={cajaError} creating={creating} onSelect={applySelectCaja} onShowForm={() => setCajaForm(true)} onNameChange={e => { setNewCajaName(e.target.value); setCajaError(''); }} onCancel={closeCajaDropdown} onCreate={handleCreateCaja} />}
              </div>

              {/* Selector Serie compacto */}
              <div ref={serieRef} className="relative shrink-0">
                <button
                  onClick={() => { setSerieOpen(o => !o); setCajaOpen(false); }}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all text-[11px] font-medium ${serieOpen ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-surface-container-low border-outline-variant text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[15px] text-secondary">receipt_long</span>
                  <span className="font-mono text-[11px]">{nextFolioLabel}</span>
                  <span className={`material-symbols-outlined text-[13px] text-outline-variant transition-transform duration-150 ${serieOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {serieOpen && <SerieDropdown series={series} selectedSerie={selectedSerie} serieForm={serieForm} newSerie={newSerie} serieError={serieError} creating={creating} onSelect={applySelectSerie} onShowForm={() => setSerieForm(true)} onSerieChange={(field, val) => setNewSerie(p => ({ ...p, [field]: val }))} onCancel={closeSerieDropdown} onCreate={handleCreateSerie} />}
              </div>
            </div>

            <UtilIcons />
          </>
        )}
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-componentes de dropdowns (extraídos para no repetir código)
══════════════════════════════════════════════════════════════════════════ */

function CajaDropdown({ cajas, selectedCaja, cajaForm, newCajaName, cajaError, creating, onSelect, onShowForm, onNameChange, onCancel, onCreate }) {
  return (
    <div className="absolute right-0 top-11 w-60 bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden z-[200] animate-fade-in">
      {cajas.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-on-surface-variant">No hay cajas creadas.</p>
      ) : (
        cajas.map(caja => (
          <button key={caja.id} onClick={() => onSelect(caja)}
            className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-surface-container text-[13px] text-left transition-colors">
            <span className={`material-symbols-outlined text-[16px] ${selectedCaja?.id === caja.id ? 'text-secondary' : 'text-transparent'}`}>check</span>
            {caja.name}
          </button>
        ))
      )}
      <div className="border-t border-outline-variant/20">
        {!cajaForm ? (
          <button onClick={onShowForm}
            className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-surface-container text-[13px] text-secondary font-medium text-left transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>Nueva caja
          </button>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            <input autoFocus value={newCajaName} onChange={onNameChange}
              onKeyDown={e => e.key === 'Enter' && onCreate()}
              placeholder="Ej. Caja Principal"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
            {cajaError && <p className="text-error text-[11px]">{cajaError}</p>}
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

function SerieDropdown({ series, selectedSerie, serieForm, newSerie, serieError, creating, onSelect, onShowForm, onSerieChange, onCancel, onCreate }) {
  return (
    <div className="absolute right-0 top-11 w-72 bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 overflow-hidden z-[200] animate-fade-in">
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
            <span className="material-symbols-outlined text-[16px]">add</span>Nueva serie
          </button>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            <input autoFocus value={newSerie.name}
              onChange={e => onSerieChange('name', e.target.value)}
              placeholder="Nombre (ej. Principal)"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
            <div className="flex gap-2">
              <div className="flex flex-col gap-0.5 w-20">
                <span className="text-[10px] text-on-surface-variant px-0.5">Prefijo</span>
                <input value={newSerie.prefix}
                  onChange={e => onSerieChange('prefix', e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="A"
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-secondary" />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-[10px] text-on-surface-variant px-0.5">Folio inicial</span>
                <input type="number" min="1" value={newSerie.next_folio}
                  onChange={e => onSerieChange('next_folio', e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
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