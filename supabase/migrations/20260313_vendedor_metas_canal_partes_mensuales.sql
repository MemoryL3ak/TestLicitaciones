create table if not exists public.vendedor_metas_canal_partes_mensuales (
  id bigint generated always as identity primary key,
  vendedor_email text not null,
  periodo date not null,
  canal_base text not null,
  meta_neto bigint not null check (meta_neto >= 0),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vendedor_metas_canal_partes_mensuales_periodo_mes_check
    check (periodo = date_trunc('month', periodo)::date),
  constraint vendedor_metas_canal_partes_mensuales_unique
    unique (vendedor_email, periodo, canal_base),
  constraint vendedor_metas_canal_partes_mensuales_canal_base_check
    check (
      canal_base in (
        'vendedor_terreno',
        'vendedor_mercado_publico',
        'pagina_web',
        'vendedor_tienda',
        'vendedor_freelance'
      )
    )
);

create index if not exists idx_vendedor_metas_canal_partes_periodo
  on public.vendedor_metas_canal_partes_mensuales (periodo);

create index if not exists idx_vendedor_metas_canal_partes_email
  on public.vendedor_metas_canal_partes_mensuales (vendedor_email);

create index if not exists idx_vendedor_metas_canal_partes_canal_base
  on public.vendedor_metas_canal_partes_mensuales (canal_base);

alter table public.vendedor_metas_canal_partes_mensuales enable row level security;

drop policy if exists "vendedor_metas_canal_partes_select_auth" on public.vendedor_metas_canal_partes_mensuales;
create policy "vendedor_metas_canal_partes_select_auth"
on public.vendedor_metas_canal_partes_mensuales
for select
to authenticated
using (true);

drop policy if exists "vendedor_metas_canal_partes_insert_auth" on public.vendedor_metas_canal_partes_mensuales;
create policy "vendedor_metas_canal_partes_insert_auth"
on public.vendedor_metas_canal_partes_mensuales
for insert
to authenticated
with check (true);

drop policy if exists "vendedor_metas_canal_partes_update_auth" on public.vendedor_metas_canal_partes_mensuales;
create policy "vendedor_metas_canal_partes_update_auth"
on public.vendedor_metas_canal_partes_mensuales
for update
to authenticated
using (true)
with check (true);

drop policy if exists "vendedor_metas_canal_partes_delete_auth" on public.vendedor_metas_canal_partes_mensuales;
create policy "vendedor_metas_canal_partes_delete_auth"
on public.vendedor_metas_canal_partes_mensuales
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
