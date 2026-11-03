/* Mapa esquemático (posição relativa dos lugares): usado na web e quando a cidade ainda não tem coordenadas */
import React from 'react';
import { View, Pressable } from 'react-native';
import { T } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { tint } from '../../data';
import { plural } from '../../lib/format';
import type { MapItem } from './types';

export function SchematicMap({ items, sel, onSelect, color }: { items: MapItem[]; sel: string | null; onSelect: (k: string) => void; color: string }) {
  const { c } = useTheme();
  /* enquadra os lugares: o centro é a mediana e lugares muito longe (bate-voltas) ficam presos na borda */
  const med = (a: number[]) => { const o = a.slice().sort((x, y) => x - y); return o.length ? o[Math.floor(o.length / 2)] : 50; };
  const cx = med(items.map((x) => x.p.x)), cy = med(items.map((x) => x.p.y));
  const dist = items.map((x) => Math.max(Math.abs(x.p.x - cx), Math.abs(x.p.y - cy)));
  const typical = med(dist) || 1;
  const span = Math.max(4, ...dist.filter((d) => d <= typical * 3));
  const sc = 42 / span;
  const pos = (v: number, c0: number) => Math.max(5, Math.min(95, 50 + (v - c0) * sc));
  return (
    <View>
      <View style={{ height: 340, borderRadius: 20, backgroundColor: tint(color, 0.9), overflow: 'hidden' }} accessibilityLabel={'Mapa com ' + plural(items.length, 'lugar', 'lugares')}>
        {[20, 40, 60, 80].map((g) => <View key={'h' + g} style={{ position: 'absolute', left: 0, right: 0, top: g + '%', height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        {[20, 40, 60, 80].map((g) => <View key={'v' + g} style={{ position: 'absolute', top: 0, bottom: 0, left: g + '%', width: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />)}
        {items.map((x) => {
          const on = x.key === sel;
          return (
            <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={x.n + '. ' + x.p.name + ', Dia ' + (x.di + 1)} onPress={() => onSelect(x.key)}
              style={{ position: 'absolute', left: pos(x.p.x, cx) + '%', top: pos(x.p.y, cy) + '%', marginLeft: -15, marginTop: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: on ? c.over : color, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: on ? 3 : 1 }}>
              <T v="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12 }}>{String(x.n)}</T>
            </Pressable>
          );
        })}
        {!items.length ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><T v="muted">Nenhum lugar no roteiro destes dias</T></View> : null}
      </View>
      <T v="smallMuted" style={{ marginTop: 6 }}>Posição aproximada dos lugares. Toque num lugar para abrir a rota no app de mapas.</T>
    </View>
  );
}
