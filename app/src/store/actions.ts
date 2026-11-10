/* Ações do app: tudo o que muda o estado passa por aqui */
import type { AccountData, Trip, Expense, Reservation, Style, PaceId, Leg, ItineraryItem, Member, ChatMsg } from '../types';
import { getState, setState, pickData, normalizeData, pullCloud, flushCloud, type Screen, type Sheet, type User } from './store';
import { lookupDest, findDestExact, PLACE_BY_ID, DEST_BY_ID, hasCatalog, RES_TYPES, CUR_SYMBOL } from '../data';
import { uid, iso, today0, countDays, parseD, addDays, money, fmtMoney, norm, isEmail, plural, fmtShort } from '../lib/format';
import { splitBudget, tripLegs, legName, legsTitle, legsCountry, fitLegs, sortItems, legDayArgs, legNameOfDay, nextTime, itemName, pl, mv } from '../lib/trip';
import { generateTripPlan, buildDay } from '../lib/generator';
import { tripMembers, nameTaken } from '../lib/group';
import { mergeAccountData } from '../lib/backupCore';
import { toBRL, type Cur } from '../lib/expenseCore';
import { aiReply, type AiKey } from '../lib/assistant';
import { spentOf, type Alert } from '../lib/alerts';
import { freshData, defaultChecklist } from '../lib/accounts';
import { CLOUD_ENABLED } from '../config';
import { cloudSignIn, cloudSignUp, cloudVerifySignup, cloudResend, cloudSendReset, cloudConfirmReset, cloudChangePassword, cloudSignOut, cloudDeleteAccount } from '../lib/backend';
import { passProblem } from '../lib/auth';
import { hashPassword } from '../lib/hash';
import { ensureNotifPermission } from '../lib/device';
import * as G from './shared';
import * as P from './publicLinks';

const S = getState;

/* ---------- Navegação ---------- */
export function go(screen: Screen, extra: Partial<ReturnType<typeof S>> = {}) {
  setState((s) => ({ history: s.history.concat([s.screen]), screen, sheet: null, notFound: null, publicView: null, inviteView: null, ...extra }));
}
export function back(): boolean {
  const s = S();
  if (s.sheet) { setState({ sheet: null }); return true; }
  if (s.notFound || s.publicView || s.inviteView) { setState({ notFound: null, publicView: null, inviteView: null }); return true; }
  if (!s.user) { if (s.auth !== 'welcome') { setState({ auth: 'welcome' }); return true; } return false; }
  if (s.history.length) { const h = s.history.slice(); const prev = h.pop()!; setState({ screen: prev, history: h }); return true; }
  if (s.screen !== 'home') { setState({ screen: 'home', history: [] }); return true; }
  return false;
}
export function tab(id: Screen, extra: Partial<ReturnType<typeof S>> = {}) { setState({ screen: id, history: [], sheet: null, notFound: null, publicView: null, inviteView: null, ...extra }); }
export function openSheet(sheet: Sheet, arg: any = null) { setState({ sheet, sheetArg: arg }); }
export function closeSheet() { setState({ sheet: null, sheetArg: null }); }
export function openTrip(id: string, screen: Screen = 'trip') { go(screen, { tripId: id, day: 0 }); }
export function openPlace(id: string) { go('place', { placeId: id }); }

/* ---------- Avisos rápidos e "Desfazer" ---------- */
let toastT: ReturnType<typeof setTimeout> | null = null;
export function snap(): AccountData { return pickData(S()); }
export function showToast(msg: string, undo: AccountData | null = null) {
  const id = Date.now();
  setState({ toast: { msg, undo, id } });
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => { if (S().toast && S().toast!.id === id) setState({ toast: null }); }, undo ? 5000 : 2600);
}
export function undo() {
  const t = S().toast;
  if (!t || !t.undo) return;
  setState({ ...t.undo, toast: null });
  showToast('Ação desfeita');
}

/* ---------- Viagem atual ---------- */
export function currentTrip(): Trip | null {
  const s = S();
  return s.trips.find((t) => t.id === s.tripId) || s.trips[0] || null;
}
export function updateTrip(fn: (t: Trip) => Trip, id?: string) {
  const tid = id || (currentTrip() && currentTrip()!.id);
  setState((s) => ({ trips: s.trips.map((t) => (t.id === tid ? fn(t) : t)) }));
}
export function spent(tripId: string) { return spentOf(S(), tripId); }

/* ---------- Criar viagem ---------- */
export interface TripInput {
  dest: string; destId: string | null; legs: Leg[]; start: string; end: string;
  travelers: number; budget: string; styles: Style[]; pace: PaceId;
}
export type TripErrors = Partial<Record<'dest' | 'start' | 'end' | 'budget' | 'styles' | 'legs', string>>;

export function validateTrip(f: TripInput): TripErrors {
  const e: TripErrors = {};
  const match = f.destId ? lookupDest(f.destId) : findDestExact(f.dest);
  if (!f.dest.trim()) e.dest = 'Informe o destino da viagem.';
  else if (!match) e.dest = 'Escolha um destino da lista de sugestões.';
  if (!f.start) e.start = 'Escolha a data de ida.';
  if (!f.end) e.end = 'Escolha a data de volta.';
  else if (f.start && f.end < f.start) e.end = 'A volta precisa ser depois da ida.';
  else if (f.start && countDays(f.start, f.end) > 60) e.end = 'Planeje viagens de até 60 dias.';
  if (f.budget && !(Number(f.budget) >= 0)) e.budget = 'Confira o valor do orçamento.';
  if (!f.styles.length) e.styles = 'Escolha pelo menos um estilo.';
  if (f.legs.length && f.start && f.end && f.end >= f.start) {
    const n = countDays(f.start, f.end), extra = f.legs.reduce((a, l) => a + l.days, 0);
    if (n - extra < 1) e.legs = 'Os dias das outras cidades passam do total da viagem (' + n + ' dias).';
  }
  return e;
}

