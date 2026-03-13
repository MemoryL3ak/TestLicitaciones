create table if not exists public.vendedor_metas_canal_mensuales (
  id bigint generated always as identity primary key,
  vendedor_email text not null,
  periodo date not null,
  canal text null,
  meta_neto bigint not null check (meta_neto >= 0),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vendedor_metas_canal_mensuales_periodo_mes_check
    check (periodo = date_trunc('month', periodo)::date),
  constraint vendedor_metas_canal_mensuales_unique
    unique (vendedor_email, periodo),
  constraint vendedor_metas_canal_mensuales_canal_check
    check (
      canal is null
      or canal in (
        'vendedor_terreno',
        'vendedor_mixto',
        'vendedor_mercado_publico',
        'pagina_web',
        'vendedor_tienda',
        'vendedor_freelance'
      )
    )
);

create index if not exists idx_vendedor_metas_canal_mensuales_periodo
  on public.vendedor_metas_canal_mensuales (periodo);

create index if not exists idx_vendedor_metas_canal_mensuales_email
  on public.vendedor_metas_canal_mensuales (vendedor_email);

create index if not exists idx_vendedor_metas_canal_mensuales_canal
  on public.vendedor_metas_canal_mensuales (canal);

alter table public.vendedor_metas_canal_mensuales enable row level security;

drop policy if exists "vendedor_metas_canal_mensuales_select_auth" on public.vendedor_metas_canal_mensuales;
create policy "vendedor_metas_canal_mensuales_select_auth"
on public.vendedor_metas_canal_mensuales
for select
to authenticated
using (true);

drop policy if exists "vendedor_metas_canal_mensuales_insert_auth" on public.vendedor_metas_canal_mensuales;
create policy "vendedor_metas_canal_mensuales_insert_auth"
on public.vendedor_metas_canal_mensuales
for insert
to authenticated
with check (true);

drop policy if exists "vendedor_metas_canal_mensuales_update_auth" on public.vendedor_metas_canal_mensuales;
create policy "vendedor_metas_canal_mensuales_update_auth"
on public.vendedor_metas_canal_mensuales
for update
to authenticated
using (true)
with check (true);

drop policy if exists "vendedor_metas_canal_mensuales_delete_auth" on public.vendedor_metas_canal_mensuales;
create policy "vendedor_metas_canal_mensuales_delete_auth"
on public.vendedor_metas_canal_mensuales
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
