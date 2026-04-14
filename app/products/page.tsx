"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, ToggleLeft, ToggleRight, Package, FileUp } from "lucide-react";
import {
  Product,
  ProductInput,
  getAllProducts,
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/lib/productMaster";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import ImportDialog from "@/components/products/ImportDialog";

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; product: Product };

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [showImport, setShowImport] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllProducts();
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

  const handleSubmit = async (input: ProductInput) => {
    if (dialog.mode === "edit") {
      await updateProduct(dialog.product.id, input);
    } else {
      await createProduct(input);
    }
    setDialog({ mode: "closed" });
    await fetchProducts();
  };

  const handleToggle = async (product: Product) => {
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

  const activeProducts = products.filter((p) => p.isActive);
  const inactiveProducts = products.filter((p) => !p.isActive);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">製品マスタ</h1>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <FileUp className="w-4 h-4 mr-1" />
            一括取込
          </Button>
          <Button onClick={() => setDialog({ mode: "add" })}>
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
            <p className="text-sm text-gray-500 mb-4">
              有効 {activeProducts.length}件 / 全{products.length}件
            </p>

            {products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-4">製品が登録されていません</p>
                <Button onClick={() => setDialog({ mode: "add" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初の製品を追加
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 有効な製品 */}
                <ProductList
                  products={activeProducts}
                  togglingId={togglingId}
                  onEdit={(p) => setDialog({ mode: "edit", product: p })}
                  onToggle={handleToggle}
                />

                {/* 無効な製品 */}
                {inactiveProducts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      無効（材料入力に表示されません）
                    </p>
                    <ProductList
                      products={inactiveProducts}
                      togglingId={togglingId}
                      onEdit={(p) => setDialog({ mode: "edit", product: p })}
                      onToggle={handleToggle}
                      muted
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {dialog.mode !== "closed" && (
        <ProductFormDialog
          product={dialog.mode === "edit" ? dialog.product : undefined}
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

type ProductListProps = {
  products: Product[];
  togglingId: string | null;
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
  muted?: boolean;
};

function ProductList({ products, togglingId, onEdit, onToggle, muted }: ProductListProps) {
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div
          key={p.id}
          className={`bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 ${
            muted ? "opacity-50" : ""
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
            </p>
            {p.notes && (
              <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>
            )}
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
      ))}
    </div>
  );
}
