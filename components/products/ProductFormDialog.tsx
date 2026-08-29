"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Product, ProductInput } from "@/lib/productMaster";
import { SUPPLIERS, UNIT_OPTIONS } from "@/lib/types";

type Props = {
  product?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_FORM: ProductInput = {
  name: "",
  modelType: "",
  supplier: "モノタロウ",
  unit: "",
  purchasePrice: 0,
  sellingPrice: 0,
  notes: "",
};

export default function ProductFormDialog({ product, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        modelType: product.modelType,
        supplier: product.supplier,
        unit: product.unit ?? "",
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        notes: product.notes,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [product]);

  const set = (field: keyof ProductInput, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("品名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <h2 className="text-lg font-bold">
          {product ? "製品を編集" : "製品を追加"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              品名<span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="例：船舶用VHF無線機"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">型式</Label>
            <Input
              value={form.modelType}
              onChange={(e) => set("modelType", e.target.value)}
              placeholder="例：JHS-800"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">仕入先</Label>
            <select
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              {SUPPLIERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-sm font-medium">単位</Label>
            <Input
              list="product-unit-options"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="例：本 / 個 / 式"
              className="mt-1"
            />
            <datalist id="product-unit-options">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">
                仕入単価（円）<span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={form.purchasePrice || ""}
                onChange={(e) =>
                  set("purchasePrice", e.target.value === "" ? 0 : Number(e.target.value))
                }
                onFocus={(e) => e.target.select()}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                売値単価（円）<span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={form.sellingPrice || ""}
                onChange={(e) =>
                  set("sellingPrice", e.target.value === "" ? 0 : Number(e.target.value))
                }
                onFocus={(e) => e.target.select()}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">備考</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="補足メモ（任意）"
              rows={2}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {form.purchasePrice > 0 && form.sellingPrice > 0 && (
            <p className="text-xs text-gray-500 text-right">
              粗利率：
              {(
                ((form.sellingPrice - form.purchasePrice) / form.sellingPrice) *
                100
              ).toFixed(1)}
              ％
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "保存中…" : product ? "更新する" : "登録する"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
