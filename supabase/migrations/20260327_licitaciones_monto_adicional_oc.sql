alter table public.licitaciones
  add column if not exists monto_adicional_oc integer default 0;
