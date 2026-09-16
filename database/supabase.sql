create table if not exists public.pgnest_records (
  collection text not null,
  record_id text not null,
  organization_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, record_id)
);

create index if not exists pgnest_records_org_idx
  on public.pgnest_records (organization_id, collection);

alter table public.pgnest_records enable row level security;

drop policy if exists "service role manages pgnest records" on public.pgnest_records;
create policy "service role manages pgnest records"
  on public.pgnest_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
