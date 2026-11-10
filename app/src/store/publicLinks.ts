/* Link público do roteiro (só leitura): criar, atualizar sozinho quando a viagem muda e desativar.
   Com conta: o link fica ligado à conta (public_trips.owner).
   Modo visitante: o banco devolve uma chave secreta guardada só neste aparelho (trip.publicToken),
   que serve para atualizar e desativar o link (supabase/schema-publico-visitante.sql).
   Se o banco ainda não tem as funções do visitante, o site oferece "Criar conta e publicar roteiro". */
import { getState, setState, addDataHook } from './store';
import { cloudPublicSave, cloudPublicDelete, cloudGuestPublish, cloudGuestUpdate, cloudGuestDelete, cloud } from '../lib/backend';
import { publicSnapshot, newPublicId, publicLink } from '../lib/publicCore';
import { stable } from '../lib/sharedCore';
import { SITE_URL } from '../config';

const S = getState;
function me(): string | null { const u = S().user; return u && u.id && u.method !== 'guest' ? u.id : null; }
/* dá para gerar link: com conta, ou no modo visitante quando o site está ligado à nuvem */
export function canPublish(): boolean { return cloud.enabled && !!S().user; }
export function linkOf(id: string): string { return publicLink(SITE_URL, id); }

/* o banco ainda não tem a parte do visitante: lembra para não tentar de novo a cada toque */
let guestOff = false;
export function guestPublishUnavailable() { return guestOff; }

const sent: Record<string, string> = {}; /* último conteúdo enviado de cada link (evita enviar sem mudança) */
export async function createPublicLink(tripId: string): Promise<{ error?: string; url?: string; needAccount?: boolean }> {
  const t = S().trips.find((x) => x.id === tripId);
  if (!t) return { error: 'Viagem não encontrada.' };
  if (t.publicId) return { url: linkOf(t.publicId) };
  if (!cloud.enabled) return { error: 'Este site ainda não está ligado à nuvem, então não dá para publicar roteiros. Use Copiar texto ou Gerar PDF.' };
  const uid = me();
  const id = newPublicId();
  const snap = publicSnapshot(t);
  if (uid) {
    const r = await cloudPublicSave(id, uid, tripId, snap, true);
    if (!r.ok) return { error: r.error };
    sent[id] = tripId + '|' + stable(snap);
    setState((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, publicId: id } : x)) }));
    return { url: linkOf(id) };
  }
  /* modo visitante */
  const r = await cloudGuestPublish(id, tripId, snap);
  if (r === 'nofunc') { guestOff = true; return { needAccount: true, error: 'O link público exige sincronização para que outras pessoas possam abrir este roteiro em outro aparelho.' }; }
  if (!r.ok) return { error: r.error };
  sent[id] = tripId + '|' + stable(snap);
  setState((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, publicId: id, publicToken: r.token } : x)) }));
  return { url: linkOf(id) };
}
export async function disablePublicLink(tripId: string): Promise<string | null> {
  const t = S().trips.find((x) => x.id === tripId);
  if (!t || !t.publicId) return null;
  const r = t.publicToken ? await cloudGuestDelete(t.publicId, t.publicToken) : await cloudPublicDelete(t.publicId);
  if (!r.ok) return r.error;
  setState((s) => ({ trips: s.trips.map((x) => { if (x.id !== tripId) return x; const y = { ...x }; delete y.publicId; delete y.publicToken; return y; }) }));
  return null;
}
/* a viagem mudou (roteiro, datas, nome): o link mostra a versão nova em poucos segundos */
let timer: ReturnType<typeof setTimeout> | null = null;
async function refresh() {
  const uid = me();
  for (const t of S().trips) {
    if (!t.publicId) continue;
    const snap = publicSnapshot(t), key = t.id + '|' + stable(snap); /* o id muda quando a viagem passa a ser em grupo */
    if (sent[t.publicId] === key) continue;
    let done = false;
    if (t.publicToken) done = await cloudGuestUpdate(t.publicId, t.publicToken, snap);
    else if (uid) { const r = await cloudPublicSave(t.publicId, uid, t.id, snap, false); done = r.ok; }
    if (done) sent[t.publicId] = key;
  }
}
addDataHook(() => {
  if (!S().trips.some((t) => t.publicId)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; refresh(); }, 2500);
});

/* ---------- Plano B: "Criar conta e publicar roteiro" ----------
   Guarda qual viagem publicar; depois do cadastro (com as viagens do visitante já na conta),
   abre a viagem, volta ao painel de compartilhar e gera o link sozinho. */
const PK = 'desti:publicar';
let pendingPublish: string | null = (() => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PK) : null; } catch { return null; } })();
export function publishAfterSignup(tripId: string) { pendingPublish = tripId; try { sessionStorage.setItem(PK, tripId); } catch { /* sem armazenamento */ } }
export function takePublishAfterSignup(): string | null { const t = pendingPublish; pendingPublish = null; try { sessionStorage.removeItem(PK); } catch { /* ignora */ } return t; }
