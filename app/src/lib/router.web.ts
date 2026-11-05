/* Endereços no site: cada tela ganha o seu (ex.: /viagem/<id>/roteiro/2), o botão Voltar do navegador
   volta uma tela, o link de uma tela abre direto nela e recarregar a página mantém onde a pessoa estava. */
import { getState, setState, subscribe, type Screen } from '../store/store';
import * as A from '../store/actions';
import { SITE_URL } from '../config';
import { PLACE_BY_ID } from '../data';

const SEG: Record<Screen, string> = {
  home: 'inicio', trips: 'viagens', explore: 'explorar', expenses: 'gastos', profile: 'perfil', create: 'nova-viagem',
  created: 'viagem-criada', trip: '', itinerary: 'roteiro', addPlace: 'adicionar-lugar', map: 'mapa', saved: 'salvos',
  assistant: 'assistente', place: 'lugar', docs: 'reservas', style: 'estilo', onboard: 'primeiros-passos', alerts: 'avisos'
};
const IN_TRIP: Screen[] = ['trip', 'itinerary', 'map', 'expenses', 'docs', 'assistant', 'addPlace', 'created'];
const TABS: Screen[] = ['home', 'trips', 'explore', 'expenses', 'profile'];
const AUTH_SEG: Record<string, string> = { welcome: '', login: 'entrar', signup: 'criar-conta', forgot: 'esqueci-a-senha', verify: 'confirmar-email' };
const TITLE: Partial<Record<Screen, string>> = {
  home: 'Início', trips: 'Minhas viagens', explore: 'Explorar', expenses: 'Gastos', profile: 'Perfil', create: 'Nova viagem',
  created: 'Viagem criada', itinerary: 'Roteiro', addPlace: 'Adicionar lugar', map: 'Mapa', saved: 'Salvos', assistant: 'Assistente',
  docs: 'Reservas', style: 'Estilos de viagem', onboard: 'Primeiros passos', alerts: 'Avisos'
};
const HOME_TITLE = 'Destí: roteiro de viagem, gastos e reservas';

function basePath(): string {
  try { return new URL(SITE_URL).pathname.replace(/\/+$/, ''); } catch { return ''; }
}
type St = ReturnType<typeof getState>;
export function pathFor(s: St): string {
  if (!s.user) return AUTH_SEG[s.auth] || '';
  const sc = s.screen;
  if (sc === 'place' && s.placeId) return 'lugar/' + encodeURIComponent(s.placeId);
  if (IN_TRIP.indexOf(sc) >= 0 && s.tripId) {
    const b = 'viagem/' + encodeURIComponent(s.tripId);
    if (sc === 'trip') return b;
    if (sc === 'itinerary') return b + '/roteiro/' + (s.day + 1);
    return b + '/' + SEG[sc];
  }
  return SEG[sc] || 'inicio';
}
export function titleFor(s: St): string {
  if (!s.user) return s.auth === 'login' ? 'Entrar · Destí' : s.auth === 'signup' ? 'Criar conta · Destí' : HOME_TITLE;
  const t = s.tripId ? s.trips.find((x) => x.id === s.tripId) : null;
  if (s.screen === 'place' && s.placeId) { const p = PLACE_BY_ID[s.placeId]; return (p ? p.name : 'Lugar') + ' · Destí'; }
  if (s.screen === 'trip' && t) return t.name + ' · Destí';
  if (s.screen === 'itinerary' && t) return 'Roteiro · ' + t.name + ' · Dia ' + (s.day + 1) + ' · Destí';
  if (IN_TRIP.indexOf(s.screen) >= 0 && t && TITLE[s.screen]) return TITLE[s.screen] + ' · ' + t.name + ' · Destí';
  return (TITLE[s.screen] || 'Destí') + ' · Destí';
}
/* lê um endereço e devolve a tela */
export function parsePath(p: string): { screen?: Screen; auth?: string; tripId?: string; day?: number; placeId?: string } | null {
  const parts = p.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
  if (!parts.length) return null;
  const authKey = Object.keys(AUTH_SEG).find((k) => AUTH_SEG[k] && AUTH_SEG[k] === parts[0]);
  if (authKey) return { auth: authKey };
  if (parts[0] === 'lugar' && parts[1]) return { screen: 'place', placeId: parts[1] };
  if (parts[0] === 'viagem' && parts[1]) {
    if (!parts[2]) return { screen: 'trip', tripId: parts[1] };
    if (parts[2] === 'roteiro') return { screen: 'itinerary', tripId: parts[1], day: Math.max(0, (parseInt(parts[3] || '1', 10) || 1) - 1) };
    const sc = (Object.keys(SEG) as Screen[]).find((k) => SEG[k] === parts[2] && IN_TRIP.indexOf(k) >= 0);
    return sc ? { screen: sc, tripId: parts[1] } : { screen: 'trip', tripId: parts[1] };
  }
  const sc = (Object.keys(SEG) as Screen[]).find((k) => SEG[k] && SEG[k] === parts[0]);
  return sc ? { screen: sc } : null;
}

