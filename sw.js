/* Destí: modo offline do site.
   - Páginas: tenta a internet primeiro; sem conexão, abre a última versão guardada (qualquer endereço do app).
   - Arquivos do app (_expo/static, com nome único a cada publicação): guardados na primeira vez e servidos do cache.
   - Outros arquivos do site (ícones, páginas legais): mostra o guardado e atualiza por trás.
   - Nada de outros endereços (Supabase, mapa, clima, cotação) passa pelo cache. */
const VERSION = '19604b369df9';
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
  if (url.origin !== self.location.origin || url.pathname.indexOf(BASE) !== 0) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
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
