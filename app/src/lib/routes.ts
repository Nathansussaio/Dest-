/* Endereços do site (regras puras, testadas em tests/routes.test.ts).
   GitHub Pages só devolve "200 OK" para arquivos que existem. Por isso:
   - telas fixas viram pastas com uma cópia do index.html (ex.: /viagens/), geradas por tools/static-routes.mjs;
   - telas com id usam o id na consulta (?id=), dentro de uma pasta fixa: /viagem/?id=…, /roteiro/?id=…, /convite/?c=…
   Endereços antigos (/viagem/<id>/mapa, /convite/<código>) continuam abrindo pelo 404.html e são trocados pelo novo. */
import type { Screen, AuthScreen } from '../store/store';

export const SEG: Record<Screen, string> = {
  home: 'inicio', trips: 'viagens', explore: 'explorar', expenses: 'gastos', profile: 'perfil', create: 'nova-viagem',
  created: 'viagem-criada', trip: '', itinerary: 'roteiro', addPlace: 'adicionar-lugar', map: 'mapa', saved: 'salvos',
  assistant: 'assistente', place: 'lugar', docs: 'reservas', style: 'estilo', onboard: 'primeiros-passos', alerts: 'avisos'
};
export const IN_TRIP: Screen[] = ['trip', 'itinerary', 'map', 'expenses', 'docs', 'assistant', 'addPlace', 'created'];
export const AUTH_SEG: Record<AuthScreen, string> = { welcome: '', login: 'entrar', signup: 'criar-conta', forgot: 'esqueci-a-senha', verify: 'confirmar-email' };
/* pastas geradas no site (cada uma recebe uma cópia do index.html com título próprio) */
export const STATIC_DIRS: { dir: string; title: string }[] = [
  { dir: 'inicio', title: 'Início' }, { dir: 'viagens', title: 'Minhas viagens' }, { dir: 'explorar', title: 'Explorar destinos' },
  { dir: 'gastos', title: 'Gastos da viagem' }, { dir: 'perfil', title: 'Perfil' }, { dir: 'nova-viagem', title: 'Nova viagem' },
  { dir: 'salvos', title: 'Lugares salvos' }, { dir: 'avisos', title: 'Avisos' }, { dir: 'estilo', title: 'Estilos de viagem' },
  { dir: 'primeiros-passos', title: 'Primeiros passos' },
  { dir: 'entrar', title: 'Entrar' }, { dir: 'criar-conta', title: 'Criar conta' }, { dir: 'esqueci-a-senha', title: 'Esqueci a senha' },
  { dir: 'confirmar-email', title: 'Confirmar e-mail' },
  { dir: 'viagem', title: 'Viagem' }, { dir: 'lugar', title: 'Lugar' },
  { dir: 'roteiro', title: 'Roteiro de viagem compartilhado' }, { dir: 'convite', title: 'Convite para editar uma viagem' }
];

export interface RouteState { user: boolean; auth: AuthScreen; screen: Screen; tripId: string | null; day: number; placeId: string | null; publicView: string | null }
export interface Route {
  screen?: Screen; auth?: AuthScreen; tripId?: string; day?: number; placeId?: string;
  invite?: string;          /* convite para editar junto (código) */
  publicId?: string;        /* roteiro compartilhado, só leitura */
  legacy?: boolean;         /* endereço antigo: trocar pelo novo */
  unknown?: boolean;        /* endereço que não existe */
}

/* endereço (sem o caminho base do site) para o estado atual */
export function pathFor(s: RouteState): string {
  if (s.publicView) return 'roteiro/?id=' + encodeURIComponent(s.publicView);
  if (!s.user) return AUTH_SEG[s.auth] ? AUTH_SEG[s.auth] + '/' : '';
  const sc = s.screen;
  if (sc === 'place' && s.placeId) return 'lugar/?id=' + encodeURIComponent(s.placeId);
  if (IN_TRIP.indexOf(sc) >= 0 && s.tripId) {
    const b = 'viagem/?id=' + encodeURIComponent(s.tripId);
    if (sc === 'trip' || sc === 'created') return b;
    if (sc === 'itinerary') return b + '&tela=roteiro&dia=' + (s.day + 1);
    return b + '&tela=' + SEG[sc];
  }
  return (SEG[sc] || 'inicio') + '/';
}

function screenOfSeg(seg: string, inTrip: boolean): Screen | undefined {
  return (Object.keys(SEG) as Screen[]).find((k) => SEG[k] && SEG[k] === seg && (inTrip ? IN_TRIP.indexOf(k) >= 0 : IN_TRIP.indexOf(k) < 0 || k === 'expenses'));
}

/* lê um endereço: path = parte depois do caminho base (ex.: "/viagem/"), search = "?id=…" */
export function parseRoute(path: string, search = ''): Route | null {
  let parts: string[];
  try { parts = path.split('/').filter(Boolean).map((x) => decodeURIComponent(x)); } catch { return { unknown: true }; }
  const q: Record<string, string> = {};
  try { new URLSearchParams(search || '').forEach((v, k) => { q[k] = v; }); } catch { /* sem consulta */ }
  if (!parts.length || (parts.length === 1 && parts[0] === 'index.html')) return null;
  const head = parts[0];
  const authKey = (Object.keys(AUTH_SEG) as AuthScreen[]).find((k) => AUTH_SEG[k] && AUTH_SEG[k] === head);
  if (authKey) return parts.length === 1 ? { auth: authKey } : { unknown: true };
  if (head === 'roteiro') {
    const id = q.id || parts[1];
    return id ? { publicId: id, legacy: !q.id } : { unknown: true };
  }
  if (head === 'convite') {
    const c = q.c || parts[1];
    return c ? { invite: c, legacy: !q.c } : { unknown: true };
  }
  if (head === 'lugar') {
    const id = q.id || parts[1];
    return id ? { screen: 'place', placeId: id, legacy: !q.id } : { unknown: true };
  }
  if (head === 'viagem') {
    const legacy = !q.id;
    const id = q.id || parts[1];
    if (!id) return { unknown: true };
    const tela = legacy ? parts[2] : q.tela;
    const dia = legacy ? parts[3] : q.dia;
    if (!tela) return { screen: 'trip', tripId: id, legacy };
    if (tela === 'roteiro') return { screen: 'itinerary', tripId: id, day: Math.max(0, (parseInt(dia || '1', 10) || 1) - 1), legacy };
    const sc = screenOfSeg(tela, true);
    return sc ? { screen: sc, tripId: id, legacy } : { screen: 'trip', tripId: id, legacy };
  }
  if (parts.length > 1) return { unknown: true };
  const sc = screenOfSeg(head, false);
  return sc ? { screen: sc } : { unknown: true };
}
