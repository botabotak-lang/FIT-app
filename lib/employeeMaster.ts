import { supabase } from "./supabase";

export type Employee = {
  id: string;
  name: string;
  sortOrder: number;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeInput = {
  name: string;
  sortOrder: number;
  notes: string;
};

type DbEmployee = {
  id: string;
  name: string;
  sort_order: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function fromDb(row: DbEmployee): Employee {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    notes: row.notes ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActiveEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) throw new Error(`社員マスタ取得エラー: ${error.message}`);
  return (data as DbEmployee[]).map(fromDb);
}

export async function getAllEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");

  if (error) throw new Error(`社員マスタ取得エラー: ${error.message}`);
  return (data as DbEmployee[]).map(fromDb);
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      name: input.name,
      sort_order: input.sortOrder,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw new Error(`社員登録エラー: ${error.message}`);
  return fromDb(data as DbEmployee);
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .update({
      name: input.name,
      sort_order: input.sortOrder,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`社員更新エラー: ${error.message}`);
  return fromDb(data as DbEmployee);
}

export async function toggleEmployeeActive(
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`社員更新エラー: ${error.message}`);
}