export function createTrip(f: TripInput): TripErrors {
  const e = validateTrip(f);
  if (Object.keys(e).length) return e;
  const d = (f.destId ? lookupDest(f.destId) : findDestExact(f.dest))!;
  const n = countDays(f.start, f.end);
  const firstDays = n - f.legs.reduce((a, l) => a + l.days, 0);
  const legs: Leg[] | undefined = f.legs.length ? [{ destId: d.id, name: d.name, days: firstDays }].concat(f.legs.map((l) => ({ destId: l.destId, name: legName(l), days: l.days }))) : undefined;
  const budget = Math.round((Number(f.budget) || 0) * 100) / 100;
  const u = S().user;
  const trip: Trip = {
    id: uid('t'), destId: d.id,
    name: legs ? legsTitle(legs) : d.name,
    country: legs ? legsCountry(legs) : (d.kind === 'country' ? 'País' : d.country),
    start: f.start, end: f.end, travelers: f.travelers, budget, styles: f.styles.slice(), pace: f.pace,
    plan: splitBudget(budget), days: Array.from({ length: n }, () => []), legs,
    members: [{ id: 'me', name: (u && u.name) || 'Você', status: 'owner' }]
  };
  const plan = tripLegs(trip).some((l) => hasCatalog(l.destId)) ? generateTripPlan(trip, trip.styles) : null;
  setState((s) => ({
    trips: s.trips.concat([trip]), checklist: { ...s.checklist, [trip.id]: defaultChecklist() },
    tripId: trip.id, day: 0, createdId: trip.id, createdPlan: plan, screen: 'created', history: ['home']
  }));
  showToast('Viagem salva em Viagens');
  return {};
}
export function useCreatedPlan() {
  const s = S(), id = s.createdId, plan = s.createdPlan;
  if (!id || !plan) return;
  setState((st) => ({ trips: st.trips.map((t) => (t.id === id ? { ...t, days: plan } : t)), createdPlan: null, screen: 'itinerary', history: ['home', 'trip'], tripId: id, day: 0 }));
  showToast('Roteiro aplicado. Ajuste o que quiser.');
}

/* ---------- Roteiro ---------- */
export function regenTrip(styles: Style[] | null, sel: number[]) {
  const t = currentTrip(); if (!t) return;
  if (!tripLegs(t).some((l) => hasCatalog(l.destId))) { showToast('Roteiro automático ainda não disponível para ' + t.name); return; }
  const u = snap(), st = styles || t.styles || ['Cultural'], some = sel.length > 0;
  const keep = some ? t.days.map((d, i) => (sel.indexOf(i) >= 0 ? null : d)) : null;
  const days = generateTripPlan({ ...t, pace: t.pace || 'equilibrado' }, st, keep);
  updateTrip((x) => ({ ...x, styles: st.slice(), days }));
  setState({ day: some ? Math.min(...sel) : 0 });
  showToast(some ? plural(sel.length, 'dia montado', 'dias montados') + ' de novo' : 'Roteiro ' + st.join(' + ') + ' gerado', u);
}
export function suggestDay(st: Style) {
  const t = currentTrip(); if (!t) return;
  const dayIdx = S().day, la = legDayArgs(t, dayIdx);
  if (!hasCatalog(la.city)) { showToast('Roteiro automático ainda não disponível para ' + legNameOfDay(t, dayIdx)); return; }
  const u = snap(), used: Record<string, number> = {};
  t.days.forEach((d, i) => { if (i !== dayIdx) d.forEach((x) => { if (x.placeId) used[x.placeId] = 1; }); });
  const styles = [st].concat((t.styles || []).filter((x) => x !== st)) as Style[];
  let items = buildDay(la.city, styles, t.pace || 'equilibrado', la.i, la.n, used, addDays(parseD(t.start), dayIdx).getDay());
  if (la.k > 0 && la.i === 0) {
    const travel = 'Viagem de ' + legName(tripLegs(t)[la.k - 1]) + ' para ' + legNameOfDay(t, dayIdx) + ' · check-in';
    items = items.map((x) => (x.text === 'Chegada e check-in' ? { ...x, text: travel } : x));
  }
  updateTrip((x) => ({ ...x, days: x.days.map((d, i) => (i === dayIdx ? items : d)) }));
  showToast('Dia ' + (dayIdx + 1) + ' montado no estilo ' + st, u);
}
function setDay(fn: (d: ItineraryItem[]) => ItineraryItem[], dayIdx = S().day) {
  updateTrip((t) => ({ ...t, days: t.days.map((d, i) => (i === dayIdx ? fn(d) : d)) }));
}
export function swapPlace(itemId: string, placeId: string) {
  const u = snap();
  setDay((d) => d.map((x) => (x.id === itemId ? { ...x, placeId } : x)));
  showToast('Trocado por ' + PLACE_BY_ID[placeId].name, u);
}
export function addPlaceToDay(placeId: string, dayIdx: number) {
  const t = currentTrip(); if (!t) return;
  const day = t.days[dayIdx] || [];
  if (day.some((x) => x.placeId === placeId)) { showToast('Já está no Dia ' + (dayIdx + 1)); return; }
  const u = snap();
  setDay((d) => sortItems(d.concat([pl(nextTime(d), placeId)])), dayIdx);
  showToast(PLACE_BY_ID[placeId].name + ' adicionado ao Dia ' + (dayIdx + 1), u);
}
export function removeItem(id: string) {
  const u = snap(), t = currentTrip(); if (!t) return;
  const it = (t.days[S().day] || []).find((x) => x.id === id);
  setDay((d) => d.filter((x) => x.id !== id));
  showToast((it ? itemName(it) : 'Item') + ' removido', u);
}
export function setItemTime(id: string, time: string) { setDay((d) => d.map((x) => (x.id === id ? { ...x, time } : x))); }
export function moveItem(id: string, dir: -1 | 1) {
  setDay((d) => {
    const items = sortItems(d), i = items.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return d;
    const a = items[i], b = items[j];
    return sortItems(items.map((x) => (x.id === a.id ? { ...x, time: b.time } : x.id === b.id ? { ...x, time: a.time } : x)));
  });
}
export function moveToDay(itemId: string, target: number) {
  const t = currentTrip(); if (!t) return;
  const from = S().day;
  if (target === from || target < 0 || target >= t.days.length) return;
  const item = (t.days[from] || []).find((x) => x.id === itemId); if (!item) return;
  const u = snap();
  updateTrip((x) => ({ ...x, days: x.days.map((d, i) => (i === from ? d.filter((y) => y.id !== itemId) : i === target ? sortItems(d.concat([item])) : d)) }));
  showToast(itemName(item) + ' foi para o Dia ' + (target + 1), u);
}
export function addMove(text = 'Deslocamento') {
  const t = currentTrip(); if (!t) return;
  setDay((d) => sortItems(d.concat([mv(nextTime(d), text)])));
}

