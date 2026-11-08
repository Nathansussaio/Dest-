/* Roteiro público (link só de leitura): o que pode aparecer para quem recebe o link.
   Vai: destino, datas, quantidade de pessoas, estilo, ritmo e o roteiro (horários, lugares e deslocamentos).
   Não vai: gastos, orçamento, reservas e códigos, checklist, nomes das pessoas, anotações pessoais (itens "nota"). */
import type { Trip, ItineraryItem, Leg } from '../types';
import { travelersOf } from './group';

export interface PublicItem { time: string; kind: 'place' | 'move'; placeId?: string; text?: string }
export interface PublicTrip {
  v: 1; name: string; country: string; destId: string; start: string; end: string;
  travelers: number; styles: string[]; pace: string; legs?: Leg[]; days: PublicItem[][];
}

export function publicSnapshot(t: Trip): PublicTrip {
  const item = (x: ItineraryItem): PublicItem | null => {
    if (x.kind === 'place' && x.placeId) return { time: x.time, kind: 'place', placeId: x.placeId };
    if (x.kind === 'move' && x.text) return { time: x.time, kind: 'move', text: String(x.text).slice(0, 120) };
    return null;
  };
  return {
    v: 1, name: t.name, country: t.country, destId: t.destId, start: t.start, end: t.end,
    travelers: travelersOf(t),
    styles: (t.styles || []).slice(), pace: t.pace || 'equilibrado',
    legs: t.legs ? t.legs.map((l) => ({ destId: l.destId, name: l.name, days: l.days })) : undefined,
    days: t.days.map((d) => d.map(item).filter(Boolean) as PublicItem[])
  };
}

/* confere o que veio da nuvem antes de mostrar (link antigo, dado incompleto) */
export function validPublic(d: any): d is PublicTrip {
  return !!d && typeof d === 'object' && typeof d.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(d.end || '') && Array.isArray(d.days);
}

/* id do link: 12 letras e números (difícil de adivinhar) */
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newPublicId(n = 12): string {
  const g: any = (globalThis as any).crypto;
  const buf = new Uint32Array(n);
  if (g && typeof g.getRandomValues === 'function') g.getRandomValues(buf);
  else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 4294967296);
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[buf[i] % ALPHA.length];
  return s;
}
export function publicLink(siteUrl: string, id: string): string { return siteUrl.replace(/\/+$/, '') + '/roteiro/?id=' + id; }
