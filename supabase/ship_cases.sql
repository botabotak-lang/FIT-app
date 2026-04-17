-- Supabase SQL Editor で実行（customers / employees / products と同一プロジェクト）

create table if not exists ship_cases (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists ship_cases_updated_at_idx on ship_cases (updated_at desc);

alter table ship_cases enable row level security;

drop policy if exists "allow_all_anon_ship_cases" on ship_cases;
create policy "allow_all_anon_ship_cases" on ship_cases
  for all to anon
  using (true) with check (true);
