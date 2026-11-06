/* Mapa real no iPhone (Apple Maps) e no Android (Google Maps), com um marcador numerado por lugar do roteiro */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { T, Btn } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { useCoords } from '../../lib/geo';
import { plural } from '../../lib/format';
import { SchematicMap } from './SchematicMap';
import type { MapItem } from './types';

export function PlacesMap({ items, sel, onSelect, color }: { items: MapItem[]; sel: string | null; onSelect: (k: string | null) => void; color: string }) {
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
  /* tocou num lugar: aproxima nele; desmarcou: volta a mostrar todos */
  const hadSel = useRef(false);
  useEffect(() => {
    const x = pts.find((p) => p.key === sel);
    if (x && ref.current) { hadSel.current = true; const ll = coords[x.p.id]; ref.current.animateToRegion({ latitude: ll.lat, longitude: ll.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600); }
    else if (!x && hadSel.current) { hadSel.current = false; fit(); }
  }, [sel]);
  if (!pts.length) return <SchematicMap items={items} sel={sel} onSelect={onSelect} color={color} />;
  const missing = items.length - pts.length;
  return (
    <View>
      <View style={{ height: 380, borderRadius: 20, overflow: 'hidden', backgroundColor: c.soft }}>
        <MapView ref={ref} style={{ flex: 1 }} onMapReady={fit} showsPointsOfInterest={false} toolbarEnabled={false}>
          {pts.map((x) => {
            const on = x.key === sel, ll = coords[x.p.id];
            return (
              <Marker key={x.key + (on ? '-on' : '')} coordinate={{ latitude: ll.lat, longitude: ll.lng }} onPress={() => onSelect(x.key)} title={x.n + '. ' + x.p.name} description={'Dia ' + (x.di + 1) + ' · ' + x.time} tracksViewChanges={false}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: on ? c.over : color, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                  <T v="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12 }}>{String(x.n)}</T>
                </View>
              </Marker>
            );
          })}
        </MapView>
        {sel ? <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: c.card, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}><Btn sm kind="secondary" icon="map" label="Ver todos" onPress={() => onSelect(null)} /></View> : null}
      </View>
      {missing > 0 ? <T v="smallMuted" style={{ marginTop: 6 }}>{plural(missing, 'lugar ainda sem localização exata ficou', 'lugares ainda sem localização exata ficaram') + ' fora do mapa; veja na lista abaixo.'}</T> : null}
    </View>
  );
}
