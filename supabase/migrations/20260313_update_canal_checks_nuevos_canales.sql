alter table public.vendedor_metas_canal_mensuales
  drop constraint if exists vendedor_metas_canal_mensuales_canal_check;

alter table public.vendedor_metas_canal_mensuales
  add constraint vendedor_metas_canal_mensuales_canal_check
  check (
    canal is null
    or canal in (
      'vendedor_terreno',
      'vendedor_tienda_terreno',
      'vendedor_terreno_mercado_publico',
      'vendedor_mercado_publico',
      'pagina_web',
      'vendedor_tienda',
      'vendedor_freelance',
      'vendedor_mixto'
    )
  );

alter table public.canal_metas_mensuales
  drop constraint if exists canal_metas_mensuales_canal_check;

alter table public.canal_metas_mensuales
  add constraint canal_metas_mensuales_canal_check
  check (
    canal in (
      'vendedor_terreno',
      'vendedor_tienda_terreno',
      'vendedor_terreno_mercado_publico',
      'vendedor_mercado_publico',
      'pagina_web',
      'vendedor_tienda',
      'vendedor_freelance',
      'vendedor_mixto'
    )
  );

notify pgrst, 'reload schema';
