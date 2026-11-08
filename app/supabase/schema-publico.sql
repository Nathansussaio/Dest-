-- Destí: link público do roteiro (só leitura, sem login).
-- Rode no Supabase em SQL Editor › New query › Run. Pode rodar de novo sem problema.
-- Quem tem conta cria o link; qualquer pessoa com o link vê o roteiro (sem gastos, reservas nem nomes).
-- Ninguém consegue listar os links: a leitura é só pela função get_public_trip, com o id exato.

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
