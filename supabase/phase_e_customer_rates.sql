-- Phase E: 請求先（顧客）ごとの工賃単価
-- Supabase SQL Editor で実行（customers と同一プロジェクト）
-- 実行前のデータ削除は不要。既存データはそのまま残る。
--
-- labor_rates が null の顧客は、これまでどおり全体設定（app_settings.labor_rates）を使う。
-- 値の形は全体設定と同じ： {"regular":7000,"holiday":8400,"travelFactor":0.8}
--   regular      = 平日 円/h
--   holiday      = 休日 円/h
--   travelFactor = 移動の係数（平日単価 × 係数）

alter table customers add column if not exists labor_rates jsonb;

comment on column customers.labor_rates is
  '請求先ごとの工賃単価。null なら app_settings.labor_rates（全体設定）を使う';
