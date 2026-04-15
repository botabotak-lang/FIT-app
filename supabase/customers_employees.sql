-- Supabase SQL Editor で実行（products と同一プロジェクト）

create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  address text not null default '',
  phone text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customers enable row level security;
drop policy if exists "allow_all_anon_customers" on customers;
create policy "allow_all_anon_customers" on customers
  for all to anon
  using (true) with check (true);

create table if not exists employees (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  sort_order integer not null default 0,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employees enable row level security;
drop policy if exists "allow_all_anon_employees" on employees;
create policy "allow_all_anon_employees" on employees
  for all to anon
  using (true) with check (true);

insert into customers (name, sort_order) values
  ('東海汽船', 0),
  ('清水港運', 1),
  ('焼津漁協', 2),
  ('鈴与海運', 3),
  ('その他', 4)
on conflict (name) do nothing;

insert into employees (name, sort_order) values
  ('大竹', 0),
  ('豊島', 1),
  ('鈴木', 2)
on conflict (name) do nothing;
