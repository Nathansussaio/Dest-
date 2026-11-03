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