/* ---------- Salvos ---------- */
export function toggleSave(placeId: string) {
  const on = S().saved.indexOf(placeId) >= 0;
  setState((s) => ({ saved: on ? s.saved.filter((x) => x !== placeId) : s.saved.concat([placeId]) }));
  showToast(on ? 'Removido dos salvos' : 'Salvo em Lugares salvos');
}
export function toggleDest(id: string) {
  const on = S().savedDest.indexOf(id) >= 0;
  setState((s) => ({ savedDest: on ? s.savedDest.filter((x) => x !== id) : s.savedDest.concat([id]) }));
  showToast(on ? 'Destino removido dos salvos' : 'Destino salvo');
}

/* ---------- Editar e excluir viagem ---------- */
export interface TripEdit { start: string; end: string; travelers: number; budget: string; styles: Style[]; pace: PaceId; stops?: { destId: string; name: string; days: number }[] }
export function saveTripEdit(f: TripEdit): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.start) e.start = 'Escolha a data de ida.';
  if (!f.end) e.end = 'Escolha a data de volta.';
  else if (f.end < f.start) e.end = 'A volta precisa ser depois da ida.';
  else if (countDays(f.start, f.end) > 60) e.end = 'Planeje viagens de até 60 dias.';
  if (f.budget && !(Number(f.budget) >= 0)) e.budget = 'Confira o valor do orçamento.';
  if (!f.styles.length) e.styles = 'Escolha pelo menos um estilo.';
  if (f.stops && f.stops.length > 1 && f.start && f.end && f.end >= f.start) {
    const extra = f.stops.slice(1).reduce((a, x) => a + x.days, 0);
    if (countDays(f.start, f.end) - extra < 1) e.legs = 'A soma dos dias das paradas passa do total da viagem. Diminua os dias de alguma parada.';
  }
  /* viajantes: aumentar cria lugares reservados ("Viajante 3"); diminuir só tira lugares reservados sem gastos */
  const cur = currentTrip();
  let members: Member[] | null = null;
  if (cur) {
    const ms = tripMembers(cur);
    const want = Math.max(1, Math.min(20, f.travelers || 1));
    if (want < ms.length) {
      const used = (id: string) => S().expenses.some((x) => x.tripId === cur.id && ((x.paidBy || 'me') === id || (x.split || []).indexOf(id) >= 0));
      const next = ms.slice();
      for (let i = next.length - 1; i >= 0 && next.length > want; i--) if (next[i].placeholder && !used(next[i].id)) next.splice(i, 1);
      if (next.length > want) e.travelers = 'Esta viagem tem ' + next.length + ' pessoas com nome ou com gastos. Para diminuir, remova alguém em Pessoas da viagem.';
      else members = next;
    }
  }
  if (Object.keys(e).length) return e;
  const u = snap(), n = countDays(f.start, f.end), budget = Math.round((Number(f.budget) || 0) * 100) / 100;
  let regenerated = 0;
  updateTrip((t) => {
    const changedBudget = budget !== t.budget;
    const people = members ? { members, travelers: members.length } : { travelers: Math.max(f.travelers, tripMembers(t).filter((m) => !m.placeholder).length) };
    const base = { ...t, start: f.start, end: f.end, ...people, budget, styles: f.styles.slice(), pace: f.pace, plan: changedBudget ? splitBudget(budget) : t.plan };
    const oldLegs = tripLegs(t);
    const stops = f.stops && f.stops.length ? f.stops : null;
    const sameStops = !stops || (stops.length === oldLegs.length && stops.every((x, i) => x.destId === oldLegs[i].destId) && (stops.length === 1 || stops.slice(1).every((x, i) => x.days === oldLegs[i + 1].days)));
    if (sameStops) {
      const days = t.days.slice(0, n);
      while (days.length < n) days.push([]);
      return { ...base, days, legs: t.legs ? fitLegs(t.legs, n) : t.legs };
    }
    /* paradas mudaram: cada dia antigo volta para a mesma cidade, na ordem; os dias novos são montados */
    const legs: Leg[] = stops!.map((x, i) => ({ destId: x.destId, name: x.name, days: i === 0 ? n - stops!.slice(1).reduce((a, y) => a + y.days, 0) : x.days }));
    const queue: Record<string, ItineraryItem[][]> = {};
    let g = 0;
    oldLegs.forEach((L) => { for (let i = 0; i < L.days; i++, g++) { if (t.days[g] && t.days[g].length) (queue[L.destId] = queue[L.destId] || []).push(t.days[g].filter((x) => !(x.kind === 'note' && /^Viagem de /.test(x.text || '')))); } });
    const keep: (ItineraryItem[] | null)[] = [];
    legs.forEach((L) => { for (let i = 0; i < L.days; i++) { const q = queue[L.destId]; keep.push(q && q.length ? q.shift()! : null); } });
    const multi = legs.length > 1;
    const draft: Trip = { ...base, destId: legs[0].destId, name: multi ? legsTitle(legs) : legName(legs[0]), country: multi ? legsCountry(legs) : (() => { const d = lookupDest(legs[0].destId); return d ? (d.kind === 'country' ? 'País' : d.country) : t.country; })(), legs: multi ? legs : undefined, days: Array.from({ length: n }, () => []) };
    const anyCatalog = legs.some((L) => hasCatalog(L.destId));
    const plan = anyCatalog ? generateTripPlan(draft, draft.styles, keep) : null;
    regenerated = anyCatalog ? keep.filter((x) => !x).length : 0;
    return { ...draft, days: plan || keep.map((x) => x || []) };
  });
  setState((s) => ({ sheet: null, day: Math.min(s.day, n - 1) }));
  showToast(regenerated ? 'Viagem atualizada: ' + plural(regenerated, 'dia novo montado', 'dias novos montados') : 'Viagem atualizada', u);
  return {};
}
export function deleteTrip() {
  const t = currentTrip(); if (!t) return;
  const u = snap(), id = t.id;
  /* viagem em grupo: quem criou encerra o grupo (os outros ficam com uma cópia); quem foi convidado sai do grupo */
  if (t.shared) { (G.isOwner(t) ? G.stopSharing(id) : G.leaveTrip(id)).catch(() => {}); }
  setState((s) => {
    const rest = s.trips.filter((x) => x.id !== id), cl = { ...s.checklist };
    delete cl[id];
    return { trips: rest, expenses: s.expenses.filter((x) => x.tripId !== id), reservations: s.reservations.filter((x) => x.tripId !== id), checklist: cl, sheet: null, screen: 'trips', history: [], tripId: rest.length ? rest[0].id : null, day: 0 };
  });
  showToast(t.name + ' excluída', u);
}