/* aplica um endereço ao estado (só o que existe: viagem e lugar precisam existir) */
function apply(r: ReturnType<typeof parsePath>, pushHistory: boolean): boolean {
  const s = getState();
  if (!r) return false;
  if (r.auth) { if (!s.user) { setState({ auth: r.auth as any }); return true; } return false; }
  if (!s.user || !r.screen) return false;
  const screen: Screen = r.screen === 'created' ? 'trip' : r.screen; /* a tela de viagem criada só existe logo depois de criar */
  if (r.tripId && !s.trips.some((t) => t.id === r.tripId)) return false;
  if (screen === 'place' && (!r.placeId || !PLACE_BY_ID[r.placeId])) return false;
  const extra: any = { screen, sheet: null };
  if (r.tripId) extra.tripId = r.tripId;
  if (r.day != null) { const t = s.trips.find((x) => x.id === (r.tripId || s.tripId)); extra.day = t ? Math.min(r.day, t.days.length - 1) : 0; }
  if (r.placeId) extra.placeId = r.placeId;
  extra.history = TABS.indexOf(screen) >= 0 ? [] : pushHistory ? s.history.concat([s.screen]) : (screen === 'trip' ? ['trips'] : r.tripId ? ['trips', 'trip'] : ['home']);
  setState(extra);
  return true;
}

export function initRouter(): () => void {
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return () => {};
  const base = basePath();
  const here = () => window.location.pathname;
  if (base && here().indexOf(base) !== 0) return () => {}; /* aberto fora do site (ex.: prévia): sem endereços */
  const full = (p: string) => base + '/' + p;
  let idx = 0, booted = false, fromPop = false, lastPath = '', lastDay = -1, lastScreen = '';
  const sync = () => {
    const s = getState();
    if (!s.ready) return;
    if (!booted) {
      booted = true;
      const r = parsePath(here().slice(base.length));
      if (r) apply(r, false);
      const st = getState();
      lastPath = pathFor(st); lastDay = st.day; lastScreen = st.screen;
      try { window.history.replaceState({ i: 0 }, '', full(lastPath) + window.location.search); } catch { /* ignora */ }
      document.title = titleFor(st);
      return;
    }
    const p = pathFor(s);
    document.title = titleFor(s);
    if (p === lastPath && !fromPop) return;
    /* trocar de dia no roteiro não empilha: o Voltar sai do roteiro, não passa dia por dia */
    const sameScreenDay = s.screen === 'itinerary' && lastScreen === 'itinerary' && s.day !== lastDay;
    try {
      if (fromPop || sameScreenDay) window.history.replaceState({ i: idx }, '', full(p));
      else { idx += 1; window.history.pushState({ i: idx }, '', full(p)); }
    } catch { /* ignora */ }
    lastPath = p; lastDay = s.day; lastScreen = s.screen;
  };
  const onPop = (e: PopStateEvent) => {
    const to = e.state && typeof e.state.i === 'number' ? e.state.i : 0;
    fromPop = true;
    if (to < idx) { if (!A.back()) { /* já está no começo do app: deixa o navegador seguir */ } }
    else apply(parsePath(here().slice(base.length)), true);
    idx = to;
    sync();
    fromPop = false;
  };
  window.addEventListener('popstate', onPop);
  const unsub = subscribe(sync);
  sync();
  return () => { window.removeEventListener('popstate', onPop); unsub(); };
}
