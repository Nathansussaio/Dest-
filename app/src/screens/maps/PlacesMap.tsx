/* Mapa real no iPhone (Apple Maps) e no Android (Google Maps), com um marcador numerado por lugar do roteiro */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { T } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { useCoords } from '../../lib/geo';
import { plural } from '../../lib/format';
import { SchematicMap } from './SchematicMap';
import type { MapItem } from './types';

export function PlacesMap({ items, sel, onSelect, color }: { items: MapItem[]; sel: string | null; onSelect: (k: string) => void; color: string }) {
  const { c } = useTheme();
  const coords = useCoords(items.map((x) => x.p));
  const pts = items.filter((x) => coords[x.p.id]);
  const ref = useRef<any>(null);
  const sig = pts.map((x) => x.key).join(',');
  const fit = () => {
    if (!ref.current || !pts.length) return;
    ref.current.fitToCoordinates(pts.map((x) => ({ latitude: coords[x.p.id].lat, longitude: coords[x.p.id].lng })), { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: false });
  };
  useEffect(() => { const t = setTimeout(fit, 250); return () => clearTimeout(t); }, [sig]);
  if (!pts.length) return <SchematicMap items={items} sel={sel} onSelect={onSelect} color={color} />;
  const missing = items.length - pts.length;
  return (
    <View>
      <View style={{ height: 380, borderRadius: 20, overflow: 'hidden', backgroundColor: c.soft }}>
        <MapView ref={ref} style={{ flex: 1 }} onMapReady={fit} showsPointsOfInterest={false} toolbarEnabled={false}>
          {pts.map((x) => {
            const on = x.key === sel, ll = coords[x.p.id];
            return (
              <Marker key={x.key} coordinate={{ latitude: ll.lat, longitude: ll.lng }} onPress={() => onSelect(x.key)} title={x.n + '. ' + x.p.name} description={'Dia ' + (x.di + 1) + ' · ' + x.time} tracksViewChanges={false}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: on ? c.over : color, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <T v="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12 }}>{String(x.n)}</T>
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>
      {missing > 0 ? <T v="smallMuted" style={{ marginTop: 6 }}>{plural(missing, 'lugar ainda sem localização exata ficou', 'lugares ainda sem localização exata ficaram') + ' fora do mapa; veja na lista abaixo.'}</T> : null}
    </View>
  );
}
