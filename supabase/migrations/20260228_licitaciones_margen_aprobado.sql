alter table public.licitaciones
  add column if not exists margen_aprobado boolean not null default false;
