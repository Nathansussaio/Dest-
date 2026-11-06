/* Destí: modo offline do site.
   - Páginas: tenta a internet primeiro; sem conexão, abre a última versão guardada (qualquer endereço do app).
   - Arquivos do app (_expo/static, com nome único a cada publicação): guardados na primeira vez e servidos do cache.
   - Outros arquivos do site (ícones, páginas legais): mostra o guardado e atualiza por trás.
   - Desenhos do mapa (OpenStreetMap): guardados no aparelho por até 14 dias; quem volta ao mapa não espera de novo.
   - Nada de outros endereços (Supabase, clima, cotação) passa pelo cache. */
const TILES = 'mapa-osm-v1', TILE_MAX = 1500, TILE_DAYS = 14;
let tileWrites = 0;
function tile(req) {
  return caches.open(TILES).then((c) => c.match(req).then((hit) => {
    const fresh = hit && Date.now() - Number(hit.headers.get('x-desti-at') || 0) < TILE_DAYS * 864e5;
    if (fresh) return hit;
    return fetch(req).then((res) => {
      if (res && res.ok) {
        res.clone().blob().then((b) => {
          const h = new Headers(res.headers); h.set('x-desti-at', String(Date.now()));
          c.put(req, new Response(b, { status: 200, headers: h }));
          if (++tileWrites % 100 === 0) c.keys().then((ks) => { const extra = ks.length - TILE_MAX; for (let i = 0; i < extra; i++) c.delete(ks[i]); });
        }).catch(() => {});
      }
      return res;
    }).catch(() => hit || Response.error());
  }));
}
const VERSION = '6abdf1cf9714';
const CACHE = 'desti-' + VERSION;
const BASE = new URL(self.registration.scope).pathname;
const SHELL = [BASE, BASE + 'manifest.json', BASE + 'favicon.png', BASE + 'icon-192.png', BASE + 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf('desti-') === 0 && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tile.openstreetmap.org' && req.mode === 'cors') { e.respondWith(tile(req)); return; }
  if (url.origin !== self.location.origin || url.pathname.indexOf(BASE) !== 0) return;
  if (req.mode === 'navigate') {
    /* sempre confere com o servidor se há versão nova (sem usar a cópia de até 10 minutos do navegador) */
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(BASE, copy)); }
      return res;
    }).catch(() => caches.match(BASE).then((r) => r || caches.match(req))));
    return;
  }
  if (url.pathname.indexOf(BASE + '_expo/static/') === 0) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
