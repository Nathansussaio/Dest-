-- Destí: atualização de 8/11/2026 (só as duas funções novas). Rode uma vez em SQL Editor › New query › Run.
-- Quem rodar o schema-grupo.sql e o schema-publico.sql inteiros de novo não precisa deste arquivo.

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
