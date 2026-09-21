import { supabase } from "./supabase";
import {
  clearCustomerLaborRatesCache,
  normalizeLaborRates,
  type LaborRates,
} from "./laborRates";

export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  notes: string;
  sortOrder: number;
  /** この請求先だけの工賃単価。null（＝未設定）なら全体設定を使う */
  laborRates: LaborRates | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  name: string;
  address: string;
  phone: string;
  notes: string;
  sortOrder: number;
  /** null なら全体設定を使う（列未適用のDBでは黙って無視される） */
  laborRates: LaborRates | null;
};

type DbCustomer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  notes: string;
  sort_order: number;
  labor_rates?: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function fromDb(row: DbCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
    sortOrder: row.sort_order ?? 0,
    // 列未適用のDBでは undefined が返るので、未設定と同じ扱いにする
    laborRates: row.labor_rates == null ? null : normalizeLaborRates(row.labor_rates),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type SupabaseErrorLike = { code?: string; message?: string } | null;

/**
 * labor_rates 列がまだ本番DBに無い場合（Phase E の SQL 未適用）に true。
 * PostgreSQL の undefined_column = 42703／PostgREST のスキーマキャッシュ由来は文面で判定。
 */
function isMissingLaborRatesColumn(error: SupabaseErrorLike): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = error.message ?? "";
  return /(column|find).*['"`.]?labor_rates['"`]?.*(does not exist|not find|schema cache)/i.test(
    message
  );
}

type CustomerPayload = Record<string, unknown> & { labor_rates?: unknown };

function withoutLaborRates(payload: CustomerPayload): CustomerPayload {
  const rest = { ...payload };
  delete rest.labor_rates;
  return rest;
}

function basePayload(input: CustomerInput): CustomerPayload {
  return {
    name: input.name,
    address: input.address,
    phone: input.phone,
    notes: input.notes,
    sort_order: input.sortOrder,
    labor_rates: input.laborRates === null ? null : normalizeLaborRates(input.laborRates),
  };
}

export async function getActiveCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) throw new Error(`顧客マスタ取得エラー: ${error.message}`);
  return (data as DbCustomer[]).map(fromDb);
}

export async function getAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");

  if (error) throw new Error(`顧客マスタ取得エラー: ${error.message}`);
  return (data as DbCustomer[]).map(fromDb);
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const payload = basePayload(input);
  let { data, error } = await supabase.from("customers").insert(payload).select().single();

  // labor_rates 列が未適用のDBでは単価を外して1回だけ再試行する
  if (isMissingLaborRatesColumn(error)) {
    ({ data, error } = await supabase
      .from("customers")
      .insert(withoutLaborRates(payload))
      .select()
      .single());
  }

  if (error) throw new Error(`顧客登録エラー: ${error.message}`);
  clearCustomerLaborRatesCache();
  return fromDb(data as DbCustomer);
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer> {
  const payload = { ...basePayload(input), updated_at: new Date().toISOString() };
  let { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (isMissingLaborRatesColumn(error)) {
    ({ data, error } = await supabase
      .from("customers")
      .update(withoutLaborRates(payload))
      .eq("id", id)
      .select()
      .single());
  }

  if (error) throw new Error(`顧客更新エラー: ${error.message}`);
  clearCustomerLaborRatesCache();
  return fromDb(data as DbCustomer);
}

export async function toggleCustomerActive(
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`顧客更新エラー: ${error.message}`);
}

/** マスタの「その他」行の名前（基本情報で手入力に切り替えるトリガー） */
export const CUSTOMER_OTHER_NAME = "その他";
