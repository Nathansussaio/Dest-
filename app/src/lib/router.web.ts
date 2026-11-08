/* Endereços no site: cada tela ganha o seu, o botão Voltar do navegador volta uma tela,
   o link de uma tela abre direto nela e recarregar a página mantém onde a pessoa estava.
   As regras dos endereços ficam em routes.ts (testadas); aqui é só a ligação com o navegador. */
import { getState, setState, subscribe, type Screen } from '../store/store';
import * as A from '../store/actions';
import { SITE_URL } from '../config';
import { PLACE_BY_ID } from '../data';
import { setPendingInvite } from '../store/shared';
import { pathFor as pathOf, parseRoute, type Route } from './routes';

const TABS: Screen[] = ['home', 'trips', 'explore', 'expenses', 'profile'];
const IN_TRIP: Screen[] = ['trip', 'itinerary', 'map', 'expenses', 'docs', 'assistant', 'addPlace', 'created'];
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
  return pathOf({ user: !!s.user, auth: s.auth, screen: s.screen, tripId: s.tripId, day: s.day, placeId: s.placeId, publicView: s.publicView });
}
/* título da aba (o roteiro público define o próprio, com destino e datas) */
let publicTitle = '';
export function setPublicTitle(t: string) { publicTitle = t; if (typeof document !== 'undefined' && getState().publicView) document.title = t; }
export function titleFor(s: St): string {
  if (s.publicView) return publicTitle || 'Roteiro compartilhado · Destí';
  if (s.notFound) return (s.notFound === 'trip' ? 'Viagem não encontrada' : s.notFound === 'place' ? 'Lugar não encontrado' : 'Página não encontrada') + ' · Destí';
  if (!s.user) return s.auth === 'login' ? 'Entrar · Destí' : s.auth === 'signup' ? 'Criar conta · Destí' : s.auth === 'forgot' ? 'Esqueci a senha · Destí' : HOME_TITLE;
  const t = s.tripId ? s.trips.find((x) => x.id === s.tripId) : null;
  if (s.screen === 'place' && s.placeId) { const p = PLACE_BY_ID[s.placeId]; return (p ? p.name : 'Lugar') + ' · Destí'; }
  if (s.screen === 'trip' && t) return t.name + ' · Destí';
  if (s.screen === 'itinerary' && t) return 'Roteiro · ' + t.name + ' · Dia ' + (s.day + 1) + ' · Destí';
  if (IN_TRIP.indexOf(s.screen) >= 0 && t && TITLE[s.screen]) return TITLE[s.screen] + ' · ' + t.name + ' · Destí';
  return (TITLE[s.screen] || 'Destí') + ' · Destí';
}
export { parseRoute as parsePath };

/* telas que precisam de conta (ou do modo visitante): sem ninguém conectado, abrem depois de entrar */
let pending: Route | null = null;

/* aplica um endereço ao estado. Devolve false quando não deu (e mostra a tela de "não encontrado" quando for o caso) */
function apply(r: Route | null, pushHistory: boolean): boolean {
  const s = getState();
  if (!r) return false;
  if (r.unknown) { setState({ notFound: 'page', publicView: null, sheet: null }); return true; }
  /* roteiro compartilhado: abre para qualquer pessoa, com ou sem conta */
  if (r.publicId) { setState({ publicView: r.publicId, notFound: null, sheet: null }); return true; }
  /* convite para viagem em grupo: com conta, entra direto; sem conta, entra depois de fazer login */
  if (r.invite) {
    const code = r.invite;
    if (s.user && s.user.id) { A.joinByCode(code).then((e) => { if (e) A.showToast(e); }); }
    else { setPendingInvite(code); if (!s.user) setState({ auth: 'login' }); A.showToast(s.user ? 'Para editar junto, entre com uma conta' : 'Entre ou crie sua conta para participar da viagem'); }
    return true;
  }
  if (r.auth) { if (!s.user) { setState({ auth: r.auth }); return true; } return false; }
  if (!r.screen) return false;
  if (!s.user) {
    /* sem conta: guarda o destino e mostra a entrada; depois de entrar, abre a tela pedida */
    pending = r;
    if (r.screen !== 'home') { setState({ auth: 'login' }); A.showToast('Entre (ou use o modo visitante) para abrir esta página'); }
    return true;
  }
  const screen: Screen = r.screen === 'created' ? 'trip' : r.screen; /* a tela de viagem criada só existe logo depois de criar */
  if (r.tripId && !s.trips.some((t) => t.id === r.tripId)) { setState({ notFound: 'trip', publicView: null, sheet: null }); return true; }
  if (screen === 'place' && (!r.placeId || !PLACE_BY_ID[r.placeId])) { setState({ notFound: 'place', publicView: null, sheet: null }); return true; }
  const extra: any = { screen, sheet: null, notFound: null, publicView: null };
  if (r.tripId) extra.tripId = r.tripId;
  if (r.day != null) { const t = s.trips.find((x) => x.id === (r.tripId || s.tripId)); extra.day = t ? Math.max(0, Math.min(r.day, t.days.length - 1)) : 0; }
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
  const current = () => parseRoute(here().slice(base.length), window.location.search);
  let idx = 0, booted = false, fromPop = false, lastPath = '', lastDay = -1, lastScreen = '', hadUser = false;
  const sync = () => {
    const s = getState();
    if (!s.ready) return;
    if (!booted) {
      booted = true;
      hadUser = !!s.user;
      const r = current();
      if (r) apply(r, false);
      const st = getState();
      lastPath = pathFor(st); lastDay = st.day; lastScreen = st.screen;
      /* "não encontrado": mantém o endereço que a pessoa digitou */
      if (!st.notFound) { try { window.history.replaceState({ i: 0 }, '', full(lastPath)); } catch { /* ignora */ } }
      document.title = titleFor(st);
      return;
    }
    /* acabou de entrar: abre a tela que o link pedia */
    if (!hadUser && s.user && pending) { const r = pending; pending = null; hadUser = true; apply(r, false); return; }
    hadUser = !!s.user;
    document.title = titleFor(s);
    if (s.notFound) return;
    const p = pathFor(s);
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
    else apply(current(), true);
    idx = to;
    sync();
    fromPop = false;
  };
  window.addEventListener('popstate', onPop);
  const unsub = subscribe(sync);
  sync();
  return () => { window.removeEventListener('popstate', onPop); unsub(); };
}
