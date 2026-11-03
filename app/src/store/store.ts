/* Estado do app (uma única fonte de verdade), cópia no aparelho e backup na nuvem.
   Com o Supabase configurado, as viagens de cada conta ficam na nuvem e uma cópia fica no aparelho para usar sem internet.
   Sem o Supabase, tudo fica só no aparelho. */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountData, Style } from '../types';
import { freshData } from '../lib/accounts';
import { CLOUD_ENABLED } from '../config';
import { cloudRestore, cloudLoad, cloudSave } from '../lib/backend';

export type Screen =
  | 'home' | 'trips' | 'explore' | 'expenses' | 'profile'
  | 'create' | 'created' | 'trip' | 'itinerary' | 'addPlace' | 'map' | 'saved' | 'assistant' | 'place'
  | 'docs' | 'style' | 'onboard' | 'alerts';
export type AuthScreen = 'welcome' | 'login' | 'signup' | 'verify' | 'forgot';
export type Sheet = 'expense' | 'editTrip' | 'people' | 'share' | 'password' | 'delete' | 'resForm' | null;

/* id = conta na nuvem; contas só do aparelho não têm id */
export interface User { id?: string; name: string; email: string; method: 'email' | 'guest' }
export interface LocalAccount { name: string; email: string; passHash: string }

export interface UIState {
  ready: boolean;
  user: User | null;
  accounts: LocalAccount[];                  /* só no modo sem nuvem */
  vault: Record<string, AccountData>;       /* cópia no aparelho dos dados de cada conta, por e-mail */
  vaultTime: Record<string, number>;        /* quando cada cópia mudou pela última vez */
  auth: AuthScreen;
  screen: Screen; history: Screen[];
  tripId: string | null; day: number; placeId: string | null; styleId: Style;
  sheet: Sheet; sheetArg: any;
  toast: { msg: string; undo: AccountData | null; id: number } | null;
  pendingGuest: AccountData | null;
  lockedUntil: number; attempts: number;
  createdId: string | null; createdPlan: import('../types').ItineraryItem[][] | null;
  syncState: 'ok' | 'pending' | 'offline';
}

export type State = UIState & AccountData;

const KEY = 'desti:v1';

let state: State = {
  ready: false, user: null, accounts: [], vault: {}, vaultTime: {}, auth: 'welcome',
  screen: 'home', history: [], tripId: null, day: 0, placeId: null, styleId: 'Cultural',
  sheet: null, sheetArg: null, toast: null, pendingGuest: null, lockedUntil: 0, attempts: 0, createdId: null, createdPlan: null,
  syncState: 'ok',
  ...freshData()
};
const listeners = new Set<() => void>();

export function getState(): State { return state; }
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  /* os dados da conta conectada são guardados junto (exceto no modo visitante) */
  const u = state.user;
  if (u && u.method !== 'guest' && touchesData(p)) {
    const email = u.email, now = Date.now();
    state = { ...state, vault: { ...state.vault, [email]: pickData(state) }, vaultTime: { ...state.vaultTime, [email]: now } };
    persistSoon();
    if (u.id) cloudSoon();
  } else if ('accounts' in p || 'vault' in p || 'user' in p) persistSoon();
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useApp(): State { return useSyncExternalStore(subscribe, getState, getState); }

export const DATA_KEYS: (keyof AccountData)[] = ['trips', 'expenses', 'reservations', 'checklist', 'saved', 'savedDest', 'chat', 'prefs', 'sec', 'dishDone', 'alertsRead'];
function touchesData(p: Partial<State>) { return DATA_KEYS.some((k) => k in p); }
export function pickData(s: State): AccountData {
  const o: any = {};
  DATA_KEYS.forEach((k) => { o[k] = (s as any)[k]; });
  return o;
}
/* dados guardados por versões antigas ganham os campos novos */
export function normalizeData(d: Partial<AccountData> | null | undefined): AccountData {
  const base = freshData();
  if (!d) return base;
  return { ...base, ...d, prefs: { ...base.prefs, ...(d.prefs || {}) }, sec: { ...base.sec, ...(d.sec || {}) } } as AccountData;
}

