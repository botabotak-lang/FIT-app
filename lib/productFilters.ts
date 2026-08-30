/**
 * 製品マスタ画面の検索・絞り込み・並び替え。
 * すべてクライアント側（取得済みの全件配列）に対して行う。DBには触れない。
 */
import type { Product } from "./productMaster";
import { matchesAllTerms, searchTerms } from "./searchText";

export const PRODUCT_STATUS_FILTERS = ["all", "unpriced", "inactive"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export const PRODUCT_SORT_KEYS = ["name", "supplier", "updated"] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatusFilter, string> = {
  all: "すべて",
  unpriced: "売値未設定",
  inactive: "無効のみ",
};

export const PRODUCT_SORT_LABELS: Record<ProductSortKey, string> = {
  name: "品名順",
  supplier: "仕入先→品名",
  updated: "更新日の新しい順",
};

/** スマホ幅のプルダウン本体に出す短縮表示（一覧の選択肢は上のフル表記） */
export const PRODUCT_STATUS_SHORT_LABELS: Record<ProductStatusFilter, string> = {
  all: "すべて",
  unpriced: "未設定",
  inactive: "無効",
};

export const PRODUCT_SORT_SHORT_LABELS: Record<ProductSortKey, string> = {
  name: "品名",
  supplier: "仕入先",
  updated: "更新日",
};

/** 1ページの表示件数（「さらに50件表示」の単位） */
export const PRODUCT_PAGE_SIZE = 50;

/** 「すべての仕入先」を表す値。URL には載せない */
export const SUPPLIER_ALL = "";

export type ProductFilterState = {
  query: string;
  supplier: string;
  status: ProductStatusFilter;
  sort: ProductSortKey;
};

export const DEFAULT_PRODUCT_FILTER: ProductFilterState = {
  query: "",
  supplier: SUPPLIER_ALL,
  status: "all",
  sort: "name",
};

/** URL などの外部入力を許容値に丸める */
export function toStatusFilter(value: string | null): ProductStatusFilter {
  return (PRODUCT_STATUS_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ProductStatusFilter)
    : "all";
}

export function toSortKey(value: string | null): ProductSortKey {
  return (PRODUCT_SORT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as ProductSortKey)
    : "name";
}

/** 何かしら絞り込んでいる状態か（バッジ・クリアボタンの表示判定） */
export function isFiltering(state: ProductFilterState): boolean {
  return (
    state.query.trim() !== "" ||
    state.supplier !== SUPPLIER_ALL ||
    state.status !== "all"
  );
}

/** 売値が未設定（0以下）の製品か */
export function isUnpriced(product: Product): boolean {
  return !(product.sellingPrice > 0);
}

/** 品名・型式・仕入先・備考を横断して部分一致（複数語は AND） */
export function matchesQuery(product: Product, terms: readonly string[]): boolean {
  return matchesAllTerms(
    [product.name, product.modelType, product.supplier, product.notes],
    terms
  );
}

export type SupplierCount = { supplier: string; count: number };

/**
 * 登録済み製品の仕入先を件数付きでまとめる（件数の多い順）。
 * 件数は検索語・状態フィルタを適用する前の全体件数。
 */
export function countBySupplier(products: readonly Product[]): SupplierCount[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const supplier = p.supplier?.trim();
    if (!supplier) continue;
    counts.set(supplier, (counts.get(supplier) ?? 0) + 1);
  }
  const collator = new Intl.Collator("ja");
  return [...counts.entries()]
    .map(([supplier, count]) => ({ supplier, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.supplier, b.supplier));
}

function comparator(sort: ProductSortKey): (a: Product, b: Product) => number {
  const collator = new Intl.Collator("ja");
  const byName = (a: Product, b: Product) =>
    collator.compare(a.name, b.name) ||
    collator.compare(a.modelType, b.modelType) ||
    collator.compare(a.id, b.id);

  if (sort === "supplier") {
    return (a, b) => collator.compare(a.supplier, b.supplier) || byName(a, b);
  }
  if (sort === "updated") {
    // 更新日は ISO 文字列なので文字列比較で新しい順に並ぶ
    return (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : byName(a, b));
  }
  return byName;
}

/** 検索・仕入先・状態で絞り込む（並び替えはしない） */
export function filterProducts(
  products: readonly Product[],
  state: ProductFilterState
): Product[] {
  const terms = searchTerms(state.query);
  return products.filter((p) => {
    if (state.supplier !== SUPPLIER_ALL && p.supplier !== state.supplier) return false;
    if (state.status === "inactive" && p.isActive) return false;
    if (state.status === "unpriced" && !isUnpriced(p)) return false;
    return matchesQuery(p, terms);
  });
}

/**
 * 絞り込み＋並び替えの結果を表示順の1本のリストで返す。
 * 状態「すべて」のときは従来どおり有効→無効の順（無効は見出しで区切って表示する）。
 */
export function arrangeProducts(
  products: readonly Product[],
  state: ProductFilterState
): Product[] {
  const filtered = filterProducts(products, state);
  const compare = comparator(state.sort);
  if (state.status !== "all") return filtered.sort(compare);

  const active = filtered.filter((p) => p.isActive).sort(compare);
  const inactive = filtered.filter((p) => !p.isActive).sort(compare);
  return [...active, ...inactive];
}
