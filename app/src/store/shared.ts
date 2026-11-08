/* Viagem em grupo sincronizada: cada pessoa no seu celular, editando a mesma viagem.
   Cada viagem compartilhada tem uma linha na tabela shared_trips (supabase/schema-grupo.sql).
   - Mudou aqui: envia em ~1 segundo (só se ninguém gravou antes; se gravou, junta as duas versões e envia de novo).
   - Mudou em outro celular: o Supabase avisa na hora (tempo real) e, de reserva, o app confere a cada minuto. */
import { getState, setState, subscribe, setDataHook, type State } from './store';
import type { Trip, Member, Expense } from '../types';
import { tripMembers } from '../lib/group';
import { cloudSharedList, cloudSharedCreate, cloudSharedPush, cloudCreateInvite, cloudJoinTrip, cloudLeaveTrip, cloudUnshareTrip, cloudWatchShared, type SharedRow } from '../lib/backend';
import { toShared, fromShared, hashOf, mergeParts, makeCode, cleanCode, newSharedId, type LocalPart } from '../lib/sharedCore';

const S = getState;
type Meta = State['shareMeta'];

function myId(): string | null { const u = S().user; return u && u.id && u.method !== 'guest' ? u.id : null; }
function myName(): string { const u = S().user; return (u && u.name) || 'Viajante'; }
export function canShare(): boolean { return !!myId(); }
export function hasShared(s: State = S()): boolean { return s.trips.some((t) => !!t.shared); }

export function partOf(s: State, id: string): LocalPart | null {
  const trip = s.trips.find((t) => t.id === id);
  if (!trip) return null;
  return { trip, expenses: s.expenses.filter((e) => e.tripId === id), reservations: s.reservations.filter((r) => r.tripId === id), checklist: s.checklist[id] || [] };
}
/* troca (ou acrescenta) a viagem e tudo o que é dela */
function putPart(s: State, p: LocalPart, oldId?: string): Partial<State> {
  const id = p.trip.id, drop = oldId || id;
  const has = s.trips.some((t) => t.id === drop);
  const trips = has ? s.trips.map((t) => (t.id === drop ? p.trip : t)) : s.trips.concat([p.trip]);
  const checklist = { ...s.checklist };
  delete checklist[drop];
  checklist[id] = p.checklist;
  return {
    trips,
    expenses: s.expenses.filter((e) => e.tripId !== drop).concat(p.expenses),
    reservations: s.reservations.filter((r) => r.tripId !== drop).concat(p.reservations),
    checklist,
    tripId: s.tripId === drop ? id : s.tripId
  };
}
function dropPart(s: State, id: string): Partial<State> {
  const trips = s.trips.filter((t) => t.id !== id), checklist = { ...s.checklist };
  delete checklist[id];
  const meta = { ...s.shareMeta };
  delete meta[id];
  return { trips, expenses: s.expenses.filter((e) => e.tripId !== id), reservations: s.reservations.filter((r) => r.tripId !== id), checklist, shareMeta: meta, tripId: s.tripId === id ? (trips[0] ? trips[0].id : null) : s.tripId };
}
/* a pessoa deste celular aparece na lista de quem vai (para dividir os gastos) */
function withMe(t: Trip, owner: string, expenses: Expense[] = []): Trip {
  const ms: Member[] = tripMembers(t);
  if (ms.some((m) => m.id === 'me')) return { ...t, members: ms, travelers: ms.length };
  const me: Member = { id: 'me', name: myName(), status: owner === myId() ? 'owner' : 'ativo' };
  /* quem entra pelo convite ocupa o primeiro lugar reservado ("Viajante 2") que ainda não tem gastos */
  const used = (id: string) => expenses.some((e) => (e.paidBy || 'me') === id || (e.split || []).indexOf(id) >= 0) || (t.settlements || []).some((x) => x.from === id || x.to === id);
  const slot = ms.find((m) => m.placeholder && !used(m.id));
  const members = slot ? ms.filter((m) => m.id !== slot.id).concat([me]) : ms.concat([me]);
  return { ...t, members, travelers: members.length };
}

let toastFn: ((m: string) => void) | null = null;
export function setSharedToast(f: (m: string) => void) { toastFn = f; }
const say = (m: string) => { if (toastFn) toastFn(m); };

