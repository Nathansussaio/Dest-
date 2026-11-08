-- Destí: banco de dados no Supabase (cole tudo em SQL Editor > New query > Run)
-- Uma linha por pessoa com todas as viagens dela; cada pessoa só lê e grava a própria linha.

create table if not exists public.vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

drop policy if exists "ler a propria" on public.vaults;
drop policy if exists "criar a propria" on public.vaults;
drop policy if exists "atualizar a propria" on public.vaults;
drop policy if exists "apagar a propria" on public.vaults;
create policy "ler a propria" on public.vaults for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar a propria" on public.vaults for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "atualizar a propria" on public.vaults for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar a propria" on public.vaults for delete to authenticated using ((select auth.uid()) = user_id);

-- Excluir conta pelo app (exigência da App Store e do Google Play): apaga as viagens e a conta de quem chamou.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.vaults where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- ============================================================
-- Viagem em grupo sincronizada (o mesmo conteúdo de schema-grupo.sql)
-- ============================================================

-- Uma linha por viagem compartilhada: roteiro, gastos, reservas e checklist num único campo
create table if not exists public.shared_trips (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
-- Quem participa de cada viagem
create table if not exists public.trip_members (
  trip_id text not null references public.shared_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
-- Códigos de convite
create table if not exists public.trip_invites (
  code text primary key,
  trip_id text not null references public.shared_trips(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shared_trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;

-- A pessoa participa da viagem? (security definer evita regras que se chamam em círculo)
create or replace function public.is_trip_member(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trip_members where trip_id = t and user_id = auth.uid())
      or exists (select 1 from public.shared_trips where id = t and owner = auth.uid());
$$;

-- Quem gravou e quando: o banco preenche (ninguém consegue falsificar)
create or replace function public.shared_trips_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists shared_trips_touch on public.shared_trips;
create trigger shared_trips_touch before insert or update on public.shared_trips
  for each row execute function public.shared_trips_touch();

-- Regras: viagens
drop policy if exists "ler viagens do grupo" on public.shared_trips;
create policy "ler viagens do grupo" on public.shared_trips for select to authenticated using (public.is_trip_member(id));
drop policy if exists "criar viagem compartilhada" on public.shared_trips;
create policy "criar viagem compartilhada" on public.shared_trips for insert to authenticated with check (owner = auth.uid());
drop policy if exists "editar viagem do grupo" on public.shared_trips;
create policy "editar viagem do grupo" on public.shared_trips for update to authenticated using (public.is_trip_member(id)) with check (public.is_trip_member(id));
drop policy if exists "parar de compartilhar" on public.shared_trips;
create policy "parar de compartilhar" on public.shared_trips for delete to authenticated using (owner = auth.uid());
-- quem participa só muda o conteúdo (o dono continua o mesmo)
revoke update on public.shared_trips from anon, authenticated;
grant update (data) on public.shared_trips to authenticated;

-- Regras: participantes
drop policy if exists "ver participantes" on public.trip_members;
create policy "ver participantes" on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
drop policy if exists "dono entra na propria viagem" on public.trip_members;
create policy "dono entra na propria viagem" on public.trip_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.shared_trips s where s.id = trip_id and s.owner = auth.uid()));
drop policy if exists "sair ou remover" on public.trip_members;
create policy "sair ou remover" on public.trip_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.shared_trips s where s.id = trip_id and s.owner = auth.uid()));

-- Regras: convites
drop policy if exists "criar convite" on public.trip_invites;
create policy "criar convite" on public.trip_invites for insert to authenticated with check (created_by = auth.uid() and public.is_trip_member(trip_id));
drop policy if exists "ver meus convites" on public.trip_invites;
create policy "ver meus convites" on public.trip_invites for select to authenticated using (created_by = auth.uid());
drop policy if exists "apagar convite" on public.trip_invites;
create policy "apagar convite" on public.trip_invites for delete to authenticated
  using (created_by = auth.uid() or exists (select 1 from public.shared_trips s where s.id = trip_id and s.owner = auth.uid()));

-- Entrar numa viagem com o código do convite (devolve o id da viagem)
create or replace function public.join_trip(invite text, member_name text) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select trip_id into t from public.trip_invites where code = upper(trim(invite));
  if t is null then raise exception 'invalid invite'; end if;
  if (select count(*) from public.trip_members where trip_id = t) >= 20 then raise exception 'trip full'; end if;
  insert into public.trip_members (trip_id, user_id, name)
    values (t, auth.uid(), coalesce(nullif(left(trim(member_name), 60), ''), 'Viajante'))
    on conflict (trip_id, user_id) do update set name = excluded.name;
  return t;
end;
$$;
revoke all on function public.join_trip(text, text) from public, anon;
grant execute on function public.join_trip(text, text) to authenticated;

-- Avisos em tempo real quando alguém do grupo muda a viagem
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_trips') then
    alter publication supabase_realtime add table public.shared_trips;
  end if;
end $$;

-- Ver o convite antes de aceitar (só com conta): nome da viagem, datas, quem convidou e quantas pessoas.
-- Devolve nada quando o código não existe (ou a viagem deixou de ser compartilhada).
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

-- ============================================================
-- Link público do roteiro (o mesmo conteúdo de schema-publico.sql)
-- ============================================================

create table if not exists public.public_trips (
  id text primary key check (char_length(id) between 10 and 40),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.public_trips enable row level security;

-- o dono vê, cria, atualiza e apaga os próprios links
drop policy if exists "dono le os links" on public.public_trips;
create policy "dono le os links" on public.public_trips for select to authenticated using (owner = auth.uid());
drop policy if exists "dono cria link" on public.public_trips;
create policy "dono cria link" on public.public_trips for insert to authenticated with check (owner = auth.uid());
drop policy if exists "dono atualiza link" on public.public_trips;
create policy "dono atualiza link" on public.public_trips for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "dono apaga link" on public.public_trips;
create policy "dono apaga link" on public.public_trips for delete to authenticated using (owner = auth.uid());

-- limite: até 100 links por pessoa
create or replace function public.public_trips_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.public_trips where owner = new.owner) >= 100 then raise exception 'too many links'; end if;
  return new;
end;
$$;
drop trigger if exists public_trips_limit on public.public_trips;
create trigger public_trips_limit before insert on public.public_trips for each row execute function public.public_trips_limit();

-- leitura pública pelo id exato (sem conta)
create or replace function public.get_public_trip(pid text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data || jsonb_build_object('updated_at', updated_at) from public.public_trips where id = pid;
$$;
revoke all on function public.get_public_trip(text) from public;
grant execute on function public.get_public_trip(text) to anon, authenticated;

-- link antigo de viagem (/viagem/<id>) aberto por outra pessoa: se a viagem tem link público, devolve o id dele
create or replace function public.public_id_for_trip(tid text) returns text
language sql stable security definer set search_path = public as $$
  select id from public.public_trips where trip_id = tid order by updated_at desc limit 1;
$$;
revoke all on function public.public_id_for_trip(text) from public;
grant execute on function public.public_id_for_trip(text) to anon, authenticated;
