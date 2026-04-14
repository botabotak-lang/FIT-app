import { supabase } from "./supabase";

export type Product = {
  id: string;
  name: string;
  modelType: string;
  supplier: string;
  purchasePrice: number;
  sellingPrice: number;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  modelType: string;
  supplier: string;
  purchasePrice: number;
  sellingPrice: number;
  notes: string;
};

type DbProduct = {
  id: string;
  name: string;
  model_type: string;
  supplier: string;
  purchase_price: number;
  selling_price: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function fromDb(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    modelType: row.model_type,
    supplier: row.supplier,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    notes: row.notes ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 有効な製品のみ取得（材料入力ステップで使用） */
export async function getActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`製品マスタ取得エラー: ${error.message}`);
  return (data as DbProduct[]).map(fromDb);
}

/** 全製品取得（マスタ管理画面で使用） */
export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) throw new Error(`製品マスタ取得エラー: ${error.message}`);
  return (data as DbProduct[]).map(fromDb);
}

/** 製品を新規登録 */
export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      model_type: input.modelType,
      supplier: input.supplier,
      purchase_price: input.purchasePrice,
      selling_price: input.sellingPrice,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw new Error(`製品登録エラー: ${error.message}`);
  return fromDb(data as DbProduct);
}

/** 製品情報を更新 */
export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      model_type: input.modelType,
      supplier: input.supplier,
      purchase_price: input.purchasePrice,
      selling_price: input.sellingPrice,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`製品更新エラー: ${error.message}`);
  return fromDb(data as DbProduct);
}

/** 製品の有効・無効を切り替え */
export async function toggleProductActive(
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`製品更新エラー: ${error.message}`);
}

export type UpsertResult = {
  inserted: number;
  updated: number;
};

/**
 * スプレッドシートから取り込んだデータを一括保存。
 * 品名が一致するものは更新、なければ新規追加。
 */
export async function upsertProducts(
  inputs: ProductInput[]
): Promise<UpsertResult> {
  const existing = await getAllProducts();
  const existingByName = new Map(existing.map((p) => [p.name, p]));

  const toInsert: typeof inputs = [];
  const toUpdate: { id: string; input: ProductInput }[] = [];

  for (const input of inputs) {
    const match = existingByName.get(input.name);
    if (match) {
      toUpdate.push({ id: match.id, input });
    } else {
      toInsert.push(input);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products").insert(
      toInsert.map((i) => ({
        name: i.name,
        model_type: i.modelType,
        supplier: i.supplier,
        purchase_price: i.purchasePrice,
        selling_price: i.sellingPrice,
        notes: i.notes,
      }))
    );
    if (error) throw new Error(`一括登録エラー: ${error.message}`);
  }

  for (const { id, input } of toUpdate) {
    const { error } = await supabase
      .from("products")
      .update({
        model_type: input.modelType,
        supplier: input.supplier,
        purchase_price: input.purchasePrice,
        selling_price: input.sellingPrice,
        notes: input.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`一括更新エラー: ${error.message}`);
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}
