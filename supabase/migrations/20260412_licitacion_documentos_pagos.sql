alter table public.licitacion_documentos
  add column if not exists pagada boolean default false,
  add column if not exists fecha_pago date null,
  add column if not exists forma_pago text null;

-- Fuerza a PostgREST a recargar el schema cache
notify pgrst, 'reload schema';
