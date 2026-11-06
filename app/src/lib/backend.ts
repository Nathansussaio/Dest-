/* Conta na nuvem (Supabase): cadastro com código por e-mail, entrar, recuperar senha, excluir conta e backup das viagens.
   O banco guarda uma linha por pessoa na tabela "vaults" (veja supabase/schema.sql); cada pessoa só lê e grava a própria linha. */
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from '../config';
import type { AccountData } from '../types';

export interface CloudUser { id: string; name: string; email: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage as any, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    });
    /* renova o acesso só com o app aberto (recomendação do Supabase para celular) */
    AppState.addEventListener('change', (st) => {
      if (st === 'active') client!.auth.startAutoRefresh(); else client!.auth.stopAutoRefresh();
    });
  }
  return client;
}

export const cloud = { enabled: CLOUD_ENABLED };

/* Mensagens do servidor traduzidas para quem usa o app */
function pt(err: any): string {
  const m = String((err && (err.message || err.error_description)) || err || '').toLowerCase();
  if (/invalid login credentials/.test(m)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/.test(m)) return 'Confirme seu e-mail antes de entrar. Enviamos um novo código.';
  if (/already registered|already been registered|user already exists/.test(m)) return 'Já existe uma conta com este e-mail. Tente entrar.';
  if (/token has expired|otp.*expired|expired/.test(m)) return 'O código expirou. Peça um novo.';
  if (/invalid.*(otp|token)|token.*invalid/.test(m)) return 'Código incorreto. Confira e tente de novo.';
  if (/rate limit|too many|security purposes/.test(m)) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (/password should be|weak password/.test(m)) return 'Escolha uma senha mais forte.';
  if (/network|fetch|failed to fetch|timeout/.test(m)) return 'Sem conexão com a internet. Tente de novo em instantes.';
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}
function toUser(u: any): CloudUser {
  const meta = (u && u.user_metadata) || {};
  const email = String(u.email || '').toLowerCase();
  return { id: u.id, email, name: String(meta.name || email.split('@')[0] || 'Viajante') };
}

export async function cloudRestore(): Promise<CloudUser | null> {
  try {
    const { data } = await sb().auth.getSession();
    return data.session && data.session.user ? toUser(data.session.user) : null;
  } catch { return null; }
}

