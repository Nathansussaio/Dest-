/* Coordenadas dos lugares para o mapa real.
   Lugares do catálogo que ainda não têm coordenada são procurados pelo endereço no próprio celular
   (geocodificação do iPhone/Android, sem custo) e guardados no aparelho. Sugestões genéricas ficam de fora. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { Place } from '../types';
import { CITY_NAME, CITY_COORDS } from '../data';

export type LatLng = { lat: number; lng: number };
const KEY = 'desti:geo:v1';
let cache: Record<string, LatLng | null> | null = null;

async function loadCache() {
  if (cache) return cache;
  try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}'); } catch { cache = {}; }
  return cache!;
}
/* distância aproximada em km (para descartar resultados longe demais da cidade) */
function km(a: LatLng, b: LatLng) {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

export function useCoords(places: Place[]): Record<string, LatLng> {
  const [out, setOut] = useState<Record<string, LatLng>>(() => {
    const o: Record<string, LatLng> = {};
    places.forEach((p) => { if (p.lat != null && p.lng != null) o[p.id] = { lat: p.lat, lng: p.lng }; });
    return o;
  });
  const sig = places.map((p) => p.id).join(',');
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await loadCache();
      const o: Record<string, LatLng> = {};
      const missing: Place[] = [];
      places.forEach((p) => {
        if (p.lat != null && p.lng != null) o[p.id] = { lat: p.lat, lng: p.lng };
        else if (c[p.id]) o[p.id] = c[p.id]!;
        else if (!(p.id in c) && !p.demo) missing.push(p);
      });
      if (alive) setOut({ ...o });
      for (const p of missing.slice(0, 15)) {
        try {
          const city = CITY_NAME[p.city] || '';
          const r = await Location.geocodeAsync(p.name + ', ' + p.area + ', ' + city);
          const center = CITY_COORDS[p.city];
          const hit = r && r[0] ? { lat: r[0].latitude, lng: r[0].longitude } : null;
          /* resultado a mais de 80 km do centro da cidade é engano do endereço: ignora */
          c[p.id] = hit && (!center || km(hit, { lat: center[0], lng: center[1] }) < 80) ? hit : null;
        } catch { c[p.id] = null; }
        if (c[p.id]) o[p.id] = c[p.id]!;
        if (alive) setOut({ ...o });
      }
      AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
    })();
    return () => { alive = false; };
  }, [sig]);
  return out;
}
