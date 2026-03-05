alter table public.licitaciones
  add column if not exists fecha_adjudicada timestamptz null;
