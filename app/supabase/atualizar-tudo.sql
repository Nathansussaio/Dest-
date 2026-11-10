-- Destí: tudo o que falta no banco (novembro/2026), num arquivo só.
-- Rode uma vez em SQL Editor › New query › Run. Pode rodar de novo sem problema.
-- Junta: atualizar-convites-e-links.sql + schema-publico-visitante.sql

create or replace function public.public_id_for_trip(tid text) returns text
language sql stable security definer set search_path = public as $$
  select id from public.public_trips where trip_id = tid order by updated_at desc limit 1;
$$;
revoke all on function public.public_id_for_trip(text) from public;
grant execute on function public.public_id_for_trip(text) to anon, authenticated;

create or replace function public.invite_info(invite text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip_id', s.id,
    'name', s.data->'trip'->>'name',
    'country', s.data->'trip'->>'country',
    'start', s.data->'trip'->>'start',
    'end', s.data->'trip'->>'end',
    'by', coalesce((select m.name from public.trip_members m where m.trip_id = s.id and m.user_id = i.created_by), ''),
    'people', (select count(*) from public.trip_members m where m.trip_id = s.id),
    'member', exists (select 1 from public.trip_members m where m.trip_id = s.id and m.user_id = auth.uid())
  )
  from public.trip_invites i join public.shared_trips s on s.id = i.trip_id
  where i.code = upper(trim(invite)) and auth.uid() is not null;
$$;
revoke all on function public.invite_info(text) from public, anon;
grant execute on function public.invite_info(text) to authenticated;

-- Link público no modo visitante (sem conta)
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
