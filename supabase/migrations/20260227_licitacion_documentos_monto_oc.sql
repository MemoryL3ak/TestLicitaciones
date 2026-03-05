alter table public.licitacion_documentos
  add column if not exists monto bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'licitacion_documentos_monto_nonnegative'
  ) then
    alter table public.licitacion_documentos
      add constraint licitacion_documentos_monto_nonnegative
      check (monto is null or monto >= 0);
  end if;
end $$;

-- Fuerza a PostgREST a recargar el schema cache
notify pgrst, 'reload schema';