/* Cadastro: o Supabase envia um código de 6 números para o e-mail (modelo de e-mail com {{ .Token }}) */
export async function cloudSignUp(name: string, email: string, pass: string): Promise<Result<{ needsCode: boolean; user: CloudUser | null }>> {
  try {
    const { data, error } = await sb().auth.signUp({ email, password: pass, options: { data: { name } } });
    if (error) return { ok: false, error: pt(error) };
    /* e-mail já cadastrado: o Supabase devolve um usuário sem identidades, sem dizer o motivo */
    if (data.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0) return { ok: false, error: 'Já existe uma conta com este e-mail. Tente entrar.' };
    if (data.session && data.user) return { ok: true, value: { needsCode: false, user: toUser(data.user) } };
    return { ok: true, value: { needsCode: true, user: null } };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudVerifySignup(email: string, code: string): Promise<Result<CloudUser>> {
  try {
    let r = await sb().auth.verifyOtp({ email, token: code, type: 'email' });
    if (r.error) r = await sb().auth.verifyOtp({ email, token: code, type: 'signup' });
    if (r.error || !r.data.user) return { ok: false, error: pt(r.error || 'invalid token') };
    return { ok: true, value: toUser(r.data.user) };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudResend(email: string): Promise<Result<null>> {
  try {
    const { error } = await sb().auth.resend({ type: 'signup', email });
    return error ? { ok: false, error: pt(error) } : { ok: true, value: null };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudSignIn(email: string, pass: string): Promise<Result<CloudUser>> {
  try {
    const { data, error } = await sb().auth.signInWithPassword({ email, password: pass });
    if (error) {
      if (/email not confirmed/i.test(error.message)) await cloudResend(email);
      return { ok: false, error: pt(error) };
    }
    return { ok: true, value: toUser(data.user) };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
/* Recuperar senha: código por e-mail (modelo "Reset password" com {{ .Token }}) + senha nova */
export async function cloudSendReset(email: string): Promise<Result<null>> {
  try {
    const { error } = await sb().auth.resetPasswordForEmail(email);
    return error ? { ok: false, error: pt(error) } : { ok: true, value: null };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudConfirmReset(email: string, code: string, newPass: string): Promise<Result<CloudUser>> {
  try {
    const v = await sb().auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (v.error || !v.data.user) return { ok: false, error: pt(v.error || 'invalid token') };
    const u = await sb().auth.updateUser({ password: newPass });
    if (u.error) return { ok: false, error: pt(u.error) };
    return { ok: true, value: toUser(v.data.user) };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudChangePassword(email: string, cur: string, nw: string): Promise<Result<null>> {
  try {
    const chk = await sb().auth.signInWithPassword({ email, password: cur });
    if (chk.error) return { ok: false, error: /invalid login/i.test(chk.error.message) ? 'Senha atual incorreta.' : pt(chk.error) };
    const { error } = await sb().auth.updateUser({ password: nw });
    return error ? { ok: false, error: pt(error) } : { ok: true, value: null };
  } catch (e) { return { ok: false, error: pt(e) }; }
}
export async function cloudSignOut() { try { await sb().auth.signOut(); } catch { /* sem internet: a sessão local é apagada mesmo assim */ } }

/* Exclusão definitiva (exigência das lojas): função delete_user() no banco apaga a conta e as viagens */
export async function cloudDeleteAccount(): Promise<Result<null>> {
  try {
    const { error } = await sb().rpc('delete_user');
    if (error) return { ok: false, error: pt(error) };
    await cloudSignOut();
    return { ok: true, value: null };
  } catch (e) { return { ok: false, error: pt(e) }; }
}

/* ---------- Backup das viagens ---------- */
/* null = a pessoa ainda não tem nada na nuvem; undefined = não deu para ler agora (sem internet) */
/* último erro da nuvem (para mostrar no Perfil e ajudar a configurar) */
let lastError = '';
export function cloudLastError(): string { return lastError; }
export async function cloudLoad(userId: string): Promise<{ data: AccountData; updatedAt: number } | null | undefined> {
  try {
    const { data, error } = await sb().from('vaults').select('data, updated_at').eq('user_id', userId).maybeSingle();
    if (error) { lastError = error.message || String(error); return undefined; }
    lastError = '';
    if (!data) return null;
    return { data: data.data as AccountData, updatedAt: new Date(data.updated_at as string).getTime() };
  } catch (e: any) { lastError = (e && e.message) || 'sem conexão'; return undefined; }
}
export async function cloudSave(userId: string, payload: AccountData, updatedAt: number): Promise<boolean> {
  try {
    const { error } = await sb().from('vaults').upsert({ user_id: userId, data: payload, updated_at: new Date(updatedAt).toISOString() });
    lastError = error ? error.message || String(error) : '';
    return !error;
  } catch (e: any) { lastError = (e && e.message) || 'sem conexão'; return false; }
}

/* ---------- Viagem em grupo (veja supabase/schema-grupo.sql) ---------- */
export interface SharedRow { id: string; owner: string; data: any; updated_at: string }
function groupErr(e: any): string {
  const m = String((e && (e.message || e.code)) || e || '').toLowerCase();
  if (/invalid invite/.test(m)) return 'Código de convite não encontrado. Confira as letras e tente de novo.';
  if (/trip full/.test(m)) return 'Esta viagem já tem 20 pessoas.';
  if (/relation .* does not exist|could not find the (table|function)|schema cache|42p01|pgrst20[0-9]/.test(m)) return 'A viagem em grupo ainda não foi ligada no Supabase (falta rodar o schema-grupo.sql).';
  if (/network|fetch|timeout/.test(m)) return pt(e);
  /* mostra o motivo técnico junto, para dar para descobrir o que houve */
  const why = String((e && e.message) || e || '').slice(0, 140);
  return 'Não foi possível concluir agora.' + (why ? ' Detalhe: ' + why : '');
}
/* viagens compartilhadas de que a pessoa participa; undefined = não deu para ler agora */
export async function cloudSharedList(): Promise<SharedRow[] | undefined> {
  try {
    const { data, error } = await sb().from('shared_trips').select('id, owner, data, updated_at');
    if (error) return undefined;
    return (data || []) as SharedRow[];
  } catch { return undefined; }
}
export async function cloudSharedCreate(id: string, ownerId: string, ownerName: string, data: any, code: string): Promise<Result<string>> {
  try {
    /* grava e só depois lê: a regra de leitura do banco não enxerga a linha no mesmo passo em que ela é criada */
    const a0 = await sb().from('shared_trips').insert({ id, owner: ownerId, data });
    if (a0.error) return { ok: false, error: groupErr(a0.error) };
    const a = await sb().from('shared_trips').select('updated_at').eq('id', id).single();
    if (a.error) return { ok: false, error: groupErr(a.error) };
    const b = await sb().from('trip_members').insert({ trip_id: id, user_id: ownerId, name: ownerName });
    if (b.error) return { ok: false, error: groupErr(b.error) };
    const c = await sb().from('trip_invites').insert({ code, trip_id: id, created_by: ownerId });
    if (c.error) return { ok: false, error: groupErr(c.error) };
    return { ok: true, value: (a.data as any).updated_at as string };
  } catch (e) { return { ok: false, error: groupErr(e) }; }
}
/* grava só se ninguém mudou desde a última leitura (prev); devolve a nova data, null se outra pessoa gravou antes */
export async function cloudSharedPush(id: string, data: any, prev: string): Promise<string | null | undefined> {
  try {
    const { data: rows, error } = await sb().from('shared_trips').update({ data }).eq('id', id).eq('updated_at', prev).select('updated_at');
    if (error) return undefined;
    return rows && rows.length ? (rows[0] as any).updated_at as string : null;
  } catch { return undefined; }
}
export async function cloudCreateInvite(tripId: string, userId: string, code: string): Promise<Result<string>> {
  try {
    const { error } = await sb().from('trip_invites').insert({ code, trip_id: tripId, created_by: userId });
    return error ? { ok: false, error: groupErr(error) } : { ok: true, value: code };
  } catch (e) { return { ok: false, error: groupErr(e) }; }
}
export async function cloudJoinTrip(code: string, name: string): Promise<Result<string>> {
  try {
    const { data, error } = await sb().rpc('join_trip', { invite: code, member_name: name });
    return error ? { ok: false, error: groupErr(error) } : { ok: true, value: String(data) };
  } catch (e) { return { ok: false, error: groupErr(e) }; }
}
export async function cloudLeaveTrip(tripId: string, userId: string): Promise<Result<null>> {
  try {
    const { error } = await sb().from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
    return error ? { ok: false, error: groupErr(error) } : { ok: true, value: null };
  } catch (e) { return { ok: false, error: groupErr(e) }; }
}
export async function cloudUnshareTrip(tripId: string): Promise<Result<null>> {
  try {
    const { error } = await sb().from('shared_trips').delete().eq('id', tripId);
    return error ? { ok: false, error: groupErr(error) } : { ok: true, value: null };
  } catch (e) { return { ok: false, error: groupErr(e) }; }
}
/* avisa quando alguém do grupo muda uma viagem; devolve a função para parar */
export function cloudWatchShared(onChange: () => void): () => void {
  try {
    const ch = sb().channel('desti-grupo').on('postgres_changes' as any, { event: '*', schema: 'public', table: 'shared_trips' }, () => onChange()).subscribe();
    return () => { try { sb().removeChannel(ch); } catch { /* ignora */ } };
  } catch { return () => {}; }
}
