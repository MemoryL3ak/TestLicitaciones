create table if not exists public.canal_metas_mensuales (
  id bigint generated always as identity primary key,
  canal text not null,
  periodo date not null,
  meta_neto bigint not null check (meta_neto >= 0),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint canal_metas_mensuales_periodo_mes_check
    check (periodo = date_trunc('month', periodo)::date),
  constraint canal_metas_mensuales_unique
    unique (canal, periodo),
  constraint canal_metas_mensuales_canal_check
    check (
      canal in (
        'vendedor_terreno',
        'vendedor_mixto',
        'vendedor_mercado_publico',
        'pagina_web',
        'vendedor_tienda',
        'vendedor_freelance'
      )
    )
);

create index if not exists idx_canal_metas_mensuales_periodo
  on public.canal_metas_mensuales (periodo);

create index if not exists idx_canal_metas_mensuales_canal
  on public.canal_metas_mensuales (canal);

alter table public.canal_metas_mensuales enable row level security;

drop policy if exists "canal_metas_mensuales_select_auth" on public.canal_metas_mensuales;
create policy "canal_metas_mensuales_select_auth"
on public.canal_metas_mensuales
for select
to authenticated
using (true);

drop policy if exists "canal_metas_mensuales_insert_auth" on public.canal_metas_mensuales;
create policy "canal_metas_mensuales_insert_auth"
on public.canal_metas_mensuales
for insert
to authenticated
with check (true);

drop policy if exists "canal_metas_mensuales_update_auth" on public.canal_metas_mensuales;
create policy "canal_metas_mensuales_update_auth"
on public.canal_metas_mensuales
for update
to authenticated
using (true)
with check (true);

drop policy if exists "canal_metas_mensuales_delete_auth" on public.canal_metas_mensuales;
create policy "canal_metas_mensuales_delete_auth"
on public.canal_metas_mensuales
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