/* ---------- Gastos ---------- */
export interface ExpenseInput {
  id: string | null; amount: string; currency: string; rate: string; title: string; cat: string;
  date: string; method: string; receipt: string | null; paidBy: string; split: string[];
}
export function saveExpense(f: ExpenseInput): Record<string, string> {
  const t = currentTrip(); if (!t) return { title: 'Crie uma viagem primeiro.' };
  const e: Record<string, string> = {};
  const cur = (['BRL', 'EUR', 'USD'].indexOf(f.currency) >= 0 ? f.currency : 'BRL') as Cur;
  const conv = toBRL(f.amount, cur, f.rate);
  if (!conv.ok) e[conv.field] = conv.error;
  if (!f.title || f.title.trim().length < 2) e.title = 'Descreva o gasto (ex.: almoço, táxi, museu).';
  const members = tripMembers(t), group = members.length > 1;
  if (group && !f.split.length) e.split = 'Escolha quem divide este gasto.';
  if (!conv.ok || Object.keys(e).length) return e;
  const brlV = conv.brl;
  const data: Omit<Expense, 'id' | 'tripId'> = {
    title: f.title.trim(), cat: f.cat, amount: brlV, date: f.date || '', method: f.method, receipt: f.receipt,
    orig: conv.orig,
    paidBy: group ? f.paidBy || 'me' : 'me',
    split: group && f.split.length < members.length ? f.split.slice() : null
  };
  const u = snap();
  if (f.id) setState((s) => ({ expenses: s.expenses.map((x) => (x.id === f.id ? { ...x, ...data } : x)), sheet: null }));
  else setState((s) => ({ expenses: s.expenses.concat([{ id: uid('e'), tripId: t.id, ...data }]), sheet: null }));
  showToast((f.id ? 'Gasto atualizado: ' : '') + (conv.orig ? CUR_SYMBOL[conv.orig.currency] + ' ' + fmtMoney(conv.orig.value) + ' = ' : '') + money(brlV) + (f.id ? '' : ' registrados no orçamento'), u);
  return {};
}
export function removeExpense(id: string) {
  const u = snap();
  setState((s) => ({ expenses: s.expenses.filter((e) => e.id !== id), sheet: null }));
  showToast('Gasto excluído', u);
}

/* ---------- Grupo ----------
   As pessoas da viagem = tripMembers(t): cadastradas + lugares reservados ("Viajante 2"…) até a quantidade de viajantes.
   Toda mudança grava a lista completa e mantém travelers = quantidade de pessoas. */
function withMembers(x: Trip, ms: Member[]): Trip { return { ...x, members: ms.map((m) => ({ ...m })), travelers: Math.max(1, ms.length) }; }
/* Quem vai na viagem: a pessoa entra pelo nome (para dividir os gastos neste celular).
   Se a viagem tem lugar reservado ("Viajante 2"), o nome ocupa esse lugar (os gastos já divididos com ele continuam certos). */
export function invite(name: string): Record<string, string> {
  const t = currentTrip(); if (!t) return {};
  const e: Record<string, string> = {}, ms = tripMembers(t);
  name = name.trim().replace(/\s+/g, ' ');
  const slot = ms.find((m) => m.placeholder);
  if (name.length < 2) e.name = 'Digite o nome de quem vai junto.';
  else if (nameTaken(t, name)) e.name = 'Já tem alguém com esse nome nesta viagem. Use também o sobrenome.';
  else if (!slot && ms.length >= 20) e.name = 'Uma viagem pode ter até 20 pessoas.';
  if (Object.keys(e).length) return e;
  const u = snap();
  const next = slot ? ms.map((m) => (m.id === slot.id ? { id: m.id, name, status: 'ativo' as const } : m)) : ms.concat([{ id: uid('m'), name, status: 'ativo' }]);
  updateTrip((x) => withMembers(x, next));
  showToast(name + ' entrou na viagem', u);
  return {};
}
export function renameMember(id: string, name: string): string | null {
  const t = currentTrip(); if (!t) return null;
  name = name.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return 'Digite o nome (pelo menos 2 letras).';
  if (nameTaken(t, name, id)) return 'Já tem alguém com esse nome nesta viagem. Use também o sobrenome.';
  updateTrip((x) => withMembers(x, tripMembers(x).map((m) => (m.id === id ? { id: m.id, name, status: m.status, email: m.email, role: m.role } : m))));
  return null;
}
export function removeMember(id: string) {
  const t = currentTrip(); if (!t) return;
  const ms = tripMembers(t);
  const m = ms.find((x) => x.id === id); if (!m) return;
  if (id === 'me') { showToast('Você organiza esta viagem e não pode sair da divisão.'); return; }
  const mine = S().expenses.filter((e) => e.tripId === t.id);
  const paid = mine.some((e) => (e.paidBy || 'me') === id) || (t.settlements || []).some((x) => x.from === id || x.to === id);
  if (paid) { showToast(m.name + ' pagou gastos ou tem acertos nesta viagem. Mude quem pagou nesses gastos antes de remover.'); return; }
  /* gasto dividido só com essa pessoa: não dá para tirar sem decidir quem paga a parte dela */
  if (mine.some((e) => e.split && e.split.length === 1 && e.split[0] === id)) { showToast('Há gasto dividido só com ' + m.name + '. Edite esse gasto antes de remover.'); return; }
  if (/^u:/.test(id)) {
    if (!G.isOwner(t)) { showToast('Só quem criou a viagem pode tirar alguém do grupo'); return; }
    G.removeFromGroup(t.id, id).then((err) => { if (err) showToast(err); else { dropMember(t.id, id); showToast(m.name + ' saiu do grupo'); } });
    return;
  }
  const u = snap();
  dropMember(t.id, id);
  showToast(m.name + ' saiu da viagem. A divisão dos gastos foi recalculada.', u);
}
/* tira a pessoa da lista e das divisões em que ela aparecia (a parte dela passa para os outros da mesma divisão) */
function dropMember(tripId: string, id: string) {
  setState((s) => ({
    trips: s.trips.map((x) => (x.id === tripId ? withMembers(x, tripMembers(x).filter((mm) => mm.id !== id)) : x)),
    expenses: s.expenses.map((e) => (e.tripId === tripId && e.split && e.split.indexOf(id) >= 0 ? { ...e, split: e.split.filter((k) => k !== id) } : e))
  }));
}

