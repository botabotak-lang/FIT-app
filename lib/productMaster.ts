import { supabase } from "./supabase";
import { dedupeRows, productKey } from "./importProducts";

/** Supabase の 1 リクエストあたりの既定上限。これを超える件数はページングで取る */
const PAGE_SIZE = 1000;

/** 一括 insert の分割サイズ（1リクエストが大きくなりすぎないように） */
const INSERT_CHUNK_SIZE = 200;

/**
 * ページング取得の上限ページ数（安全弁）。想定外の件数でブラウザが
 * 固まらないよう、ここを超えたらエラーで止める。
 */
const MAX_PAGES = 20;

export type Product = {
  id: string;
  name: string;
  modelType: string;
  supplier: string;
  /** 単位（本・個・袋 等。DB未適用時は ""） */
  unit: string;
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
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  notes: string;
};

type DbProduct = {
  id: string;
  name: string;
  model_type: string;
  supplier: string;
  unit?: string | null;
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
    unit: row.unit ?? "",
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    notes: row.notes ?? "",
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type SupabaseErrorLike = { code?: string; message?: string } | null;

/**
 * unit 列がまだ本番DBに無い場合（Phase C の SQL 未適用）に true。
 * PostgreSQL の undefined_column = 42703。
 */
function isMissingUnitColumn(error: SupabaseErrorLike): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  // PostgREST のスキーマキャッシュ由来（PGRST204 など）。
  // "unit" を含むだけの無関係なエラーで単位を捨てないよう、文面を絞る
  const message = error.message ?? "";
  return /(column|find).*['"`.]?unit['"`]?.*(does not exist|not find|schema cache)/i.test(message);
}

type ProductPayload = Record<string, unknown> & { unit?: string };

function withoutUnit(payload: ProductPayload): ProductPayload {
  const rest = { ...payload };
  delete rest.unit;
  return rest;
}

function withoutName(payload: ProductPayload): ProductPayload {
  const rest = { ...payload };
  delete rest.name;
  return rest;
}

/**
 * products を全件取得する。Supabase は 1 リクエスト 1000 行が既定上限なので、
 * `.range()` で最後のページまで読み切る（製品マスタは 1000 件を超える）。
 * ページ間で並びがぶれないよう、name の同値は id で決定的に並べる。
 */
async function fetchProductPages(activeOnly: boolean): Promise<DbProduct[]> {
  const all: DbProduct[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = activeOnly
      ? await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("name")
          .order("id")
          .range(from, to)
      : await supabase
          .from("products")
          .select("*")
          .order("is_active", { ascending: false })
          .order("name")
          .order("id")
          .range(from, to);

    if (error) throw new Error(`製品マスタ取得エラー: ${error.message}`);

    const rows = (data ?? []) as DbProduct[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
  throw new Error(
    `製品マスタの件数が想定外です（${MAX_PAGES * PAGE_SIZE}件以上）。データを確認してください。`
  );
}

/** 有効な製品のみ取得（材料入力ステップで使用） */
export async function getActiveProducts(): Promise<Product[]> {
  return (await fetchProductPages(true)).map(fromDb);
}

/** 全製品取得（マスタ管理画面で使用） */
export async function getAllProducts(): Promise<Product[]> {
  return (await fetchProductPages(false)).map(fromDb);
}

function insertPayload(input: ProductInput): ProductPayload {
  return {
    name: input.name,
    model_type: input.modelType,
    supplier: input.supplier,
    unit: input.unit,
    purchase_price: input.purchasePrice,
    selling_price: input.sellingPrice,
    notes: input.notes,
  };
}

function updatePayload(input: ProductInput): ProductPayload {
  return {
    ...insertPayload(input),
    updated_at: new Date().toISOString(),
  };
}

/** 製品を新規登録 */
export async function createProduct(input: ProductInput): Promise<Product> {
  const payload = insertPayload(input);
  let { data, error } = await supabase.from("products").insert(payload).select().single();

  // unit 列が未適用のDBでは unit を外して1回だけ再試行する
  if (isMissingUnitColumn(error)) {
    ({ data, error } = await supabase
      .from("products")
      .insert(withoutUnit(payload))
      .select()
      .single());
  }

  if (error) throw new Error(`製品登録エラー: ${error.message}`);
  return fromDb(data as DbProduct);
}

/** 製品情報を更新 */
export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<Product> {
  const payload = updatePayload(input);
  let { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (isMissingUnitColumn(error)) {
    ({ data, error } = await supabase
      .from("products")
      .update(withoutUnit(payload))
      .eq("id", id)
      .select()
      .single());
  }

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
  /** 同一バッチ内で「品名＋型式」が重複していて1件にまとめた件数 */
  merged: number;
};

/**
 * スプレッドシートから取り込んだデータを一括保存。
 * 「品名＋型式」が一致するものは更新、なければ新規追加。
 * 同一バッチ内で同じキーが複数あるときは後勝ちで 1 件にまとめる。
 */
export async function upsertProducts(
  inputs: ProductInput[]
): Promise<UpsertResult> {
  const { rows: uniqueInputs, merged } = dedupeRows(inputs);

  const existing = await getAllProducts();
  const existingByKey = new Map(
    existing.map((p) => [productKey(p.name, p.modelType), p])
  );

  const toInsert: ProductInput[] = [];
  const toUpdate: { id: string; input: ProductInput }[] = [];

  for (const input of uniqueInputs) {
    const match = existingByKey.get(productKey(input.name, input.modelType));
    if (match) {
      toUpdate.push({ id: match.id, input });
    } else {
      toInsert.push(input);
    }
  }

  // 1 リクエストが大きくなりすぎないよう 200 件ずつに分割して登録する
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const rows = toInsert.slice(i, i + INSERT_CHUNK_SIZE).map(insertPayload);
    let { error } = await supabase.from("products").insert(rows);
    if (isMissingUnitColumn(error)) {
      ({ error } = await supabase.from("products").insert(rows.map(withoutUnit)));
    }
    if (error) throw new Error(`一括登録エラー: ${error.message}`);
  }

  for (const { id, input } of toUpdate) {
    // 一括更新では品名は変えない（品名＋型式で突き合わせているため）
    const payload = withoutName(updatePayload(input));
    let { error } = await supabase.from("products").update(payload).eq("id", id);
    if (isMissingUnitColumn(error)) {
      ({ error } = await supabase.from("products").update(withoutUnit(payload)).eq("id", id));
    }
    if (error) throw new Error(`一括更新エラー: ${error.message}`);
  }

  return { inserted: toInsert.length, updated: toUpdate.length, merged };
}
