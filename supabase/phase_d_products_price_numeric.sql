-- Phase D: 製品マスタの単価を小数対応にする
--
-- 背景：FIT から届いた製品マスタには 25.7円・0.67円 のように 1円未満の
-- 仕入値が 127 行ある。purchase_price / selling_price が integer のままだと
-- 一括取込が失敗する（または勝手に丸められる）ため、numeric に変更する。
--
-- 適用：Supabase の SQL Editor でこのファイルの内容を実行する（窪田が実行）。
-- 既存データはそのまま numeric にキャストされるので、値は変わらない。
-- 既に numeric(12,2) の場合は何も変わらない（再実行しても安全）。

alter table products
  alter column purchase_price type numeric(12,2) using purchase_price::numeric,
  alter column selling_price type numeric(12,2) using selling_price::numeric;