/* ---------- Editar junto (cada pessoa no seu celular) ---------- */
export function canEditTogether() { return G.canShare(); }
export async function shareTripLive(): Promise<string | null> {
  const t = currentTrip(); if (!t) return null;
  const e = await G.shareTrip(t.id);
  if (!e) showToast('Pronto! Mande o convite para quem vai editar junto');
  return e;
}
export async function newInviteCode(): Promise<string | null> {
  const t = currentTrip(); if (!t) return null;
  return G.newInvite(t.id);
}
export async function joinByCode(code: string): Promise<string | null> {
  const r = await G.joinTrip(code);
  if (r.error) return r.error;
  const t = S().trips.find((x) => x.id === r.tripId);
  setState({ sheet: null, sheetArg: null });
  if (t) { openTrip(t.id); showToast('Você entrou na viagem ' + t.name); }
  return null;
}
/* "Agora não": fecha o convite, mas o código continua guardado nesta aba (volta ao entrar na conta) */
export function laterInvite() {
  setState({ inviteView: null });
  if (S().user) tab('trips'); else setState({ auth: 'welcome' });
  showToast('O convite ficou guardado. Ele aparece de novo quando você entrar na conta.');
}
/* convite recusado: nada muda nas viagens; o código guardado é esquecido */
export function declineInvite() {
  G.takePendingInvite();
  setState({ inviteView: null });
  if (S().user) tab('trips'); else setState({ auth: 'welcome' });
  showToast('Convite recusado. Nada mudou nas suas viagens.');
}
export async function leaveGroup(): Promise<string | null> {
  const t = currentTrip(); if (!t) return null;
  const e = G.isOwner(t) ? await G.stopSharing(t.id) : await G.leaveTrip(t.id);
  if (e) return e;
  setState({ sheet: null });
  if (G.isOwner(t) || S().trips.some((x) => x.id === t.id)) showToast('A viagem voltou a ser só sua. Quem participava fica com uma cópia.');
  else { setState({ screen: 'trips', history: [] }); showToast('Você saiu de ' + t.name); }
  return null;
}
export async function syncGroupNow() {
  const ok = await G.syncShared();
  showToast(ok ? 'Viagem atualizada com o grupo' : 'Sem conexão com o grupo agora. Tentamos de novo em instantes.');
}
G.setSharedToast((m) => showToast(m));
G.setOnJoined((id) => { const t = S().trips.find((x) => x.id === id); if (t) { openTrip(id); showToast('Você entrou na viagem ' + t.name); } });
export function settleDebt(d: { from: string; to: string; amount: number }) {
  const u = snap();
  updateTrip((x) => ({ ...x, settlements: (x.settlements || []).concat([{ id: uid('s'), from: d.from, to: d.to, amount: d.amount, date: iso(today0()) }]) }));
  showToast('Acerto de ' + money(d.amount) + ' registrado', u);
}

/* ---------- Reservas e documentos ---------- */
export interface ResInput { id?: string | null; type: string; title: string; date: string; time: string; code: string; file?: { name: string; uri: string | null } | null; imported?: boolean }
export function saveRes(f: ResInput): Record<string, string> {
  const t = currentTrip(); if (!t) return {};
  const e: Record<string, string> = {};
  const min = iso(addDays(parseD(t.start), -1));
  if (!f.title || f.title.trim().length < 2) e.title = 'Dê um nome para a reserva.';
  if (!f.date) e.date = 'Escolha a data.';
  else if (f.date < min || f.date > t.end) e.date = 'Escolha uma data entre ' + fmtShort(min) + ' e ' + fmtShort(t.end) + '.';
  if (Object.keys(e).length) return e;
  const code = (f.code || '').trim().toUpperCase();
  const r: Reservation = {
    id: f.id || uid('r'), tripId: t.id, type: f.type, title: f.title.trim(), date: f.date, time: f.time, code,
    status: code ? 'Confirmada' : 'Pendente',
    details: f.imported && f.file ? ['Importada de ' + f.file.name, 'Confira os dados com a confirmação original'] : ['Adicionada por você'],
    file: f.file || null
  };
  setState((s) => ({ reservations: f.id ? s.reservations.map((x) => (x.id === f.id ? r : x)) : s.reservations.concat([r]), sheet: null }));
  showToast(f.id ? 'Reserva atualizada' : 'Reserva adicionada');
  return {};
}
export function guessResType(fileName: string): string {
  const n = norm(fileName);
  return /voo|flight|embarque|boarding|aereo|passagem/.test(n) ? 'voo'
    : /seguro|insur|apolice/.test(n) ? 'seguro'
    : /ingresso|ticket|entrada|museu|show|tour/.test(n) ? 'ingresso'
    : /trem|train|onibus|bus|carro|rental|transfer/.test(n) ? 'transporte' : 'hospedagem';
}
export function toggleResStatus(id: string) {
  setState((s) => ({ reservations: s.reservations.map((r) => (r.id === id ? { ...r, status: r.status === 'Confirmada' ? 'Pendente' as const : 'Confirmada' as const } : r)) }));
}
export function removeRes(id: string) {
  const u = snap();
  setState((s) => ({ reservations: s.reservations.filter((r) => r.id !== id) }));
  showToast('Reserva removida', u);
}
function updateChecklist(fn: (l: AccountData['checklist'][string]) => AccountData['checklist'][string]) {
  const t = currentTrip(); if (!t) return;
  setState((s) => ({ checklist: { ...s.checklist, [t.id]: fn(s.checklist[t.id] || []) } }));
}
export function toggleCheck(id: string) { updateChecklist((l) => l.map((c) => (c.id === id ? { ...c, done: !c.done } : c))); }
export function removeCheck(id: string) { const u = snap(); updateChecklist((l) => l.filter((c) => c.id !== id)); showToast('Item removido', u); }
export function addCheck(label: string, hint = '') { if (label.trim()) updateChecklist((l) => l.concat([{ id: uid('c'), label: label.trim(), hint, done: false }])); }
export function addClimateTips(texts: string[]) {
  if (!texts.length) return;
  const u = snap();
  updateChecklist((l) => l.concat(texts.map((text) => ({ id: uid('c'), label: text, hint: 'Sugestão pelo clima', done: false }))));
  showToast(plural(texts.length, 'item adicionado', 'itens adicionados') + ' à lista de preparação', u);
}
export function toggleDish(key: string) {
  const t = currentTrip(); if (!t) return;
  setState((s) => {
    const cur = s.dishDone[t.id] || [];
    return { dishDone: { ...s.dishDone, [t.id]: cur.indexOf(key) >= 0 ? cur.filter((k) => k !== key) : cur.concat([key]) } };
  });
}

