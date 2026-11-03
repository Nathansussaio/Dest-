/* Mapa real no site: Leaflet com o mapa do OpenStreetMap (desenho da CARTO), grátis.
   Marcadores numerados na ordem do roteiro. Sem coordenadas ou se o mapa não carregar, mostra o mapa aproximado. */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { T } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { plural } from '../../lib/format';
import { SchematicMap } from './SchematicMap';
import type { MapItem } from './types';

const TILES_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILES_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

export function PlacesMap({ items, sel, onSelect, color }: { items: MapItem[]; sel: string | null; onSelect: (k: string) => void; color: string }) {
  const { c, isDark } = useTheme();
  const box = useRef<any>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const [failed, setFailed] = useState(!L || typeof (L as any).map !== 'function');
  const pts = items.filter((x) => x.p.lat != null && x.p.lng != null);
  const sig = pts.map((x) => x.key).join(',');

  /* cria o mapa uma vez */
  useEffect(() => {
    if (failed || !box.current || map.current || !pts.length) return;
    try {
      map.current = (L as any).map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      (L as any).tileLayer(isDark ? TILES_DARK : TILES_LIGHT, { attribution: ATTRIB, subdomains: 'abcd', maxZoom: 19 }).addTo(map.current);
      layer.current = (L as any).layerGroup().addTo(map.current);
    } catch {
      setFailed(true);
    }
    return () => { if (map.current) { map.current.remove(); map.current = null; layer.current = null; } };
  }, [failed, pts.length > 0, isDark]);

  /* marcadores e enquadramento */
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds: [number, number][] = [];
    pts.forEach((x) => {
      const on = x.key === sel;
      const html = '<div style="width:30px;height:30px;border-radius:15px;background:' + (on ? c.over : color) + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px -apple-system,Segoe UI,Roboto,sans-serif">' + x.n + '</div>';
      const icon = (L as any).divIcon({ html, className: 'desti-pin', iconSize: [30, 30], iconAnchor: [15, 15] });
      const m = (L as any).marker([x.p.lat, x.p.lng], { icon, title: x.n + '. ' + x.p.name, keyboard: true, zIndexOffset: on ? 1000 : 0 });
      m.on('click', () => onSelect(x.key));
      m.bindTooltip(x.n + '. ' + x.p.name + ' · Dia ' + (x.di + 1) + ' · ' + x.time, { direction: 'top', offset: [0, -14] });
      m.addTo(layer.current);
      bounds.push([x.p.lat as number, x.p.lng as number]);
    });
    if (bounds.length === 1) map.current.setView(bounds[0], 15);
    else if (bounds.length) map.current.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(() => { if (map.current) map.current.invalidateSize(); }, 50);
  }, [sig, sel, color, map.current]);

  if (failed || !pts.length) return <SchematicMap items={items} sel={sel} onSelect={onSelect} color={color} />;
  const missing = items.length - pts.length;
  return (
    <View>
      <View style={{ height: 420, borderRadius: 20, overflow: 'hidden', backgroundColor: c.soft }}>
        {React.createElement('div', { ref: box, style: { width: '100%', height: '100%' }, role: 'region', 'aria-label': 'Mapa com ' + plural(pts.length, 'lugar', 'lugares') + ' do roteiro' })}
      </View>
      {missing > 0 ? <T v="smallMuted" style={{ marginTop: 6 }}>{plural(missing, 'lugar ainda sem localização exata ficou', 'lugares ainda sem localização exata ficaram') + ' fora do mapa; veja na lista abaixo.'}</T> : null}
    </View>
  );
}
