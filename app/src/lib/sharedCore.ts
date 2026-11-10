/* Viagem em grupo sincronizada: o que vai para a nuvem e como juntar versões.
   Neste celular, quem usa o app é sempre 'me' (gastos, divisão e acertos).
   Na nuvem, cada pessoa com conta vira 'u:<id da conta>', para que cada celular saiba quem é quem. */
import type { Trip, Expense, Reservation, CheckItem } from '../types';

export interface SharedPayload { v: 1; trip: Trip; expenses: Expense[]; reservations: Reservation[]; checklist: CheckItem[] }
export interface LocalPart { trip: Trip; expenses: Expense[]; reservations: Reservation[]; checklist: CheckItem[] }

function swapId(id: string | undefined | null, from: string, to: string) { return id === from ? to : id; }
function mapIds(p: LocalPart, from: string, to: string): LocalPart {
  const sw = (x: any) => swapId(x, from, to) as string;
  const t = p.trip;
  const trip: Trip = {
    ...t,
    members: t.members ? t.members.map((m) => ({ ...m, id: sw(m.id) })) : t.members,
    settlements: t.settlements ? t.settlements.map((s) => ({ ...s, from: sw(s.from), to: sw(s.to) })) : t.settlements
  };
  const expenses = p.expenses.map((e) => ({ ...e, paidBy: e.paidBy ? sw(e.paidBy) : e.paidBy, split: e.split ? e.split.map(sw) : e.split }));
  return { trip, expenses, reservations: p.reservations, checklist: p.checklist };
}

/* versão para a nuvem: sem os dados só deste celular (marca de compartilhada, fotos de notas) */
export function toShared(p: LocalPart, myId: string): SharedPayload {
  const m = mapIds(p, 'me', 'u:' + myId);
  const trip: any = { ...m.trip };
  delete trip.shared;
  delete trip.publicId;
  delete trip.publicToken;
  return {
    v: 1, trip,
    expenses: m.expenses.map((e) => ({ ...e, receipt: null })),
    reservations: m.reservations.map((r) => (r.file ? { ...r, file: { ...r.file, uri: null } } : r)),
    checklist: m.checklist
  };
}
/* versão da nuvem para este celular */
export function fromShared(d: SharedPayload, myId: string): LocalPart {
  const p: LocalPart = { trip: d.trip, expenses: d.expenses || [], reservations: d.reservations || [], checklist: d.checklist || [] };
  return mapIds(p, 'u:' + myId, 'me');
}

/* texto estável (ordem das chaves não importa): serve para saber se a viagem mudou neste celular */
export function stable(v: any): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
export function hashOf(p: SharedPayload): string {
  const s = stable(p);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return s.length + ':' + h.toString(36);
}

/* Duas pessoas mexeram ao mesmo tempo: junta as duas versões.
   Gastos, reservas e itens do checklist de qualquer uma das versões ficam; nos que as duas mudaram, vale o deste celular.
   O roteiro e os dados da viagem ficam com a versão deste celular, somando as pessoas que entraram no grupo. */
export function mergeParts(mine: LocalPart, theirs: LocalPart): LocalPart {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const seen: Record<string, boolean> = {};
    a.forEach((x) => { seen[x.id] = true; });
    return a.concat(b.filter((x) => !seen[x.id]));
  };
  const members = byId(mine.trip.members || [], theirs.trip.members || []);
  const settlements = byId(mine.trip.settlements || [], theirs.trip.settlements || []);
  return {
    trip: { ...mine.trip, members: members.length ? members : mine.trip.members, settlements: settlements.length ? settlements : mine.trip.settlements },
    expenses: byId(mine.expenses, theirs.expenses),
    reservations: byId(mine.reservations, theirs.reservations),
    checklist: byId(mine.checklist, theirs.checklist)
  };
}

/* código de convite: 8 letras e números fáceis de ditar (sem 0/O, 1/I/L) */
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode(n = 8): string {
  const out: string[] = [];
  const g: any = (globalThis as any).crypto;
  const buf = new Uint32Array(n);
  if (g && typeof g.getRandomValues === 'function') g.getRandomValues(buf);
  else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 4294967296);
  for (let i = 0; i < n; i++) out.push(ALPHA[buf[i] % ALPHA.length]);
  return out.join('');
}
export function cleanCode(s: string): string {
  const raw = String(s || '').trim();
  const m = raw.match(/[?&]c=([A-Za-z0-9-]+)/) || raw.match(/convite\/([A-Za-z0-9-]+)/);
  return (m ? m[1] : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export function newSharedId(): string { return 'g' + makeCode(14).toLowerCase(); }