/* ---------- Assistente ---------- */
let typingT: ReturnType<typeof setTimeout> | null = null;
export function sendToAI(text: string, key: AiKey, setTyping: (v: boolean) => void) {
  const me: ChatMsg = { id: uid('u'), from: 'me', lines: [text] };
  setState((s) => ({ chat: s.chat.concat([me]) }));
  setTyping(true);
  if (typingT) clearTimeout(typingT);
  typingT = setTimeout(() => {
    const t = currentTrip();
    const r = aiReply(key, t, S().day, t ? spent(t.id) : 0);
    const msg: ChatMsg = { id: uid('a'), from: 'ai', lines: r.lines, card: r.card ? { ...r.card, applied: false, dismissed: false } : null };
    setState((s) => ({ chat: s.chat.concat([msg]) }));
    setTyping(false);
  }, 650);
}
export function applyCard(msgId: string) {
  const m = S().chat.find((x) => x.id === msgId);
  if (!m || !m.card || m.card.action !== 'setDay' || m.card.dayIdx == null || !m.card.plan) return;
  const c = m.card, u = snap();
  setState((s) => ({
    trips: s.trips.map((t) => (t.id === c.tripId ? { ...t, days: t.days.map((d, i) => (i === c.dayIdx ? c.plan!.map((x) => ({ ...x, id: uid() })) : d)) } : t)),
    chat: s.chat.map((x) => (x.id === msgId ? { ...x, card: { ...x.card!, applied: true } } : x)),
    tripId: c.tripId!, day: c.dayIdx!
  }));
  showToast('Dia ' + (c.dayIdx! + 1) + ' atualizado no roteiro', u);
}
export function dismissCard(msgId: string) {
  setState((s) => ({ chat: s.chat.map((x) => (x.id === msgId && x.card ? { ...x, card: { ...x.card, dismissed: true } } : x)) }));
}

/* ---------- Avisos ---------- */
export function openAlert(a: Alert) {
  setState((s) => ({ alertsRead: s.alertsRead.indexOf(a.id) >= 0 ? s.alertsRead : s.alertsRead.concat([a.id]) }));
  const base = { tripId: a.tripId, day: 0 };
  if (a.go === 'checklist') go('docs', { ...base, sheetArg: 'docs' });
  else if (a.go === 'expenses') tab('expenses', base);
  else go(a.go, base);
}
export function readAllAlerts(ids: string[]) { setState({ alertsRead: ids }); }

/* ---------- Conta ----------
   Com o Supabase configurado: conta na nuvem, código de verificação por e-mail e backup das viagens.
   Sem ele: contas só neste aparelho (a senha fica guardada como resumo SHA-256). */
