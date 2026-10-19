-- Storage bucket for uploaded invoice source documents, used by the extract-invoice function.
insert into storage.buckets (id, name, public)
values ('invoice-documents', 'invoice-documents', false)
on conflict (id) do nothing;

-- Per-field confidence for line items, populated by live Azure extraction.
alter table public.invoice_line_items
  add column if not exists description_confidence integer not null default 90,
  add column if not exists quantity_confidence integer not null default 90,
  add column if not exists unit_price_confidence integer not null default 90;

create policy "Authenticated users can upload invoice documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'invoice-documents');

create policy "Authenticated users can read invoice documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'invoice-documents');