/* ---------- Sincronizar ---------- */
let running = false, again = false, applying = false;
const recent: Record<string, number> = {}; /* acabou de compartilhar: a lista da nuvem pode ainda não ter a viagem */
let timer: ReturnType<typeof setTimeout> | null = null;
export function sharedSoon(ms = 1200) {
  if (applying || !myId() || !hasShared()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncShared(); }, ms);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apply(row: SharedRow, me: string, base: LocalPart | null, merged?: LocalPart) {
  const remote = fromShared(row.data, me);
  const local = base;
  let next: LocalPart = merged || remote;
  /* fotos de notas e arquivos ficam só no celular onde foram tirados */
  if (local) {
    const rec: Record<string, any> = {}, files: Record<string, any> = {};
    local.expenses.forEach((e) => { if (e.receipt) rec[e.id] = e.receipt; });
    local.reservations.forEach((r) => { if (r.file && r.file.uri) files[r.id] = r.file.uri; });
    next = {
      ...next,
      expenses: next.expenses.map((e) => (rec[e.id] && !e.receipt ? { ...e, receipt: rec[e.id] } : e)),
      reservations: next.reservations.map((r) => (files[r.id] && r.file && !r.file.uri ? { ...r, file: { ...r.file, uri: files[r.id] } } : r))
    };
  }
  const code = local && local.trip.shared ? local.trip.shared.code : undefined;
  const pub = local ? local.trip.publicId : undefined;
  next = { ...next, trip: { ...next.trip, id: row.id, shared: { owner: row.owner, ...(code ? { code } : {}) }, ...(pub ? { publicId: pub } : {}) } };
  /* resumo do que veio da nuvem: se o conteúdo deste celular ficar diferente, ele é enviado */
  const h = hashOf(toShared({ ...remote, trip: { ...remote.trip, id: row.id } }, me));
  next = { ...next, trip: withMe(next.trip, row.owner, next.expenses) };
  applying = true;
  try {
    setState((s) => ({ ...putPart(s, next), shareMeta: { ...s.shareMeta, [row.id]: { h, at: row.updated_at } } }));
  } finally { applying = false; }
}

export async function syncShared(): Promise<boolean> {
  const me = myId();
  if (!me) return false;
  if (running) { again = true; while (running) await sleep(80); return true; }
  running = true;
  let ok = true;
  try {
    do {
      again = false;
      const rows = await cloudSharedList();
      if (rows === undefined) { ok = false; break; }
      if (myId() !== me) { ok = false; break; }
      const seen: Record<string, boolean> = {};
      for (const row of rows) {
        seen[row.id] = true;
        let s = S();
        const local = partOf(s, row.id), m: Meta[string] | undefined = s.shareMeta[row.id];
        if (!local || !m) { apply(row, me, local); }
        else {
          const dirty = hashOf(toShared(local, me)) !== m.h, changed = row.updated_at !== m.at;
          if (changed && !dirty) apply(row, me, local);
          else if (changed && dirty) apply(row, me, local, mergeParts(local, fromShared(row.data, me)));
        }
        /* mudou aqui (ou acabou de juntar): envia */
        s = S();
        const cur = partOf(s, row.id), mm = s.shareMeta[row.id];
        if (!cur || !mm) continue;
        const payload = toShared(cur, me), h = hashOf(payload);
        if (h === mm.h) continue;
        const at = await cloudSharedPush(row.id, payload, mm.at);
        if (at === undefined) { ok = false; continue; }
        if (at === null) { again = true; continue; } /* outra pessoa gravou antes: lê de novo e junta */
        setState((st) => ({ shareMeta: { ...st.shareMeta, [row.id]: { h, at } } }));
      }
      /* viagens que deixaram de ser compartilhadas (ou de que a pessoa saiu): fica uma cópia só neste celular */
      const gone = S().trips.filter((t) => t.shared && !seen[t.id] && !(recent[t.id] && Date.now() - recent[t.id] < 15000));
      if (gone.length) {
        applying = true;
        try {
          setState((s) => {
            const meta = { ...s.shareMeta };
            gone.forEach((t) => { delete meta[t.id]; });
            return { trips: s.trips.map((t) => (gone.some((g) => g.id === t.id) ? { ...t, shared: undefined } : t)), shareMeta: meta };
          });
        } finally { applying = false; }
        say(gone.length === 1 ? gone[0].name + ' deixou de ser compartilhada. Ficou uma cópia neste aparelho.' : gone.length + ' viagens deixaram de ser compartilhadas. Ficou uma cópia neste aparelho.');
      }
    } while (again && myId() === me);
  } finally { running = false; }
  return ok;
}