function signIn(user: User, msg: string, fresh: boolean, first?: Screen) {
  const s = S();
  const carry = user.method !== 'guest' ? s.pendingGuest : null;
  const cached = s.vault[user.email];
  const data = cached ? normalizeData(cached) : freshData();
  const scr: Screen = first || (carry ? 'home' : fresh || !cached ? (fresh ? 'onboard' : 'home') : 'home');
  setState({ ...data, user, auth: 'welcome', attempts: 0, lockedUntil: 0, sheet: null, pendingGuest: null, history: scr === 'create' ? ['home'] : [], screen: scr, tripId: data.trips.length ? data.trips[0].id : null, day: 0 });
  /* conta na nuvem: entrar não conta como mudança; a cópia deste celular mantém a data em que foi mexida de verdade
     (assim uma cópia antiga ou vazia nunca passa por cima da versão mais nova guardada na nuvem) */
  if (user.id) { const prevT = s.vaultTime[user.email] || 0; setState((st) => ({ vaultTime: { ...st.vaultTime, [user.email]: cached ? prevT : 0 } })); }
  showToast(carry && carry.trips.length ? msg + '. ' + (carry.trips.length === 1 ? 'A viagem do modo visitante veio junto.' : carry.trips.length + ' viagens do modo visitante vieram junto.') : msg);
  /* conta na nuvem: traz a versão mais recente (ou envia a deste aparelho, se for mais nova);
     as viagens do modo visitante entram depois, somadas às da conta (nunca no lugar delas) */
  if (user.id) pullCloud().then(() => {
    if (carry) mergeGuest(carry);
    if (carry && S().syncState === 'offline') showToast('Não foi possível sincronizar agora. Sua viagem continua salva neste aparelho e vai para a conta quando a conexão voltar.');
    resumePublish();
  });
  else { if (carry) mergeGuest(carry); resumePublish(); }
}
/* "Criar conta e publicar roteiro": depois do cadastro, volta à viagem, abre Compartilhar e gera o link */
function resumePublish() {
  const tid = P.takePublishAfterSignup();
  if (!tid || !S().trips.some((t) => t.id === tid)) return;
  openTrip(tid);
  setState({ sheet: 'share', sheetArg: null });
  P.createPublicLink(tid).then((r) => { if (r.url) showToast('Roteiro publicado: o link está pronto para copiar.'); else if (r.error) showToast(r.error); });
}
export function signupAndPublish(tripId: string) { P.publishAfterSignup(tripId); guestToSignup(); }
const LOCKED = 'Muitas tentativas seguidas. Aguarde 30 segundos e tente de novo.';
function countFail() {
  const n = S().attempts + 1;
  setState({ attempts: n >= 5 ? 0 : n, lockedUntil: n >= 5 ? Date.now() + 30000 : 0 });
  return n >= 5;
}
export async function login(email: string, pass: string): Promise<Record<string, string>> {
  const s = S(), e: Record<string, string> = {};
  if (Date.now() < s.lockedUntil) return { form: LOCKED };
  if (!isEmail(email)) e.email = 'Digite um e-mail válido.';
  if (!pass) e.pass = 'Digite sua senha.';
  if (Object.keys(e).length) return e;
  const em = email.trim().toLowerCase();
  if (CLOUD_ENABLED) {
    const r = await cloudSignIn(em, pass);
    if (!r.ok) {
      if (/Confirme seu e-mail/.test(r.error)) { pendingSignup = { name: '', email: em, pass: '' }; setState({ auth: 'verify' }); return {}; }
      return { form: countFail() ? LOCKED : r.error };
    }
    signIn({ id: r.value.id, name: r.value.name, email: r.value.email, method: 'email' }, 'Olá, ' + r.value.name.split(' ')[0] + '!', false);
    return {};
  }
  const h = await hashPassword(em, pass);
  const acc = s.accounts.find((a) => a.email === em && a.passHash === h);
  if (!acc) return { form: countFail() ? LOCKED : 'E-mail ou senha incorretos.' };
  signIn({ name: acc.name, email: acc.email, method: 'email' }, 'Olá, ' + acc.name.split(' ')[0] + '!', false);
  return {};
}
let pendingSignup: { name: string; email: string; pass: string } | null = null;
export async function signup(name: string, email: string, pass: string, pass2: string, terms: boolean): Promise<Record<string, string>> {
  const e: Record<string, string> = {}, em = (email || '').trim().toLowerCase();
  if (!name || name.trim().length < 2) e.name = 'Digite seu nome.';
  if (!isEmail(em)) e.email = 'Digite um e-mail válido.';
  else if (!CLOUD_ENABLED && S().accounts.some((a) => a.email === em)) e.email = 'Já existe uma conta com este e-mail. Tente entrar.';
  const pp = passProblem(pass); if (pp) e.pass = pp;
  if (!pass2 || pass2 !== pass) e.pass2 = 'As senhas não coincidem.';
  if (!terms) e.terms = 'Aceite os termos para continuar.';
  if (Object.keys(e).length) return e;
  const nm = name.trim().replace(/\s+/g, ' ');
  if (CLOUD_ENABLED) {
    const r = await cloudSignUp(nm, em, pass);
    if (!r.ok) return /Já existe/.test(r.error) ? { email: r.error } : { form: r.error };
    if (r.value.needsCode) {
      pendingSignup = { name: nm, email: em, pass: '' };
      setState({ auth: 'verify' });
      showToast('Enviamos um código de 6 números para ' + em);
      return {};
    }
    const u = r.value.user!;
    signIn({ id: u.id, name: u.name, email: u.email, method: 'email' }, 'Conta criada', true);
    return {};
  }
  const passHash = await hashPassword(em, pass);
  setState((s) => ({ accounts: s.accounts.concat([{ name: nm, email: em, passHash }]) }));
  signIn({ name: nm, email: em, method: 'email' }, 'Conta criada neste aparelho', true);
  return {};
}
export async function verifyCode(code: string): Promise<string | null> {
  if (!/^\d{6}$/.test(code)) return 'Digite os 6 números do código.';
  if (!pendingSignup) return 'Comece o cadastro de novo.';
  const r = await cloudVerifySignup(pendingSignup.email, code);
  if (!r.ok) return r.error;
  pendingSignup = null;
  signIn({ id: r.value.id, name: r.value.name, email: r.value.email, method: 'email' }, 'E-mail confirmado. Bem-vindo ao Destí!', true);
  return null;
}
export async function resendCode() {
  if (!pendingSignup) return;
  const r = await cloudResend(pendingSignup.email);
  showToast(r.ok ? 'Código reenviado para ' + pendingSignup.email : r.error);
}
export function pendingEmail() { return pendingSignup ? pendingSignup.email : ''; }

/* Recuperar senha: código por e-mail + senha nova (só com conta na nuvem) */
export async function sendReset(email: string): Promise<string | null> {
  if (!isEmail(email)) return 'Digite um e-mail válido.';
  if (!CLOUD_ENABLED) return 'Contas guardadas só neste aparelho não têm recuperação por e-mail.';
  const r = await cloudSendReset(email.trim().toLowerCase());
  return r.ok ? null : r.error;
}
export async function confirmReset(email: string, code: string, nw: string, nw2: string): Promise<Record<string, string>> {
  const e: Record<string, string> = {};
  if (!/^\d{6}$/.test(code)) e.code = 'Digite os 6 números do código.';
  const pp = passProblem(nw); if (pp) e.nw = pp;
  if (!nw2 || nw2 !== nw) e.nw2 = 'As senhas não coincidem.';
  if (Object.keys(e).length) return e;
  const r = await cloudConfirmReset(email.trim().toLowerCase(), code, nw);
  if (!r.ok) return { form: r.error };
  signIn({ id: r.value.id, name: r.value.name, email: r.value.email, method: 'email' }, 'Senha nova salva', false);
  return {};
}

