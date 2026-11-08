/* Viagem em grupo: participantes, saldos e acertos
   Gasto: paidBy (quem pagou) e split (quem divide; vazio = todos). Acertos ficam em trip.settlements. */
import type { Trip, Expense, Member } from '../types';

/* Quem divide os gastos: as pessoas cadastradas e, se a viagem foi criada para mais gente,
   um lugar reservado para cada viajante ainda sem nome ("Viajante 2", "Viajante 3"…).
   Assim a quantidade de viajantes e a divisão nunca mostram números diferentes. */
export function tripMembers(t: Trip): Member[] {
  const list: Member[] = t.members && t.members.length ? t.members.slice() : [{ id: 'me', name: 'Você', status: 'owner' }];
  const want = Math.min(20, Math.max(1, t.travelers || 1));
  const used: Record<string, boolean> = {};
  list.forEach((m) => { used[m.id] = true; });
  for (let i = list.length + 1; list.length < want; i++) {
    const id = 'p' + i;
    if (used[id]) continue;
    list.push({ id, name: 'Viajante ' + i, status: 'ativo', placeholder: true });
  }
  return list;
}
/* quantidade de pessoas da viagem (a mesma em todas as telas) */
export function travelersOf(t: Trip): number { return tripMembers(t).length; }
/* nome repetido (sem diferenciar maiúsculas e acentos) */
export function nameTaken(t: Trip, name: string, exceptId?: string): boolean {
  const n = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return tripMembers(t).some((m) => m.id !== exceptId && n(m.name) === n(name));
}
export function memberName(t: Trip, id: string): string {
  if (id === 'me') return 'você';
  const m = tripMembers(t).find((x) => x.id === id);
  return m ? m.name : 'alguém';
}

export function groupBalances(t: Trip, expenses: Expense[]): Record<string, number> {
  const ms = tripMembers(t), bal: Record<string, number> = {};
  ms.forEach((m) => { bal[m.id] = 0; });
  expenses.filter((e) => e.tripId === t.id).forEach((e) => {
    const payer = e.paidBy || 'me';
    const ids = (e.split && e.split.length ? e.split : ms.map((m) => m.id)).filter((id) => bal[id] !== undefined);
    if (!ids.length || bal[payer] === undefined) return;
    const amt = Number(e.amount) || 0;
    bal[payer] += amt;
    ids.forEach((id) => { bal[id] -= amt / ids.length; });
  });
  (t.settlements || []).forEach((s) => {
    if (bal[s.from] !== undefined) bal[s.from] += s.amount;
    if (bal[s.to] !== undefined) bal[s.to] -= s.amount;
  });
  return bal;
}

/* Menor número de transferências: quem deve mais paga primeiro a quem tem mais a receber */
export function settleUp(bal: Record<string, number>): { from: string; to: string; amount: number }[] {
  const cred: { id: string; v: number }[] = [], deb: { id: string; v: number }[] = [], out: { from: string; to: string; amount: number }[] = [];
  Object.keys(bal).forEach((id) => {
    const v = Math.round(bal[id] * 100) / 100;
    if (v > 0.009) cred.push({ id, v }); else if (v < -0.009) deb.push({ id, v: -v });
  });
  cred.sort((a, b) => b.v - a.v); deb.sort((a, b) => b.v - a.v);
  let i = 0, j = 0;
  while (i < deb.length && j < cred.length) {
    const x = Math.min(deb[i].v, cred[j].v);
    out.push({ from: deb[i].id, to: cred[j].id, amount: Math.round(x * 100) / 100 });
    deb[i].v -= x; cred[j].v -= x;
    if (deb[i].v < 0.01) i++;
    if (cred[j].v < 0.01) j++;
  }
  return out;
}
