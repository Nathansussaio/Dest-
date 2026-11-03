/* Gerador de roteiro por estilo
   1. Cada dia tem períodos conforme o ritmo; o 1º e o último dia são mais leves.
   2. Em cada período, escolhe o lugar ainda não usado que mais combina com o estilo do dia,
      que funciona naquele período, que abre naquele dia da semana e que fica perto do anterior.
   3. Com dois estilos, os dias se alternam entre o principal e o secundário.
   4. Destinos fora do catálogo começam com o roteiro em branco. */
import type { Place, Slot, Style, PaceId, ItineraryItem, Trip } from '../types';
import { PLACES, PACE_BY_ID, PACES, SLOT_TIME, SLOT_FALLBACK, REPEATABLE, CITY_NAME, hasCatalog, PLACE_BY_ID } from '../data';
import { pl, nt, sortItems, tripLegs, legName } from './trip';
import { addDays, parseD } from './format';

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
/* Distância real em km quando há coordenadas; senão, escala aproximada do mapa ilustrativo */
export function kmBetween(a: Place, b: Place): number {
  if (a.lat != null && b.lat != null && a.lng != null && b.lng != null) {
    const R = 6371, toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  return distance(a, b) * 0.12;
}

export function slotsForDay(pace: PaceId, i: number, n: number): Slot[] {
  const all = (PACE_BY_ID[pace] || PACES[1]).slots;
  if (n <= 1) return all.filter((x) => x !== 'noite');
  if (i === 0) return all.filter((x) => x === 'tarde' || x === 'fimtarde' || x === 'noite');
  if (i === n - 1) return all.filter((x) => x === 'manha' || x === 'almoco');
  return all;
}
export function slotOfTime(t: string): Slot {
  const h = +String(t || '12:00').split(':')[0];
  return h < 11 ? 'manha' : h < 14 ? 'almoco' : h < 17 ? 'tarde' : h < 19 ? 'fimtarde' : 'noite';
}

export interface RankOpts { allowFullDay?: boolean; dayUsed?: Record<string, boolean>; allowRepeat?: boolean; wd?: number | null }
export type Used = Record<string, number>;

export function rankCandidates(cityId: string, styles: Style[], slot: Slot, used: Used, prev: Place | null, opts: RankOpts = {}) {
  const meal = slot === 'almoco' || slot === 'noite';
  const out: { p: Place; score: number }[] = [];
  PLACES.forEach((p) => {
    if (p.city !== cityId || !p.styles.length) return;
    if (opts.dayUsed && opts.dayUsed[p.id]) return;
    if (opts.wd != null && p.closed && p.closed.indexOf(opts.wd) >= 0) return; /* fechado nesse dia */
    if (used[p.id] && !(opts.allowRepeat && REPEATABLE.indexOf(p.cat) >= 0 && used[p.id] < 2)) return;
    if (p.fullDay && !opts.allowFullDay) return;
    const lateVisit = slot === 'fimtarde' && (p.cat === 'museu' || p.cat === 'atracao');
    const slotScore = p.slots.indexOf(slot) >= 0 ? 2 : (!lateVisit && SLOT_FALLBACK[slot].some((f) => p.slots.indexOf(f) >= 0) ? 1 : 0);
    if (!slotScore) return;
    let styleScore = p.styles.indexOf(styles[0]) >= 0 ? 3 : (styles.some((st) => p.styles.indexOf(st) >= 0) ? 2 : 0);
    if (meal && (p.cat === 'restaurante' || p.cat === 'cafe')) styleScore = Math.max(styleScore, 1.5);
    if (meal && styles.indexOf('Gastronômica') >= 0 && p.styles.indexOf('Gastronômica') >= 0) styleScore += 1;
    if (!styleScore) styleScore = 0.5;
    const score = styleScore * 30 + slotScore * 20 - (prev ? distance(p, prev) * 0.8 : 0) - (p.fullDay ? 25 : 0) - (used[p.id] ? 40 * used[p.id] : 0);
    out.push({ p, score });
  });
  return out.sort((a, b) => b.score - a.score);
}

import { intercity } from './intercity';
const MODE_VIA: Record<string, string> = { aviao: 'de avião', trem: 'de trem', 'trem-noturno': 'de trem noturno', onibus: 'de ônibus', barco: 'de barco', carro: 'de carro' };

export function buildDay(cityId: string, styles: Style[], pace: PaceId, i: number, n: number, used: Used, wd: number | null = null): ItineraryItem[] {
  if (!hasCatalog(cityId)) return [];
  const slots = slotsForDay(pace, i, n);
  const items: ItineraryItem[] = [];
  let prev: Place | null = null, stop = false;
  const dayUsed: Record<string, boolean> = {};
  if (n > 1 && i === 0) items.push(nt('13:00', 'Chegada e check-in'));
  slots.forEach((slot) => {
    if (stop) return;
    const opts: RankOpts = { allowFullDay: slot === 'manha' && i > 0 && i < n - 1, dayUsed, wd };
    let ranked = rankCandidates(cityId, styles, slot, used, prev, opts);
    if (!ranked.length) ranked = rankCandidates(cityId, styles, slot, used, prev, { ...opts, allowRepeat: true });
    if (!ranked.length) return;
    const best = ranked[0].p;
    items.push(pl(SLOT_TIME[slot], best.id));
    used[best.id] = (used[best.id] || 0) + 1;
    dayUsed[best.id] = true;
    prev = best;
    if (best.fullDay) stop = true;
  });
  if (!items.some((x) => x.kind === 'place') && !(n > 1 && i === n - 1)) items.push(nt('10:00', 'Dia livre em ' + (CITY_NAME[cityId] || 'cidade') + ': explore um bairro novo sem pressa ou volte ao seu lugar favorito'));
  if (n > 1 && i === n - 1) items.push(nt('15:00', 'Check-out e deslocamento para a volta'));
  return sortItems(items);
}

export function rotateStyles(styles: Style[], i: number): Style[] { return styles.length > 1 && i % 2 === 1 ? [styles[1], styles[0]] : styles.slice(); }

/* Monta a viagem inteira (todas as cidades). keepDays: dias que ficam como estão (null = montar) */
export function generateTripPlan(t: Trip, styles?: Style[] | null, keepDays?: (ItineraryItem[] | null)[] | null): ItineraryItem[][] {
  const legs = tripLegs(t), used: Used = {}, st = styles && styles.length ? styles : (['Cultural'] as Style[]), days: ItineraryItem[][] = [];
  (keepDays || []).forEach((d) => { (d || []).forEach((x) => { if (x.placeId) used[x.placeId] = 1; }); });
  let g = 0;
  legs.forEach((L, k) => {
    const nEff = k === legs.length - 1 ? L.days : L.days + 1;
    for (let i = 0; i < L.days; i++, g++) {
      if (keepDays && keepDays[g]) { days.push(keepDays[g]!); continue; }
      let items = buildDay(L.destId, rotateStyles(st, g), t.pace || 'equilibrado', i, nEff, used, t.start ? addDays(parseD(t.start), g).getDay() : null);
      if (k > 0 && i === 0) {
        const how = intercity(legs[k - 1].destId, L.destId).options[0];
        const travel = 'Viagem de ' + legName(legs[k - 1]) + ' para ' + legName(L) + (how ? ' ' + MODE_VIA[how.mode] : '') + ' · check-in';
        items = items.length ? items.map((x) => (x.text === 'Chegada e check-in' ? { ...x, text: travel } : x)) : [nt('10:00', travel)];
      }
      days.push(items);
    }
  });
  return days;
}

/* Reorganiza um dia: refeições e noite ficam onde estão; as visitas seguem a ordem de quem está mais perto */
export function reorderDay(day: ItineraryItem[]): { changed: boolean; items: ItineraryItem[]; n: number } {
  const items = sortItems(day), FIX = ['restaurante', 'cafe', 'noite'];
  const movable = items.filter((x) => x.kind === 'place' && x.placeId && PLACE_BY_ID[x.placeId] && FIX.indexOf(PLACE_BY_ID[x.placeId].cat) < 0 && !PLACE_BY_ID[x.placeId].fullDay);
  if (movable.length < 3) return { changed: false, items, n: movable.length };
  const times = movable.map((x) => x.time), left = movable.slice(1), route = [movable[0]];
  while (left.length) {
    const last = PLACE_BY_ID[route[route.length - 1].placeId!];
    left.sort((a, b) => distance(PLACE_BY_ID[a.placeId!], last) - distance(PLACE_BY_ID[b.placeId!], last));
    route.push(left.shift()!);
  }
  const changed = route.some((x, i) => x.id !== movable[i].id);
  const ids = movable.map((x) => x.id);
  const out = items.filter((x) => ids.indexOf(x.id) < 0 && x.kind !== 'move').concat(route.map((x, i) => ({ ...x, time: times[i] })));
  return { changed, items: sortItems(out), n: movable.length };
}