/* ---------- Ações ---------- */
export async function shareTrip(tripId: string): Promise<string | null> {
  const me = myId();
  if (!me) return 'Entre com sua conta para editar a viagem junto com outras pessoas.';
  const base = partOf(S(), tripId);
  if (!base) return 'Viagem não encontrada.';
  if (base.trip.shared) return null;
  const id = newSharedId(), code = makeCode();
  const trip = withMe({ ...base.trip, id }, me, base.expenses);
  const part: LocalPart = {
    trip, expenses: base.expenses.map((e) => ({ ...e, tripId: id })), reservations: base.reservations.map((r) => ({ ...r, tripId: id })), checklist: base.checklist
  };
  const payload = toShared(part, me);
  recent[id] = Date.now();
  const r = await cloudSharedCreate(id, me, myName(), payload, code);
  if (!r.ok) return r.error;
  /* o que mudou enquanto criava: pega a versão mais nova deste celular */
  const now = partOf(S(), tripId) || base;
  const latest: LocalPart = {
    trip: withMe({ ...now.trip, id, shared: { owner: me, code } }, me, now.expenses),
    expenses: now.expenses.map((e) => ({ ...e, tripId: id })), reservations: now.reservations.map((x) => ({ ...x, tripId: id })), checklist: now.checklist
  };
  applying = true;
  try {
    setState((s) => ({ ...putPart(s, latest, tripId), shareMeta: { ...s.shareMeta, [id]: { h: hashOf(payload), at: r.value } } }));
  } finally { applying = false; }
  sharedSoon(300);
  return null;
}
export async function newInvite(tripId: string): Promise<string | null> {
  const me = myId();
  const t = S().trips.find((x) => x.id === tripId);
  if (!me || !t || !t.shared) return 'Esta viagem ainda não é compartilhada.';
  const code = makeCode();
  const r = await cloudCreateInvite(tripId, me, code);
  if (!r.ok) return r.error;
  setState((s) => ({ trips: s.trips.map((x) => (x.id === tripId && x.shared ? { ...x, shared: { ...x.shared, code } } : x)) }));
  return null;
}
export async function joinTrip(input: string): Promise<{ error?: string; tripId?: string }> {
  const code = cleanCode(input);
  if (code.length < 6) return { error: 'Digite o código do convite (8 letras e números).' };
  if (!myId()) { pendingInvite = code; return { error: 'Entre com sua conta para participar desta viagem.' }; }
  const r = await cloudJoinTrip(code, myName());
  if (!r.ok) return { error: r.error };
  await syncShared();
  const t = S().trips.find((x) => x.id === r.value);
  return t ? { tripId: t.id } : { error: 'Você entrou na viagem, mas não deu para baixar agora. Ela aparece quando a conexão voltar.' };
}
export async function leaveTrip(tripId: string): Promise<string | null> {
  const me = myId();
  const t = S().trips.find((x) => x.id === tripId);
  if (!me || !t || !t.shared) return null;
  const r = await cloudLeaveTrip(tripId, me);
  if (!r.ok) return r.error;
  applying = true;
  try { setState((s) => dropPart(s, tripId)); } finally { applying = false; }
  return null;
}
export async function stopSharing(tripId: string): Promise<string | null> {
  const t = S().trips.find((x) => x.id === tripId);
  if (!t || !t.shared) return null;
  const r = await cloudUnshareTrip(tripId);
  if (!r.ok) return r.error;
  setState((s) => {
    const meta = { ...s.shareMeta };
    delete meta[tripId];
    return { trips: s.trips.map((x) => (x.id === tripId ? { ...x, shared: undefined } : x)), shareMeta: meta };
  });
  return null;
}
/* o dono tira alguém do grupo (a pessoa perde o acesso; o nome continua nos gastos antigos) */
export async function removeFromGroup(tripId: string, memberId: string): Promise<string | null> {
  if (!/^u:/.test(memberId)) return null;
  const r = await cloudLeaveTrip(tripId, memberId.slice(2));
  return r.ok ? null : r.error;
}
/* quem pode tirar pessoas do grupo */
export function isOwner(t: Trip): boolean { return !!t.shared && t.shared.owner === myId(); }

/* ---------- Convite por link (site: /convite/<código>) ---------- */
let pendingInvite: string | null = null;
export function setPendingInvite(code: string) { pendingInvite = cleanCode(code); }
export function takePendingInvite(): string | null { const c = pendingInvite; pendingInvite = null; return c; }

/* ---------- Liga e desliga com a conta ---------- */
let watching: string | null = null, unwatch: (() => void) | null = null, poll: ReturnType<typeof setInterval> | null = null;
let onJoined: ((tripId: string) => void) | null = null;
let checked = false;
export function setOnJoined(f: (tripId: string) => void) { onJoined = f; }
function start(id: string) {
  watching = id;
  setTimeout(async () => {
    if (watching !== id) return;
    if (hasShared()) { checked = true; await syncShared(); }
    const code = takePendingInvite();
    if (code && watching === id) {
      const r = await joinTrip(code);
      if (r.tripId) { if (onJoined) onJoined(r.tripId); } else if (r.error) say(r.error);
    }
  }, 600);
  unwatch = cloudWatchShared(() => { if (hasShared()) sharedSoon(300); });
  poll = setInterval(() => {
    if (!hasShared()) return;
    if (typeof document !== 'undefined' && (document as any).hidden) return;
    sharedSoon(0);
  }, 60000);
}
function stop() {
  watching = null;
  if (unwatch) { unwatch(); unwatch = null; }
  if (poll) { clearInterval(poll); poll = null; }
  if (timer) { clearTimeout(timer); timer = null; }
}
export async function flushShared() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (myId() && hasShared()) await syncShared();
}
setDataHook(() => sharedSoon());
subscribe(() => {
  const s = S();
  if (!s.ready) return;
  const id = myId();
  if (id === watching) {
    /* viagens em grupo que chegaram pelo backup da conta (outro aparelho): confere a versão do grupo */
    if (id && !checked && hasShared(s)) { checked = true; sharedSoon(300); }
    return;
  }
  stop();
  checked = false;
  if (id) start(id);
});
