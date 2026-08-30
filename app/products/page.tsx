"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Package,
  FileUp,
  Search,
  X,
  ArrowUpDown,
} from "lucide-react";
import {
  Product,
  ProductInput,
  getAllProducts,
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/lib/productMaster";
import {
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORT_KEYS,
  PRODUCT_SORT_LABELS,
  PRODUCT_SORT_SHORT_LABELS,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_SHORT_LABELS,
  SUPPLIER_ALL,
  arrangeProducts,
  countBySupplier,
  isFiltering,
  toSortKey,
  toStatusFilter,
  toSupplierFilter,
  type ProductFilterState,
} from "@/lib/productFilters";
import { PRODUCTS_MOCK_ENABLED, loadMockProducts } from "@/lib/productsMock";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import ImportDialog from "@/components/products/ImportDialog";
import AdminGate from "@/components/AdminGate";

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; product: Product };

/** 検索窓の入力が止まってから絞り込む待ち時間（ミリ秒） */
const SEARCH_DEBOUNCE_MS = 150;

/** Select は空文字を値にできないので、「すべて」用の番兵を使う */
const SUPPLIER_ALL_VALUE = "__all__";

export default function ProductsPage() {
  return (
    <AdminGate>
      {/* useSearchParams を使うため Suspense 境界をページ内に置く */}
      <Suspense
        fallback={
          <main className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-2xl mx-auto text-center py-16 text-gray-400">
              読み込み中…
            </div>
          </main>
        }
      >
        <ProductsPageInner />
      </Suspense>
    </AdminGate>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [showImport, setShowImport] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);

  // 検索条件は URL に持たせる（編集ダイアログを閉じても・リロードしても残る）
  const rawFilter: ProductFilterState = useMemo(
    () => ({
      query: searchParams.get("q") ?? "",
      supplier: (searchParams.get("supplier") ?? SUPPLIER_ALL).trim(),
      status: toStatusFilter(searchParams.get("status")),
      sort: toSortKey(searchParams.get("sort")),
    }),
    [searchParams]
  );

  const supplierCounts = useMemo(() => countBySupplier(products), [products]);
  const registeredSuppliers = useMemo(
    () => supplierCounts.map((s) => s.supplier),
    [supplierCounts]
  );
  // 仕入先の丸めは読み込み後だけ（読み込み中は候補が空で、正しい値まで落ちてしまう）
  const suppliersReady = !loading && !error;

  const filter: ProductFilterState = useMemo(
    () =>
      suppliersReady
        ? { ...rawFilter, supplier: toSupplierFilter(rawFilter.supplier, registeredSuppliers) }
        : rawFilter,
    [rawFilter, registeredSuppliers, suppliersReady]
  );

  const [queryInput, setQueryInput] = useState(filter.query);

  const updateParams = useCallback(
    (patch: Partial<Record<"q" | "supplier" | "status" | "sort", string>>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        // 既定値は URL に載せない（共有リンクを短く保つ）
        const isDefault = value === "" || (key === "status" && value === "all") || (key === "sort" && value === "name");
        if (isDefault) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = PRODUCTS_MOCK_ENABLED ? await loadMockProducts() : await getAllProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 戻る操作やクリアで URL 側が変わったら、入力欄を追従させる
  useEffect(() => {
    setQueryInput((prev) => (prev === filter.query ? prev : filter.query));
  }, [filter.query]);

  // 入力のたびに即時絞り込む（連打で URL を書きすぎないよう少しだけ待つ）
  useEffect(() => {
    if (queryInput === filter.query) return;
    const timer = setTimeout(() => updateParams({ q: queryInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput, filter.query, updateParams]);

  // 条件が変わったら先頭50件に戻す
  useEffect(() => {
    setVisibleCount(PRODUCT_PAGE_SIZE);
  }, [filter.query, filter.supplier, filter.status, filter.sort]);

  // 未登録の仕入先が URL に残っていたら「すべて」に丸め、URL からも消す
  useEffect(() => {
    if (!suppliersReady) return;
    if (rawFilter.supplier === filter.supplier) return;
    updateParams({ supplier: filter.supplier });
  }, [suppliersReady, rawFilter.supplier, filter.supplier, updateParams]);

  /**
   * 検証モック中は本番 Supabase に書き込ませない。
   * モックは画面だけを差し替える仕組みで、書き込み経路は本番のままのため。
   */
  const blockedByMock = () => {
    if (!PRODUCTS_MOCK_ENABLED) return false;
    alert("検証モック中は保存できません");
    return true;
  };

  const openAdd = () => {
    if (blockedByMock()) return;
    setDialog({ mode: "add" });
  };

  const openEdit = (target: Product) => {
    if (blockedByMock()) return;
    setDialog({ mode: "edit", product: target });
  };

  const openImport = () => {
    if (blockedByMock()) return;
    setShowImport(true);
  };

  const handleSubmit = async (input: ProductInput) => {
    if (blockedByMock()) return;
    if (dialog.mode === "edit") {
      await updateProduct(dialog.product.id, input);
    } else {
      await createProduct(input);
    }
    setDialog({ mode: "closed" });
    await fetchProducts();
  };

  const handleToggle = async (product: Product) => {
    if (blockedByMock()) return;
    const label = product.isActive ? "無効にします" : "有効にします";
    if (!confirm(`「${product.name}」を${label}か？`)) return;
    setTogglingId(product.id);
    try {
      await toggleProductActive(product.id, !product.isActive);
      await fetchProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setTogglingId(null);
    }
  };

  const visibleProducts = useMemo(
    () => arrangeProducts(products, filter),
    [products, filter]
  );
  const shown = visibleProducts.slice(0, visibleCount);
  // 「無効」の見出しを差し込む位置（状態「すべて」のときだけ区切る）
  const firstInactiveIndex =
    filter.status === "all" ? shown.findIndex((p) => !p.isActive) : -1;

  const filtering = isFiltering(filter);
  // 登録済みの仕入先（自由入力で増えた分も含む）を入力候補に回す
  const knownSuppliers = useMemo(() => products.map((p) => p.supplier).filter(Boolean), [products]);

  const clearFilters = () => {
    setQueryInput("");
    updateParams({ q: "", supplier: "", status: "all" });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label="一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0">製品マスタ</h1>
          <Button variant="outline" size="sm" onClick={openImport}>
            <FileUp className="w-4 h-4 mr-1" />
            一括取込
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-400">読み込み中…</div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm mb-4">
            {error}
            <button
              className="ml-2 underline"
              onClick={fetchProducts}
            >
              再読み込み
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {products.length > 0 && (
              <div className="space-y-2 mb-4">
                {/* 検索窓（常時表示） */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="品名・型式・仕入先・備考で検索"
                    aria-label="製品を検索"
                    data-testid="product-search"
                    className="pl-9 pr-9 bg-white"
                  />
                  {queryInput && (
                    <button
                      onClick={() => setQueryInput("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:bg-gray-100"
                      aria-label="検索語を消す"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 仕入先・状態・並び替え（スマホ幅でも検索窓と合わせて2行に収める） */}
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={filter.supplier === SUPPLIER_ALL ? SUPPLIER_ALL_VALUE : filter.supplier}
                    onValueChange={(value) =>
                      updateParams({ supplier: value === SUPPLIER_ALL_VALUE ? "" : value })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full min-w-0 bg-white"
                      aria-label="仕入先で絞り込む"
                      data-testid="supplier-filter"
                    >
                      <SelectValue placeholder="仕入先">
                        {filter.supplier === SUPPLIER_ALL ? "全仕入先" : filter.supplier}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SUPPLIER_ALL_VALUE}>すべての仕入先</SelectItem>
                      {supplierCounts.map(({ supplier, count }) => (
                        <SelectItem key={supplier} value={supplier}>
                          {supplier} ({count})
                        </SelectItem>
                      ))}
                      {filter.supplier !== SUPPLIER_ALL &&
                        !supplierCounts.some((s) => s.supplier === filter.supplier) && (
                          <SelectItem value={filter.supplier}>
                            {filter.supplier} (0)
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.status}
                    onValueChange={(value) => updateParams({ status: value })}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full min-w-0 bg-white"
                      aria-label="状態で絞り込む"
                      data-testid="status-filter"
                    >
                      <SelectValue placeholder="状態">
                        {PRODUCT_STATUS_SHORT_LABELS[filter.status]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUS_FILTERS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {PRODUCT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.sort}
                    onValueChange={(value) => updateParams({ sort: value })}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full min-w-0 bg-white"
                      aria-label="並び替え"
                      data-testid="sort-select"
                    >
                      <ArrowUpDown className="w-4 h-4 shrink-0 text-gray-400" />
                      <SelectValue placeholder="並び替え">
                        {PRODUCT_SORT_SHORT_LABELS[filter.sort]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_SORT_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {PRODUCT_SORT_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <p className="text-sm text-gray-500" data-testid="result-count">
                {visibleProducts.length}件 / 全{products.length}件
              </p>
              {filtering && (
                <>
                  <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                    絞り込み中
                  </span>
                  <button
                    onClick={clearFilters}
                    className="text-xs text-gray-500 underline hover:text-gray-800"
                    data-testid="clear-filters"
                  >
                    クリア
                  </button>
                </>
              )}
            </div>

            {products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-4">製品が登録されていません</p>
                <Button onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初の製品を追加
                </Button>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="mb-4">条件に合う製品がありません</p>
                <Button variant="outline" onClick={clearFilters}>
                  条件をクリア
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2" data-testid="product-list">
                  {shown.map((p, index) => (
                    <div key={p.id}>
                      {index === firstInactiveIndex && (
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
                          無効（材料入力に表示されません）
                        </p>
                      )}
                      <ProductRow
                        product={p}
                        togglingId={togglingId}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                      />
                    </div>
                  ))}
                </div>

                {visibleProducts.length > shown.length && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((c) => c + PRODUCT_PAGE_SIZE)}
                      data-testid="load-more"
                    >
                      さらに{PRODUCT_PAGE_SIZE}件表示（残り
                      {visibleProducts.length - shown.length}件）
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {dialog.mode !== "closed" && (
        <ProductFormDialog
          product={dialog.mode === "edit" ? dialog.product : undefined}
          knownSuppliers={knownSuppliers}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ mode: "closed" })}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onComplete={() => {
            setShowImport(false);
            fetchProducts();
          }}
        />
      )}
    </main>
  );
}

type ProductRowProps = {
  product: Product;
  togglingId: string | null;
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
};

function ProductRow({ product: p, togglingId, onEdit, onToggle }: ProductRowProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 ${
        p.isActive ? "" : "opacity-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {p.modelType && <span>{p.modelType}　</span>}
          {p.supplier}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          仕入 ¥{p.purchasePrice.toLocaleString()} → 売値 ¥{p.sellingPrice.toLocaleString()}
          {p.unit && <span className="text-gray-400">　/ {p.unit}</span>}
        </p>
        {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(p)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="編集"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onToggle(p)}
          disabled={togglingId === p.id}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"
          aria-label={p.isActive ? "無効にする" : "有効にする"}
        >
          {p.isActive ? (
            <ToggleRight className="w-5 h-5 text-green-500" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
}
