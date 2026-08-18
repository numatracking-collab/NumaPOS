/* ═══════════════════════════════════════════════════════════════════════════
   useProductCatalog.js
   ───────────────────────────────────────────────────────────────────────────
   Hook que gestiona el catálogo con caché local y sincronización automática
   entre dispositivos distintos (PC de inventario ↔ celular de ventas).

   Flujo:
   1. Carga desde localStorage al instante (0ms).
   2. Refresca desde la API en segundo plano al montar.
   3. Cada 30s hace polling a GET /products/version (query ultrabarata:
      solo COUNT + MAX(id) + MAX(updated_at), sin traer productos).
      Si el hash cambió → recarga el catálogo completo en segundo plano.
      Si es igual → no hace nada.
   4. Al volver a la pestaña/app → verifica versión inmediatamente.
   5. invalidate() → refresco inmediato (misma pestaña, tras venta).

   Detecta cambios en:
   - Producto creado   → COUNT sube
   - Producto eliminado → COUNT baja
   - Producto editado  → MAX(updated_at) cambia (el PUT ahora hace updated_at = NOW())
   - Venta completada  → invalida localmente (mismo dispositivo)
   ═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryService, offersService } from '../services/api';

const CACHE_KEY         = 'numa_catalog_products';
const CACHE_OFFERS_KEY  = 'numa_catalog_offers';
const CACHE_VERSION_KEY = 'numa_catalog_version';
const CACHE_TS_KEY      = 'numa_catalog_ts';
const POLL_INTERVAL_MS  = 30_000;       // 30 segundos
const CACHE_TTL_MS      = 5 * 60_000;  // 5 minutos — refresco forzado

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

function readCache(key) {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function writeCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* noop */ }
}

/* ═══════════════════════════════════════════════════════════════════════════
   useProductCatalog
   ═══════════════════════════════════════════════════════════════════════════ */
export function useProductCatalog() {
    const cachedProducts = readCache(CACHE_KEY);
    const cachedOffers   = readCache(CACHE_OFFERS_KEY);

    const [products,   setProducts]   = useState(cachedProducts ?? []);
    const [offers,     setOffers]     = useState(cachedOffers   ?? []);
    const [loading,    setLoading]    = useState(!cachedProducts);
    const [refreshing, setRefreshing] = useState(false);
    const [error,      setError]      = useState(null);

    const isMounted      = useRef(true);
    const knownVersion   = useRef(readCache(CACHE_VERSION_KEY) ?? '');
    const isRefreshing   = useRef(false); // evita refrescos paralelos

    useEffect(() => () => { isMounted.current = false; }, []);

    /* ── Refresco completo ────────────────────────────────────────────────── */
    const refresh = useCallback(async (showSpinner = false) => {
        if (isRefreshing.current) return;
        isRefreshing.current = true;
        if (showSpinner) setRefreshing(true);
        setError(null);

        try {
            const [freshProducts, freshOffers] = await Promise.all([
                inventoryService.getAll(),
                offersService.getAll({ status: 'active' }).catch(() => []),
            ]);

            if (!isMounted.current) return;

            const prods = Array.isArray(freshProducts) ? freshProducts : [];
            const offs  = Array.isArray(freshOffers)   ? freshOffers   : [];

            setProducts(prods);
            setOffers(offs);
            writeCache(CACHE_KEY,        prods);
            writeCache(CACHE_OFFERS_KEY, offs);
            writeCache(CACHE_TS_KEY,     Date.now());

        } catch (err) {
            if (!isMounted.current) return;
            if (!cachedProducts) setError('No se pudo cargar el catálogo. Verifica tu conexión.');
            console.warn('[Catalog] Error al refrescar:', err.message);
        } finally {
            isRefreshing.current = false;
            if (isMounted.current) { setLoading(false); setRefreshing(false); }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Verificar versión (polling barato) ──────────────────────────────── */
    const checkVersion = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/products/version`, {
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('numa_token')}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok) return;

            const { version } = await res.json();

            if (version && version !== knownVersion.current) {
                console.info(`[Catalog] Cambio detectado (${knownVersion.current || 'sin versión'} → ${version})`);
                knownVersion.current = version;
                writeCache(CACHE_VERSION_KEY, version);
                await refresh(true);
            }
        } catch { /* sin internet — falla silenciosamente */ }
    }, [refresh]);

    /* ── invalidate: refresco forzado inmediato ──────────────────────────── */
    const invalidate = useCallback(() => {
        knownVersion.current = '';
        writeCache(CACHE_VERSION_KEY, '');
        refresh(true);
    }, [refresh]);

    /* ── Carga inicial ───────────────────────────────────────────────────── */
    useEffect(() => {
        const age = Date.now() - (readCache(CACHE_TS_KEY) ?? 0);
        if (!cachedProducts || age > CACHE_TTL_MS) {
            refresh(!cachedProducts);
        } else {
            checkVersion(); // caché fresco: solo verificar si cambió algo
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Polling periódico ───────────────────────────────────────────────── */
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') checkVersion();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [checkVersion]);

    /* ── Refresco al volver a la pestaña / app ────────────────────────────── */
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') checkVersion();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [checkVersion]);

    /* ── Escuchar invalidación local (misma pestaña) ─────────────────────── */
    useEffect(() => {
        const handler = () => invalidate();
        window.addEventListener('catalog:invalidate', handler);
        return () => window.removeEventListener('catalog:invalidate', handler);
    }, [invalidate]);

    return { products, offers, loading, refreshing, error, invalidate };
}

/* ═══════════════════════════════════════════════════════════════════════════
   invalidateCatalog — llamar desde InventoryPage tras guardar/eliminar
   ═══════════════════════════════════════════════════════════════════════════ */
export function invalidateCatalog() {
    window.dispatchEvent(new CustomEvent('catalog:invalidate'));
    // Resetear versión para que otros dispositivos detecten en su próximo poll
    try { localStorage.setItem(CACHE_VERSION_KEY, ''); } catch { /* noop */ }
}