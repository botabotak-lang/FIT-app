"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Customer, CustomerInput } from "@/lib/customerMaster";
import { DEFAULT_LABOR_RATES, getLaborRates, type LaborRates } from "@/lib/laborRates";

type Props = {
  customer?: Customer;
  onSubmit: (input: CustomerInput) => Promise<void>;
  onCancel: () => void;
};

const EMPTY: CustomerInput = {
  name: "",
  address: "",
  phone: "",
  notes: "",
  sortOrder: 0,
  laborRates: null,
};

/** 単価3入力は文字列で持つ（空欄＝共通設定を使う、を表現するため） */
type RateForm = { regular: string; holiday: string; travelFactor: string };

const EMPTY_RATES: RateForm = { regular: "", holiday: "", travelFactor: "" };

function toRateForm(rates: LaborRates | null): RateForm {
  if (!rates) return EMPTY_RATES;
  return {
    regular: String(rates.regular),
    holiday: String(rates.holiday),
    travelFactor: String(rates.travelFactor),
  };
}

export default function CustomerFormDialog({ customer, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [rateForm, setRateForm] = useState<RateForm>(EMPTY_RATES);
  const [globalRates, setGlobalRates] = useState<LaborRates>(DEFAULT_LABOR_RATES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 共通設定は placeholder（空欄時に実際に使われる値）として見せる
    getLaborRates()
      .then(setGlobalRates)
      .catch(() => setGlobalRates(DEFAULT_LABOR_RATES));
  }, []);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        address: customer.address,
        phone: customer.phone,
        notes: customer.notes,
        sortOrder: customer.sortOrder,
        laborRates: customer.laborRates,
      });
      setRateForm(toRateForm(customer.laborRates));
    } else {
      setForm(EMPTY);
      setRateForm(EMPTY_RATES);
    }
  }, [customer]);

  const set = (
    field: Exclude<keyof CustomerInput, "laborRates">,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setRate = (field: keyof RateForm, value: string) => {
    setRateForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * 3つとも空欄なら null（＝共通設定を使う）。
   * 1つでも入っていれば個別単価として保存し、空欄の項目には共通設定の値を入れる
   * （placeholder に出ている値がそのまま保存される）。
   */
  const buildLaborRates = (): LaborRates | null | "invalid" => {
    const entries = Object.entries(rateForm) as [keyof RateForm, string][];
    if (entries.every(([, v]) => v.trim() === "")) return null;
    const next = { ...globalRates } as LaborRates;
    for (const [field, raw] of entries) {
      if (raw.trim() === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return "invalid";
      next[field] = n;
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("顧客名は必須です");
      return;
    }
    const laborRates = buildLaborRates();
    if (laborRates === "invalid") {
      setError("単価・係数は0より大きい数値で入力してください（空欄は共通設定）");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ ...form, laborRates });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">{customer ? "顧客を編集" : "顧客を追加"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              顧客名<span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="mt-1"
              placeholder="例：東海汽船"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">住所</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="mt-1"
              placeholder="任意"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">電話</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="mt-1"
              placeholder="任意"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">備考</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm min-h-[4rem]"
              placeholder="任意"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">表示順（小さいほど上）</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              className="mt-1 w-32"
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-sm font-medium">この請求先の単価</Label>
              <p className="text-xs text-gray-500 mt-1">
                空欄なら共通設定（設定画面の工賃単価）を使用します。
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-gray-600">平日（円/h）</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rateForm.regular}
                  onChange={(e) => setRate("regular", e.target.value)}
                  placeholder={String(globalRates.regular)}
                  className="mt-1"
                  aria-label="この請求先の平日単価（円/h）"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">休日（円/h）</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rateForm.holiday}
                  onChange={(e) => setRate("holiday", e.target.value)}
                  placeholder={String(globalRates.holiday)}
                  className="mt-1"
                  aria-label="この請求先の休日単価（円/h）"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">移動係数</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rateForm.travelFactor}
                  onChange={(e) => setRate("travelFactor", e.target.value)}
                  placeholder={String(globalRates.travelFactor)}
                  className="mt-1"
                  aria-label="この請求先の移動係数"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              移動費は「平日単価 × 移動係数」で計算します。1つでも入力すると、残りの空欄には上の共通設定の値が入ります。
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
              キャンセル
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "保存中…" : customer ? "更新する" : "登録する"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
