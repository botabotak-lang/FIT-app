import { supabase } from "./supabase";

export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  notes: string;
  sortOrder: number;
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
};

type DbCustomer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  notes: string;
  sort_order: number;
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
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      address: input.address,
      phone: input.phone,
      notes: input.notes,
      sort_order: input.sortOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`顧客登録エラー: ${error.message}`);
  return fromDb(data as DbCustomer);
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: input.name,
      address: input.address,
      phone: input.phone,
      notes: input.notes,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`顧客更新エラー: ${error.message}`);
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
