/* Viagem: períodos, status, cidades por dia, moeda */
import type { Trip, Leg, ItineraryItem } from '../types';
import { lookupDest, destName, PLACE_BY_ID, BUDGET_CATS, EURO_COUNTRIES, USD_COUNTRIES } from '../data';
import { parseD, today0, diffDays, MES, uid } from './format';

export function periodLabel(t: Trip): string {
  const a = parseD(t.start), b = parseD(t.end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return a.getDate() + '–' + b.getDate() + ' ' + MES[a.getMonth()] + ' ' + a.getFullYear();
  return a.getDate() + ' ' + MES[a.getMonth()] + ' – ' + b.getDate() + ' ' + MES[b.getMonth()] + ' ' + b.getFullYear();
}
export function periodShort(t: Trip): string {
  const a = parseD(t.start), b = parseD(t.end);
  if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + MES[a.getMonth()];
  return a.getDate() + ' ' + MES[a.getMonth()] + '–' + b.getDate() + ' ' + MES[b.getMonth()];
}
export function tripStatus(t: Trip): { key: 'next' | 'past'; countdown: string } {
  const now = today0(), a = parseD(t.start), b = parseD(t.end);
  if (now < a) { const n = diffDays(now, a); return { key: 'next', countdown: n === 1 ? 'Amanhã' : 'Faltam ' + n + ' dias' }; }
  if (now <= b) return { key: 'next', countdown: 'Em andamento' };
  return { key: 'past', countdown: 'Concluída' };
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return items.slice().sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
export function nextTime(items: ItineraryItem[]): string {
  if (!items.length) return '10:00';
  const last = sortItems(items)[items.length - 1].time.split(':');
  const h = Math.min(+last[0] + 2, 21);
  return String(h).padStart(2, '0') + ':' + last[1];
}
export function itemName(x: ItineraryItem): string { return x.kind === 'place' && x.placeId ? (PLACE_BY_ID[x.placeId] ? PLACE_BY_ID[x.placeId].name : 'Lugar') : (x.text || ''); }

export const pl = (time: string, placeId: string): ItineraryItem => ({ id: uid(), time, kind: 'place', placeId });
export const mv = (time: string, text: string): ItineraryItem => ({ id: uid(), time, kind: 'move', text });
export const nt = (time: string, text: string): ItineraryItem => ({ id: uid(), time, kind: 'note', text });

export function splitBudget(total: number): Record<string, number> {
  const plan: Record<string, number> = {};
  BUDGET_CATS.forEach((c) => { plan[c.id] = Math.round(total * c.share); });
  return plan;
}

/* ---------- Viagens com várias cidades ---------- */
export function tripLegs(t: Trip): Leg[] { return t.legs && t.legs.length ? t.legs : [{ destId: t.destId, name: t.name, days: t.days.length }]; }
export function isMultiCity(t: Trip): boolean { return !!(t.legs && t.legs.length > 1); }
export function legOfDay(t: Trip, i: number): { leg: Leg; k: number; i: number; isLast: boolean } {
  const legs = tripLegs(t);
  let acc = 0;
  for (let k = 0; k < legs.length; k++) {
    if (i < acc + legs[k].days) return { leg: legs[k], k, i: i - acc, isLast: k === legs.length - 1 };
    acc += legs[k].days;
  }
  const L = legs[legs.length - 1];
  return { leg: L, k: legs.length - 1, i: Math.max(0, i - (acc - L.days)), isLast: true };
}
export function cityOfDay(t: Trip, i: number): string { return legOfDay(t, i).leg.destId; }
export function legName(L: Leg): string { return L.name || destName(L.destId); }
export function legNameOfDay(t: Trip, i: number): string { return legName(legOfDay(t, i).leg); }
export function legDayArgs(t: Trip, i: number) {
  const L = legOfDay(t, i);
  return { city: L.leg.destId, i: L.i, n: L.isLast ? L.leg.days : L.leg.days + 1, k: L.k };
}
export function fitLegs(legs: Leg[], n: number): Leg[] {
  const out = legs.map((l) => ({ ...l }));
  const total = out.reduce((a, l) => a + l.days, 0);
  out[out.length - 1].days += n - total;
  while (out.length > 1 && out[out.length - 1].days < 1) { const gone = out.pop()!; out[out.length - 1].days += gone.days; }
  if (out[0].days < 1) out[0].days = 1;
  return out;
}
export function legsTitle(legs: Leg[]): string {
  const ns = legs.map(legName).filter((x, i, a) => a.indexOf(x) === i);
  if (ns.length === 2) return ns.join(' e ');
  if (ns.length === 3) return ns[0] + ', ' + ns[1] + ' e ' + ns[2];
  if (ns.length === 4) return ns[0] + ', ' + ns[1] + ', ' + ns[2] + ' e ' + ns[3];
  if (ns.length > 4) return ns[0] + ' e mais ' + (ns.length - 1) + ' cidades';
  return ns[0];
}
export function legsCountry(legs: Leg[]): string {
  const cs = legs.map((l) => { const d = lookupDest(l.destId); return d ? (d.kind === 'country' ? d.name : d.country) : ''; })
    .filter((x, i, a) => x && a.indexOf(x) === i);
  return cs.length <= 1 ? (cs[0] || 'Destino personalizado') : cs.length === 2 ? cs.join(' e ') : cs.length + ' países';
}
export function styleLabel(t: Trip): string { return (t.styles && t.styles.length ? t.styles : ['Cultural']).join(' + '); }

/* Moeda sugerida para um gasto: a do país em que a viagem está naquele dia */
export function tripCurrency(t: Trip, dayIdx: number): 'BRL' | 'EUR' | 'USD' {
  const d = lookupDest(cityOfDay(t, dayIdx || 0));
  const c = d ? (d.kind === 'country' ? d.name : d.country) : '';
  return EURO_COUNTRIES.indexOf(c) >= 0 ? 'EUR' : USD_COUNTRIES.indexOf(c) >= 0 ? 'USD' : 'BRL';
}
