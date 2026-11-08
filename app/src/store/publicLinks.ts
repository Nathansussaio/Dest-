/* Link público do roteiro (só leitura): criar, atualizar sozinho quando a viagem muda e desativar.
   Precisa de conta na nuvem (o link fica guardado no Supabase, em public_trips). */
import { getState, setState, addDataHook } from './store';
import { cloudPublicSave, cloudPublicDelete } from '../lib/backend';
import { publicSnapshot, newPublicId, publicLink } from '../lib/publicCore';
import { stable } from '../lib/sharedCore';
import { SITE_URL } from '../config';

const S = getState;
function me(): string | null { const u = S().user; return u && u.id && u.method !== 'guest' ? u.id : null; }
export function canPublish(): boolean { return !!me(); }
export function linkOf(id: string): string { return publicLink(SITE_URL, id); }

const sent: Record<string, string> = {}; /* último conteúdo enviado de cada link (evita enviar sem mudança) */
export async function createPublicLink(tripId: string): Promise<{ error?: string; url?: string }> {
  const uid = me();
  const t = S().trips.find((x) => x.id === tripId);
  if (!t) return { error: 'Viagem não encontrada.' };
  if (!uid) return { error: 'Para gerar um link público, crie uma conta ou sincronize esta viagem. Sem conta, use Copiar texto ou Gerar PDF.' };
  if (t.publicId) return { url: linkOf(t.publicId) };
  const id = newPublicId();
  const snap = publicSnapshot(t);
  const r = await cloudPublicSave(id, uid, tripId, snap, true);
  if (!r.ok) return { error: r.error };
  sent[id] = tripId + '|' + stable(snap);
  setState((s) => ({ trips: s.trips.map((x) => (x.id === tripId ? { ...x, publicId: id } : x)) }));
  return { url: linkOf(id) };
}
export async function disablePublicLink(tripId: string): Promise<string | null> {
  const t = S().trips.find((x) => x.id === tripId);
  if (!t || !t.publicId) return null;
  const r = await cloudPublicDelete(t.publicId);
  if (!r.ok) return r.error;
  setState((s) => ({ trips: s.trips.map((x) => { if (x.id !== tripId) return x; const y = { ...x }; delete y.publicId; return y; }) }));
  return null;
}
/* a viagem mudou (roteiro, datas, nome): o link mostra a versão nova em poucos segundos */
let timer: ReturnType<typeof setTimeout> | null = null;
async function refresh() {
  const uid = me();
  if (!uid) return;
  for (const t of S().trips) {
    if (!t.publicId) continue;
    const snap = publicSnapshot(t), key = t.id + '|' + stable(snap); /* o id muda quando a viagem passa a ser em grupo */
    if (sent[t.publicId] === key) continue;
    const r = await cloudPublicSave(t.publicId, uid, t.id, snap, false);
    if (r.ok) sent[t.publicId] = key;
  }
}
addDataHook(() => {
  if (!S().trips.some((t) => t.publicId)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; refresh(); }, 2500);
});
