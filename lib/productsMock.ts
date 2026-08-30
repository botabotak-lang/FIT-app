/**
 * 製品マスタ画面の検証用モック。
 *
 * `NEXT_PUBLIC_PRODUCTS_MOCK=1` のときだけ `public/mock/products.json` を読み、
 * DB の代わりに使う。既定は OFF で、本番ではこの経路に入らない。
 * モックの生成は `node scripts/make_products_mock.mjs "<製品マスタ.xlsx>"`。
 */
import type { Product } from "./productMaster";

/** 検証用モックが有効か（ビルド時に埋め込まれる） */
export const PRODUCTS_MOCK_ENABLED = process.env.NEXT_PUBLIC_PRODUCTS_MOCK === "1";

const MOCK_URL = "/mock/products.json";

function toProduct(raw: Record<string, unknown>, index: number): Product {
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const str = (v: unknown) => String(v ?? "");
  return {
    id: str(raw.id) || `mock-${index}`,
    name: str(raw.name),
    modelType: str(raw.modelType),
    supplier: str(raw.supplier),
    unit: str(raw.unit),
    purchasePrice: num(raw.purchasePrice),
    sellingPrice: num(raw.sellingPrice),
    notes: str(raw.notes),
    isActive: raw.isActive !== false,
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

/** モック製品を読み込む（getAllProducts と同じ並び：有効→品名→id） */
export async function loadMockProducts(): Promise<Product[]> {
  const res = await fetch(MOCK_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `検証用モックが読めません（${MOCK_URL}）。scripts/make_products_mock.mjs で生成してください`
    );
  }
  const raw = (await res.json()) as Record<string, unknown>[];
  const collator = new Intl.Collator("ja");
  return raw.map(toProduct).sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      collator.compare(a.name, b.name) ||
      collator.compare(a.id, b.id)
  );
}
