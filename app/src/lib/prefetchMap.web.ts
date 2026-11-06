/* Site: baixa a biblioteca do mapa enquanto a pessoa olha a viagem, para o mapa abrir na hora */
let done = false;
export function prefetchMap() {
  if (done) return;
  done = true;
  const go = () => { import('leaflet').catch(() => { done = false; }); };
  const w: any = typeof window !== 'undefined' ? window : null;
  if (w && typeof w.requestIdleCallback === 'function') w.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}
