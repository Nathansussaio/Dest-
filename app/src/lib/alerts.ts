/* Avisos gerados a partir das viagens (no app, viram notificações locais) */
import type { AccountData } from '../types';
import { CLIMATE, hasCatalog } from '../data';
import { today0, parseD, addDays, iso, diffDays, fmtShort, plural, money, brl } from './format';
import { tripStatus, sortItems, itemName, cityOfDay } from './trip';
import { groupBalances, settleUp, memberName } from './group';

export interface Alert {
  id: string; tripId: string; date: string; icon: string; kind?: 'warn' | 'money';
  title: string; sub: string; go: 'trip' | 'docs' | 'checklist' | 'itinerary' | 'expenses' | 'assistant';
}

export function spentOf(d: Pick<AccountData, 'expenses'>, tripId: string): number {
  return d.expenses.filter((e) => e.tripId === tripId).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

export function alertsFor(d: AccountData): Alert[] {
  const out: Alert[] = [], now = today0(), N = d.prefs.notif, todayIso = iso(now);
  const atLeastToday = (x: string) => (x < todayIso ? todayIso : x);
  d.trips.filter((t) => tripStatus(t).key === 'next').forEach((t) => {
    const start = parseD(t.start), dTo = diffDays(now, start);
    const res = d.reservations.filter((r) => r.tripId === t.id);
    if (N.roteiro) {
      if (dTo > 0 && dTo <= 45) out.push({ id: t.id + ':count:' + dTo, tripId: t.id, date: todayIso, icon: 'suitcase', title: (dTo === 1 ? 'Amanhã começa ' : 'Faltam ' + dTo + ' dias para ') + t.name, sub: 'Confira documentos, reservas e o roteiro do Dia 1', go: 'trip' });
      res.filter((r) => r.type === 'voo' && r.status === 'Confirmada').forEach((r) => {
        out.push({ id: r.id + ':checkin', tripId: t.id, date: atLeastToday(iso(addDays(parseD(r.date), -1))), icon: 'plane', title: 'Check-in online · ' + r.title, sub: 'Costuma abrir de 24 a 48 horas antes do voo', go: 'docs' });
      });
      res.filter((r) => r.status !== 'Confirmada').forEach((r) => {
        out.push({ id: r.id + ':pend', tripId: t.id, date: atLeastToday(iso(addDays(parseD(r.date), -5))), icon: 'ticket', kind: 'warn', title: 'Reserva pendente: ' + r.title, sub: 'Compre ou confirme antes de ' + fmtShort(r.date), go: 'docs' });
      });
      const cl = d.checklist[t.id] || [], left = cl.filter((c) => !c.done).length;
      if (left) out.push({ id: t.id + ':docs:' + left, tripId: t.id, date: atLeastToday(iso(addDays(start, -10))), icon: 'doc', kind: 'warn', title: plural(left, 'item falta', 'itens faltam') + ' na lista de preparação', sub: t.name + ' · documentos e o que levar', go: 'checklist' });
      if (CLIMATE[t.destId] && dTo > 16) out.push({ id: t.id + ':wx', tripId: t.id, date: iso(addDays(start, -16)), icon: 'cloudSun', title: 'Previsão do tempo de ' + t.name, sub: 'A previsão real de cada dia fica disponível a partir daqui', go: 'trip' });
      const first = sortItems(t.days[0] || []).filter((x) => x.kind === 'place')[0];
      if (first) out.push({ id: t.id + ':d1', tripId: t.id, date: t.start, icon: 'calendar', title: 'Dia 1: ' + itemName(first) + ' às ' + first.time, sub: 'Lembrete 1 hora antes de cada atividade', go: 'itinerary' });
    }
    if (N.orcamento) {
      const spent = spentOf(d, t.id);
      if (t.budget && spent / t.budget >= 0.9) out.push({ id: t.id + ':budget:' + Math.round(spent), tripId: t.id, date: todayIso, icon: 'wallet', kind: 'warn', title: (spent > t.budget ? 'Orçamento ultrapassado' : '90% do orçamento usado') + ' · ' + t.name, sub: money(spent) + ' de ' + brl(t.budget), go: 'expenses' });
      settleUp(groupBalances(t, d.expenses)).filter((x) => x.from === 'me' || x.to === 'me').forEach((x) => {
        const other = memberName(t, x.from === 'me' ? x.to : x.from);
        out.push({ id: t.id + ':debt:' + x.from + ':' + x.to + ':' + Math.round(x.amount), tripId: t.id, date: todayIso, icon: 'users', kind: 'money', title: x.from === 'me' ? 'Você deve ' + money(x.amount) + ' para ' + other : other + ' te deve ' + money(x.amount), sub: t.name + ' · divisão dos gastos', go: 'expenses' });
      });
    }
    if (N.ia) {
      const free = t.days.findIndex((dd) => !dd.some((x) => x.kind === 'place'));
      if (free >= 0 && hasCatalog(cityOfDay(t, free))) out.push({ id: t.id + ':free:' + free, tripId: t.id, date: todayIso, icon: 'sparkle', title: 'Dia ' + (free + 1) + ' de ' + t.name + ' está livre', sub: 'O assistente pode sugerir um dia no seu estilo', go: 'assistant' });
    }
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
