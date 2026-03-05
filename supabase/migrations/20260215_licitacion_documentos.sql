create table if not exists public.licitacion_documentos (
  id bigint generated always as identity primary key,
  licitacion_id bigint not null,
  tipo text not null check (tipo in ('orden_compra', 'guia_despacho', 'factura')),
  numero text null,
  deriva_de_id bigint null references public.licitacion_documentos(id) on delete set null,
  bucket text not null check (bucket in ('orden-compra', 'guia-despacho', 'factura')),
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes bigint null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'licitaciones'
  )
  and not exists (
    select 1
    from pg_constraint
    where conname = 'licitacion_documentos_licitacion_id_fkey'
  ) then
    alter table public.licitacion_documentos
      add constraint licitacion_documentos_licitacion_id_fkey
      foreign key (licitacion_id)
      references public.licitaciones(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_licitacion_documentos_licitacion_id
  on public.licitacion_documentos (licitacion_id);

create index if not exists idx_licitacion_documentos_tipo
  on public.licitacion_documentos (tipo);

alter table public.licitacion_documentos enable row level security;

drop policy if exists "licitacion_documentos_select_auth" on public.licitacion_documentos;
create policy "licitacion_documentos_select_auth"
on public.licitacion_documentos
for select
to authenticated
using (true);

drop policy if exists "licitacion_documentos_insert_auth" on public.licitacion_documentos;
create policy "licitacion_documentos_insert_auth"
on public.licitacion_documentos
for insert
to authenticated
with check (true);

drop policy if exists "licitacion_documentos_update_auth" on public.licitacion_documentos;
create policy "licitacion_documentos_update_auth"
on public.licitacion_documentos
for update
to authenticated
using (true)
with check (true);

drop policy if exists "licitacion_documentos_delete_auth" on public.licitacion_documentos;
create policy "licitacion_documentos_delete_auth"
on public.licitacion_documentos
for delete
to authenticated
using (true);

drop policy if exists "docs_storage_select_auth" on storage.objects;
create policy "docs_storage_select_auth"
on storage.objects
for select
to authenticated
using (bucket_id in ('orden-compra', 'guia-despacho', 'factura'));

drop policy if exists "docs_storage_insert_auth" on storage.objects;
create policy "docs_storage_insert_auth"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('orden-compra', 'guia-despacho', 'factura'));

drop policy if exists "docs_storage_update_auth" on storage.objects;
create policy "docs_storage_update_auth"
on storage.objects
for update
to authenticated
using (bucket_id in ('orden-compra', 'guia-despacho', 'factura'))
with check (bucket_id in ('orden-compra', 'guia-despacho', 'factura'));

drop policy if exists "docs_storage_delete_auth" on storage.objects;
create policy "docs_storage_delete_auth"
on storage.objects
for delete
to authenticated
using (bucket_id in ('orden-compra', 'guia-despacho', 'factura'));