/* ---------- Cópia no aparelho ---------- */
let saveT: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (!state.ready) return;
  if (saveT) clearTimeout(saveT);
  saveT = setTimeout(() => {
    const payload = {
      accounts: CLOUD_ENABLED ? [] : state.accounts, vault: state.vault, vaultTime: state.vaultTime,
      lastUser: state.user && state.user.method !== 'guest' ? state.user : null
    };
    AsyncStorage.setItem(KEY, JSON.stringify(payload)).catch(() => { /* sem espaço: o app segue funcionando */ });
  }, 400);
}
export function flushSave() { persistSoon(); }

/* ---------- Backup na nuvem (só com conta na nuvem) ---------- */
let cloudT: ReturnType<typeof setTimeout> | null = null;
function cloudSoon(delay = 1500) {
  if (cloudT) clearTimeout(cloudT);
  if (state.syncState !== 'pending') { state = { ...state, syncState: 'pending' }; }
  cloudT = setTimeout(flushCloud, delay);
}
/* só envia depois de ler a nuvem nesta sessão: um celular novo (cópia vazia) nunca apaga as viagens guardadas */
let pulledFor: string | null = null;
export async function flushCloud() {
  const u = state.user;
  if (!u || !u.id || u.method === 'guest' || state.syncState === 'ok' || pulledFor !== u.email) return;
  const data = state.vault[u.email], t = state.vaultTime[u.email] || Date.now();
  if (!data) { state = { ...state, syncState: 'ok' }; listeners.forEach((l) => l()); return; }
  const ok = await cloudSave(u.id, data, t);
  if (state.user && state.user.email === u.email) {
    state = { ...state, syncState: ok ? 'ok' : 'offline' };
    listeners.forEach((l) => l());
  }
}

/* Traz da nuvem os dados da conta; vale a versão mais recente (nuvem ou aparelho) */
export async function pullCloud(): Promise<void> {
  const u = state.user;
  if (!u || !u.id) return;
  const remote = await cloudLoad(u.id);
  if (!state.user || state.user.email !== u.email) return;
  if (remote === undefined) { state = { ...state, syncState: 'offline' }; listeners.forEach((l) => l()); return; }
  pulledFor = u.email;
  const localT = state.vaultTime[u.email] || 0;
  if (remote && remote.updatedAt > localT) {
    const data = normalizeData(remote.data);
    state = { ...state, ...data, vault: { ...state.vault, [u.email]: data }, vaultTime: { ...state.vaultTime, [u.email]: remote.updatedAt }, syncState: 'ok',
      tripId: state.tripId && data.trips.some((t) => t.id === state.tripId) ? state.tripId : data.trips.length ? data.trips[0].id : null };
    persistSoon();
    listeners.forEach((l) => l());
  } else if (!remote || remote.updatedAt < localT) {
    state = { ...state, syncState: 'pending' };
    await flushCloud();
  }
}

export async function loadFromDevice() {
  let accounts: LocalAccount[] = [];
  let vault: Record<string, AccountData> = {}, vaultTime: Record<string, number> = {};
  let lastUser: User | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      accounts = j.accounts || [];
      vault = j.vault || {};
      vaultTime = j.vaultTime || {};
      lastUser = j.lastUser || null;
    }
  } catch { /* cópia corrompida: começa do zero */ }
  if (CLOUD_ENABLED) {
    /* a sessão do Supabase decide quem está conectado */
    const cu = await cloudRestore();
    lastUser = cu ? { id: cu.id, name: cu.name, email: cu.email, method: 'email' } : null;
  } else if (lastUser && lastUser.id) lastUser = null;
  const data = lastUser ? normalizeData(vault[lastUser.email]) : freshData();
  state = {
    ...state, ...data, ready: true, accounts, vault, vaultTime, user: lastUser,
    tripId: data.trips.length ? data.trips[0].id : null, screen: 'home', history: []
  };
  listeners.forEach((l) => l());
  if (lastUser && lastUser.id) pullCloud();
}