export const GUEST_EMAIL = 'visitante@local';
export function tryAsGuest() {
  const back = !!S().vault[GUEST_EMAIL] && S().vault[GUEST_EMAIL].trips.length > 0;
  signIn({ name: 'Visitante', email: GUEST_EMAIL, method: 'guest' }, back ? 'Modo visitante: suas viagens deste aparelho voltaram' : 'Modo visitante: suas viagens ficam salvas só neste aparelho', !back, back ? 'trips' : 'create');
}
export function guestToSignup() {
  setState({ pendingGuest: snap(), user: null, auth: 'signup', screen: 'home', history: [], sheet: null });
  showToast('Crie sua conta (ou entre): as viagens do modo visitante vêm junto');
}
export function guestToLogin() {
  setState({ pendingGuest: snap(), user: null, auth: 'login', screen: 'home', history: [], sheet: null });
  showToast('Entre na sua conta: as viagens do modo visitante vêm junto');
}
/* junta as viagens do modo visitante na conta (sem apagar nada da conta) e limpa a cópia do visitante */
function mergeGuest(carry: AccountData) {
  const r = mergeAccountData(pickData(S()), normalizeData(carry));
  const vault = { ...S().vault };
  delete vault[GUEST_EMAIL];
  setState({ ...r.data, vault });
}
export async function logout() {
  const u = S().user;
  if (u && u.id) { await G.flushShared().catch(() => {}); await flushCloud(); await cloudSignOut(); }
  const guest = !!u && u.method === 'guest';
  setState({ user: null, auth: 'welcome', sheet: null, screen: 'home', history: [], ...freshData() });
  showToast(guest ? 'Você saiu do modo visitante. As viagens continuam neste aparelho: entre como visitante de novo para vê-las.' : 'Você saiu da conta');
}
export async function changePassword(cur: string, nw: string, nw2: string): Promise<Record<string, string>> {
  const s = S(), e: Record<string, string> = {};
  const pp = passProblem(nw);
  if (!cur) e.cur = 'Digite a senha atual.';
  if (pp) e.nw = pp; else if (nw === cur) e.nw = 'A nova senha precisa ser diferente da atual.';
  if (!nw2 || nw2 !== nw) e.nw2 = 'As senhas não coincidem.';
  if (Object.keys(e).length || !s.user) return e;
  if (s.user.id) {
    const r = await cloudChangePassword(s.user.email, cur, nw);
    if (!r.ok) return /atual/.test(r.error) ? { cur: r.error } : { form: r.error };
  } else {
    const acc = s.accounts.find((a) => a.email === s.user!.email);
    if (!acc || (await hashPassword(acc.email, cur)) !== acc.passHash) return { cur: 'Senha atual incorreta.' };
    const h = await hashPassword(acc.email, nw);
    setState((st) => ({ accounts: st.accounts.map((a) => (a.email === acc.email ? { ...a, passHash: h } : a)) }));
  }
  setState({ sheet: null });
  showToast('Senha alterada');
  return {};
}
export async function deleteAccount(): Promise<string | null> {
  const s = S(); if (!s.user) return null;
  if (s.user.id) {
    const r = await cloudDeleteAccount();
    if (!r.ok) return r.error;
  }
  const email = s.user.email, vault = { ...s.vault }, vaultTime = { ...s.vaultTime };
  delete vault[email]; delete vaultTime[email];
  setState({ accounts: s.accounts.filter((a) => a.email !== email), vault, vaultTime, user: null, auth: 'welcome', sheet: null, screen: 'home', history: [], ...freshData() });
  showToast('Conta excluída e dados apagados');
  return null;
}

/* ---------- Boas-vindas e perfil ---------- */
export function finishOnboarding(styles: Style[], destId: string | null) {
  setState((s) => ({ prefs: { ...s.prefs, styles } }));
  const first = (S().user && S().user!.name.split(' ')[0]) || '';
  if (destId) { setState({ screen: 'create', history: ['home'], sheetArg: { destId, styles: styles.slice(0, 2) } }); showToast('Preferências salvas. Agora escolha as datas.'); }
  else { setState({ screen: 'home', history: [] }); showToast('Tudo pronto, ' + first + '!'); }
}
export function setPref<K extends keyof AccountData['prefs']>(k: K, v: AccountData['prefs'][K]) { setState((s) => ({ prefs: { ...s.prefs, [k]: v } })); }
export function flipNotif(key: 'roteiro' | 'orcamento' | 'ia') { setState((s) => ({ prefs: { ...s.prefs, notif: { ...s.prefs.notif, [key]: !s.prefs.notif[key] } } })); }
export function flipSec(key: 'faceId') { setState((s) => ({ sec: { ...s.sec, [key]: !s.sec[key] } })); }
export function toggleStylePref(st: Style) {
  setState((s) => ({ prefs: { ...s.prefs, styles: s.prefs.styles.indexOf(st) >= 0 ? s.prefs.styles.filter((x) => x !== st) : s.prefs.styles.concat([st]) } }));
}
/* ---------- Utilitários para telas ---------- */
export function resTypeLabel(id: string) { return (RES_TYPES.find((t) => t.id === id) || RES_TYPES[0]).label; }
export function destOf(id: string) { return DEST_BY_ID[id] || lookupDest(id); }

/* Liga um aviso pedindo a permissão do sistema na primeira vez */
export async function toggleNotif(key: 'roteiro' | 'orcamento' | 'ia') {
  const on = S().prefs.notif[key];
  if (!on) {
    const ok = await ensureNotifPermission();
    if (!ok) { showToast('Sem permissão, os avisos ficam só dentro do app'); }
  }
  flipNotif(key);
}

/* ---------- Backup em arquivo ---------- */
export async function exportBackup() {
  const { makeBackup, saveBackup } = await import('../lib/backup');
  const n = S().trips.length;
  const ok = await saveBackup(makeBackup(snap()));
  showToast(ok ? 'Backup salvo: ' + plural(n, 'viagem', 'viagens') : 'Não foi possível salvar o backup');
}
export async function importBackup() {
  const { pickBackup, parseBackup } = await import('../lib/backup');
  const text = await pickBackup();
  if (text == null) return; /* a pessoa cancelou a escolha do arquivo: nada muda */
  const r = parseBackup(text);
  if ('error' in r) { showToast(r.error); return; }
  /* pergunta antes: juntar (não apaga nada) ou substituir */
  openSheet('restore', { data: normalizeData(r.data) });
}
export function applyBackup(data: AccountData, mode: 'merge' | 'replace') {
  const u = snap();
  if (mode === 'merge') {
    const r = mergeAccountData(pickData(S()), data);
    setState({ ...r.data, sheet: null, sheetArg: null });
    showToast(r.added ? plural(r.added, 'viagem adicionada', 'viagens adicionadas') + (r.skipped ? ' · ' + plural(r.skipped, 'já existia', 'já existiam') : '') : 'Nenhuma viagem nova no backup: todas já estavam aqui', u);
    return;
  }
  setState({ ...data, sheet: null, sheetArg: null, screen: 'home', history: [], tripId: data.trips[0] ? data.trips[0].id : null } as any);
  showToast('Backup restaurado: ' + plural(data.trips.length, 'viagem', 'viagens') + '. Toque em Desfazer para voltar ao que era antes.', u);
}

/* ---------- Nuvem: sincronizar agora (Perfil) ---------- */
export async function syncNow() {
  const { cloudLastError } = await import('../lib/backend');
  const u = S().user;
  if (!u || !u.id) { showToast('Esta conta guarda as viagens só neste aparelho'); return; }
  setState({ syncState: 'pending' } as any);
  await pullCloud();
  if (S().syncState === 'pending') await flushCloud();
  const st = S().syncState;
  showToast(st === 'ok' ? 'Viagens sincronizadas com a sua conta' : 'Não foi possível sincronizar: ' + (cloudLastError() || 'sem conexão'));
}
