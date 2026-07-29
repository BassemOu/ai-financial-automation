-- Financial Automation workflow schema.
-- Apply with `supabase db push` once a Supabase project is linked.

create type public.invoice_type as enum ('petty_cash', 'credit_card');
create type public.invoice_status as enum ('received', 'extracting', 'needs_review', 'approved', 'posted', 'archived', 'rejected', 'failed', 'escalated');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'reviewer' check (role in ('finance_admin', 'reviewer')),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_type public.invoice_type not null,
  status public.invoice_status not null default 'received',
  source_file_name text not null,
  source_document_url text,
  archive_url text,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  category text,
  currency text not null default 'KWD',
  total_amount numeric(14, 3),
  vat_amount numeric(14, 3),
  received_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_type, invoice_number, vendor_name)
);

create table public.invoice_extractions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  model_id text,
  raw_response jsonb not null default '{}'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  has_low_confidence boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table public.invoice_reviews (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  corrected_fields jsonb not null default '{}'::jsonb,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.invoice_audit_events (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_extractions enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_reviews enable row level security;
alter table public.invoice_audit_events enable row level security;

-- Initial internal-finance policies. Tighten further when KU roles and teams are defined.
create policy "Authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Authenticated users can read invoices" on public.invoices for select to authenticated using (true);
create policy "Finance users can create invoices" on public.invoices for insert to authenticated with check (true);
create policy "Finance users can update invoices" on public.invoices for update to authenticated using (true);
create policy "Authenticated users can read extractions" on public.invoice_extractions for select to authenticated using (true);
create policy "Authenticated users can read line items" on public.invoice_line_items for select to authenticated using (true);
create policy "Authenticated users can read reviews" on public.invoice_reviews for select to authenticated using (true);
create policy "Authenticated users can create reviews" on public.invoice_reviews for insert to authenticated with check (reviewer_id = auth.uid());
create policy "Authenticated users can read audit events" on public.invoice_audit_events for select to authenticated using (true);

create index invoices_status_idx on public.invoices(status);
create index invoices_type_idx on public.invoices(invoice_type);
create index invoice_audit_events_invoice_id_idx on public.invoice_audit_events(invoice_id);
