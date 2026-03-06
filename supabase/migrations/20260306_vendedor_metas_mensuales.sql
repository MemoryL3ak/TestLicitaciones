create table if not exists public.vendedor_metas_mensuales (
  id bigint generated always as identity primary key,
  vendedor_email text not null,
  periodo date not null,
  meta_neto bigint not null check (meta_neto >= 0),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vendedor_metas_mensuales_periodo_mes_check
    check (periodo = date_trunc('month', periodo)::date),
  constraint vendedor_metas_mensuales_unique
    unique (vendedor_email, periodo)
);

create index if not exists idx_vendedor_metas_mensuales_periodo
  on public.vendedor_metas_mensuales (periodo);

create index if not exists idx_vendedor_metas_mensuales_email
  on public.vendedor_metas_mensuales (vendedor_email);

alter table public.vendedor_metas_mensuales enable row level security;

drop policy if exists "vendedor_metas_mensuales_select_auth" on public.vendedor_metas_mensuales;
create policy "vendedor_metas_mensuales_select_auth"
on public.vendedor_metas_mensuales
for select
to authenticated
using (true);

drop policy if exists "vendedor_metas_mensuales_insert_auth" on public.vendedor_metas_mensuales;
create policy "vendedor_metas_mensuales_insert_auth"
on public.vendedor_metas_mensuales
for insert
to authenticated
with check (true);

drop policy if exists "vendedor_metas_mensuales_update_auth" on public.vendedor_metas_mensuales;
create policy "vendedor_metas_mensuales_update_auth"
on public.vendedor_metas_mensuales
for update
to authenticated
using (true)
with check (true);

drop policy if exists "vendedor_metas_mensuales_delete_auth" on public.vendedor_metas_mensuales;
create policy "vendedor_metas_mensuales_delete_auth"
on public.vendedor_metas_mensuales
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
