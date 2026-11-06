/* Busca a localização real (OpenStreetMap / Nominatim) dos lugares que ainda não têm latitude e longitude.
   Uso: node tools/geocode.mjs  →  grava tools/geocode-out.json (não muda o catálogo; a revisão é manual).
   Respeita a regra do Nominatim: no máximo 1 consulta por segundo e identificação do app. */
import fs from 'fs';
const dir = new URL('../src/data/', import.meta.url);
const places = JSON.parse(fs.readFileSync(new URL('places.json', dir)));
const centers = JSON.parse(fs.readFileSync(new URL('cities.json', dir)));
const UA = 'Desti-geocode/1.0 (+https://github.com/Nathansussaio/Dest-)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
let last = 0;
async function search(q, c, span, bounded) {
  const wait = 1100 - (Date.now() - last); if (wait > 0) await sleep(wait); last = Date.now();
  const vb = [c[1] - span, c[0] + span, c[1] + span, c[0] - span].join(',');
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt,es,en&q=' + encodeURIComponent(q) + '&viewbox=' + vb + '&bounded=' + (bounded ? 1 : 0);
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) { const j = await r.json(); return j[0] || null; } } catch {}
    await sleep(3000);
  }
  return null;
}
const out = {};
const todo = places.filter((p) => p.lat == null && centers[p.city]);
console.log('lugares sem localização:', todo.length);
let n = 0;
for (const p of todo) {
  const c = centers[p.city];
  const first = p.name.split(/ e | & | \/ | - |, /)[0].trim();
  const tries = [[p.name, 0.35, 'exato'], ...(first !== p.name ? [[first, 0.35, 'exato']] : []), [p.name, 2.5, 'longe'], [p.area, 0.35, 'bairro']];
  let got = null;
  for (const [q, span, how] of tries) {
    if (!q) continue;
    const r = await search(q, c, span, true);
    if (r) { const pt = [+(+r.lat).toFixed(5), +(+r.lon).toFixed(5)]; got = { lat: pt[0], lng: pt[1], how, km: Math.round(km(c, pt) * 10) / 10, osm: r.display_name.slice(0, 120), type: r.type }; break; }
  }
  out[p.id] = got || { how: 'nada' };
  n++;
  if (n % 25 === 0) { console.log(n + '/' + todo.length); fs.writeFileSync(new URL('./geocode-out.json', import.meta.url), JSON.stringify(out, null, 1)); }
}
fs.writeFileSync(new URL('./geocode-out.json', import.meta.url), JSON.stringify(out, null, 1));
const cnt = {}; Object.values(out).forEach((x) => { cnt[x.how] = (cnt[x.how] || 0) + 1; });
console.log('pronto', cnt);
