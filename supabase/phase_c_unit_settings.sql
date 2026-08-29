-- Phase C: 単位（products.unit）＋ アプリ設定（app_settings）
-- Supabase SQL Editor で実行（products と同一プロジェクト）
-- 実行前のデータ削除は不要。既存データはそのまま残る。

-- 1) 製品マスタに単位を追加（既存行は空文字）
alter table products add column if not exists unit text not null default '';

-- 2) アプリ設定テーブル（工賃単価などをキー単位で保持）
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
drop policy if exists "allow_all_anon_app_settings" on app_settings;
create policy "allow_all_anon_app_settings" on app_settings
  for all to anon
  using (true) with check (true);

-- 3) 工賃単価の初期値（既に行があれば何もしない）
--    regular=平日 円/h、holiday=休日 円/h、travelFactor=移動の係数（平日単価×係数）
insert into app_settings (key, value) values
  ('labor_rates', '{"regular":7000,"holiday":8400,"travelFactor":0.8}')
on conflict (key) do nothing;
