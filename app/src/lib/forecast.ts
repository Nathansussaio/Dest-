/* Previsão do tempo real (Open-Meteo, grátis e sem chave): até 16 dias à frente.
   Antes disso, o app mostra o clima típico do mês (src/lib/climate.ts). */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip } from '../types';
import { CITY_COORDS } from '../data';
import { iso, addDays, parseD } from './format';
import { cityOfDay } from './trip';

import { forecastWindow, forecastUrl, parseForecast, type DayForecast } from './forecastCore';
export { wmo, forecastWindow, parseForecast, type DayForecast } from './forecastCore';

const mem: Record<string, { t: number; days: DayForecast[] }> = {};
const SIX_HOURS = 6 * 3600 * 1000;
async function cityForecast(cityId: string, from: string, to: string): Promise<DayForecast[]> {
  const c = CITY_COORDS[cityId];
  if (!c) return [];
  const key = 'desti:wx:' + cityId + ':' + from + ':' + to;
  const hit = mem[key];
  if (hit && Date.now() - hit.t < SIX_HOURS) return hit.days;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) { const j = JSON.parse(raw); if (Date.now() - j.t < SIX_HOURS) { mem[key] = j; return j.days; } }
  } catch { /* sem cache */ }
  try {
    const r = await fetch(forecastUrl(c[0], c[1], from, to));
    if (!r.ok) return [];
    const days = parseForecast(await r.json());
    mem[key] = { t: Date.now(), days };
    AsyncStorage.setItem(key, JSON.stringify(mem[key])).catch(() => {});
    return days;
  } catch { return []; }
}

/* Previsão de cada dia da viagem (na cidade em que a viagem está naquele dia), por data */
export function useForecast(t: Trip | null): Record<string, DayForecast> | null {
  const [byDate, setByDate] = useState<Record<string, DayForecast> | null>(null);
  const sig = t ? t.id + t.start + t.end + JSON.stringify(t.legs || t.destId) : '';
  useEffect(() => {
    let alive = true;
    setByDate(null);
    if (!t) return;
    const w = forecastWindow(t.start, t.end);
    if (!w) return;
    const cities: Record<string, string[]> = {};
    for (let d = parseD(w.from); iso(d) <= w.to; d = addDays(d, 1)) {
      const i = Math.round((d.getTime() - parseD(t.start).getTime()) / 86400000);
      const city = cityOfDay(t, i);
      (cities[city] = cities[city] || []).push(iso(d));
    }
    Promise.all(Object.keys(cities).map(async (city) => {
      const dates = cities[city];
      const days = await cityForecast(city, dates[0], dates[dates.length - 1]);
      return days.filter((x) => dates.indexOf(x.date) >= 0);
    })).then((lists) => {
      if (!alive) return;
      const out: Record<string, DayForecast> = {};
      lists.forEach((l) => l.forEach((x) => { out[x.date] = x; }));
      setByDate(Object.keys(out).length ? out : null);
    });
    return () => { alive = false; };
  }, [sig]);
  return byDate;
}
