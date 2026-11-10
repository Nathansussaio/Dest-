-- Destí: link público do roteiro também para o modo visitante (sem conta).
-- Rode no Supabase em SQL Editor › New query › Run, depois do schema-publico.sql. Pode rodar de novo sem problema.
--
-- Como funciona: o visitante não tem conta, então o link é controlado por uma chave secreta que o banco gera
-- e devolve só uma vez. O site guarda essa chave no aparelho e a usa para atualizar ou desativar o link.
-- O banco guarda só o resumo (hash) da chave. Ninguém lista os links: a leitura continua pela get_public_trip.
-- Proteções: só o roteiro (até 200 KB), no máximo 300 links novos de visitantes por hora no total.

alter table public.public_trips alter column owner drop not null;
alter table public.public_trips add column if not exists token_hash text;

create or replace function public.publish_guest_trip(pid text, tid text, payload jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if pid is null or char_length(pid) < 10 or char_length(pid) > 40 or pid !~ '^[a-z0-9]+$' then raise exception 'invalid id'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 200000 then raise exception 'invalid payload'; end if;
  if (select count(*) from public.public_trips where owner is null and created_at > now() - interval '1 hour') >= 300 then raise exception 'too many links'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into public.public_trips (id, owner, trip_id, data, token_hash)
    values (pid, null, coalesce(left(tid, 60), ''), payload, encode(digest(tok, 'sha256'), 'hex'));
  return tok;
end;
$$;

create or replace function public.update_guest_trip(pid text, tok text, payload jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 200000 then raise exception 'invalid payload'; end if;
  update public.public_trips set data = payload, updated_at = now()
    where id = pid and owner is null and token_hash = encode(digest(coalesce(tok, ''), 'sha256'), 'hex');
  return found;
end;
$$;

create or replace function public.delete_guest_trip(pid text, tok text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.public_trips
    where id = pid and owner is null and token_hash = encode(digest(coalesce(tok, ''), 'sha256'), 'hex');
  return found;
end;
$$;

revoke all on function public.publish_guest_trip(text, text, jsonb) from public;
revoke all on function public.update_guest_trip(text, text, jsonb) from public;
revoke all on function public.delete_guest_trip(text, text) from public;
grant execute on function public.publish_guest_trip(text, text, jsonb) to anon, authenticated;
grant execute on function public.update_guest_trip(text, text, jsonb) to anon, authenticated;
grant execute on function public.delete_guest_trip(text, text) to anon, authenticated;
