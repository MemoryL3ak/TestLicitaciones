alter table public.licitacion_documentos
  add column if not exists fecha_factura date null;

-- Fuerza a PostgREST a recargar el schema cache
notify pgrst, 'reload schema';
