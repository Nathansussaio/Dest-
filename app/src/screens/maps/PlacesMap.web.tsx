/* Mapa real no site: Leaflet com o mapa oficial do OpenStreetMap (sem chave).
   Marcadores numerados na ordem do roteiro. Sem coordenadas ou se o mapa não carregar, mostra o mapa aproximado. */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import 'leaflet/dist/leaflet.css';
import { T, Btn } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { plural } from '../../lib/format';
import { SchematicMap } from './SchematicMap';
import type { MapItem } from './types';

/* a CARTO passou a exigir chave paga; o mapa do OpenStreetMap é livre (com crédito) para uso moderado */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
/* modo escuro: escurece o desenho do mapa sem mexer nos marcadores */
function darkCss() {
  if (typeof document === 'undefined' || document.getElementById('desti-map-dark')) return;
  const st = document.createElement('style');
  st.id = 'desti-map-dark';
  st.textContent = '.desti-map-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.88) saturate(.7)}';
  document.head.appendChild(st);
}

export function PlacesMap({ items, sel, onSelect, color }: { items: MapItem[]; sel: string | null; onSelect: (k: string | null) => void; color: string }) {
  const { c, isDark } = useTheme();
  const box = useRef<any>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const marks = useRef<Record<string, any>>({});
  /* o Leaflet só é baixado quando o mapa abre (deixa o site mais leve) */
  const [L, setLeaflet] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [tilesOk, setTiles] = useState(false);
  /* o mapa já existe (dispara o enquadramento e os marcadores sem depender de outra atualização da tela) */
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let alive = true;
    import('leaflet').then((m: any) => { const lib = m && (m.default || m); if (!alive) return; if (lib && typeof lib.map === 'function') setLeaflet(lib); else setFailed(true); }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);
  const pts = items.filter((x) => x.p.lat != null && x.p.lng != null);
  const sig = pts.map((x) => x.key).join(',');

  /* cria o mapa uma vez */
  useEffect(() => {
    if (failed || !L || !box.current || map.current || !pts.length) return;
    try {
      map.current = (L as any).map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      darkCss();
      const tl = (L as any).tileLayer(TILES, { attribution: ATTRIB, maxZoom: 19, crossOrigin: '', keepBuffer: 3, updateWhenZooming: false });
      tl.once('load', () => setTiles(true));
      tl.addTo(map.current);
      layer.current = (L as any).layerGroup().addTo(map.current);
      setReady((n) => n + 1);
    } catch {
      setFailed(true);
    }
    return () => { if (map.current) { map.current.remove(); map.current = null; layer.current = null; } };
  }, [failed, L, pts.length > 0, isDark]);

  /* enquadra todos os lugares (ao abrir, ao trocar de dia e ao tocar em "Ver todos") */
  const fitAll = (animate: boolean) => {
    if (!map.current) return;
    const bounds: [number, number][] = pts.map((x) => [x.p.lat as number, x.p.lng as number]);
    if (bounds.length === 1) map.current.setView(bounds[0], 15, { animate });
    else if (bounds.length) map.current.fitBounds(bounds, { padding: [40, 40], animate });
  };

  /* marcadores */
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    marks.current = {};
    pts.forEach((x) => {
      const on = x.key === sel;
      const size = on ? 38 : 30;
      const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:' + size / 2 + 'px;background:' + (on ? c.over : color) + ';border:' + (on ? 3 : 2) + 'px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,' + (on ? '.45' : '.3') + ');display:flex;align-items:center;justify-content:center;color:#fff;font:700 ' + (on ? 14 : 12) + 'px -apple-system,Segoe UI,Roboto,sans-serif">' + x.n + '</div>';
      const icon = (L as any).divIcon({ html, className: 'desti-pin', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const m = (L as any).marker([x.p.lat, x.p.lng], { icon, title: x.n + '. ' + x.p.name, keyboard: true, zIndexOffset: on ? 1000 : 0 });
      m.on('click', () => onSelect(x.key));
      m.bindTooltip(x.n + '. ' + x.p.name + ' · Dia ' + (x.di + 1) + ' · ' + x.time, { direction: 'top', offset: [0, -size / 2 + 1] });
      m.addTo(layer.current);
      marks.current[x.key] = m;
    });
    const t = marks.current[sel || ''];
    if (t) t.openTooltip();
  }, [sig, sel, color, ready]);

  /* troca de dia (ou mapa recém-criado): mostra todos */
  useEffect(() => {
    if (!map.current) return;
    fitAll(false);
    setTimeout(() => { if (map.current) map.current.invalidateSize(); }, 50);
  }, [sig, ready]);

  /* tocou num lugar (na lista ou no mapa): aproxima nele; desmarcou: volta a mostrar todos */
  const hadSel = useRef(false);
  useEffect(() => {
    if (!map.current) return;
    const x = pts.find((p) => p.key === sel);
    if (x) {
      hadSel.current = true;
      map.current.flyTo([x.p.lat, x.p.lng], Math.max(map.current.getZoom() || 0, 16), { duration: 0.8 });
      /* no celular a lista fica embaixo do mapa: rola até o mapa se ele estiver fora da tela */
      const el = box.current;
      if (el && typeof el.getBoundingClientRect === 'function') {
        const r = el.getBoundingClientRect(), h = window.innerHeight || 0;
        if (r.top < 0 || r.bottom > h) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (hadSel.current) { hadSel.current = false; fitAll(true); }
  }, [sel, ready]);

  if (failed || !pts.length) return <SchematicMap items={items} sel={sel} onSelect={onSelect} color={color} />;
  const missing = items.length - pts.length;
  return (
    <View>
      <View style={{ height: 420, borderRadius: 20, overflow: 'hidden', backgroundColor: c.soft }}>
        {sel ? <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 900, backgroundColor: c.card, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}><Btn sm kind="secondary" icon="map" label="Ver todos" onPress={() => onSelect(null)} /></View> : null}
        {!tilesOk ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 500 }}><T v="smallMuted">Carregando o mapa…</T></View> : null}
        {React.createElement('div', { ref: box, style: { width: '100%', height: '100%' }, className: isDark ? 'desti-map-dark' : undefined, role: 'region', 'aria-label': 'Mapa com ' + plural(pts.length, 'lugar', 'lugares') + ' do roteiro' })}
      </View>
      {missing > 0 ? <T v="smallMuted" style={{ marginTop: 6 }}>{plural(missing, 'lugar ainda sem localização exata ficou', 'lugares ainda sem localização exata ficaram') + ' fora do mapa; veja na lista abaixo.'}</T> : null}
    </View>
  );
}
