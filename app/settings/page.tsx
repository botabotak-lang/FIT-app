"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings } from "lucide-react";
import AdminGate from "@/components/AdminGate";
import {
  DEFAULT_LABOR_RATES,
  getLaborRates,
  saveLaborRates,
  travelHourlyRate,
  type LaborRates,
} from "@/lib/laborRates";

export default function SettingsPage() {
  return (
    <AdminGate>
      <SettingsPageInner />
    </AdminGate>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const [form, setForm] = useState<LaborRates>(DEFAULT_LABOR_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForm(await getLaborRates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const set = (field: keyof LaborRates, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: value === "" ? 0 : Number(value) }));
  };

  const invalid =
    !(form.regular > 0) || !(form.holiday > 0) || !(form.travelFactor > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) {
      setError("平日単価・休日単価・移動係数はいずれも0より大きい値を入れてください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setForm(await saveLaborRates(form));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">設定</h1>
          <Settings className="w-5 h-5 text-gray-400" />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">読み込み中…</div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl shadow-sm p-6 space-y-5"
          >
            <div>
              <h2 className="font-semibold text-gray-900">工賃単価</h2>
              <p className="text-xs text-gray-500 mt-1">
                作業報告書・材料持出表・見積書／請求書の計算に使われます。
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">平日単価（円/h）</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={form.regular || ""}
                onChange={(e) => set("regular", e.target.value)}
                onFocus={(e) => e.target.select()}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">休日単価（円/h）</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={form.holiday || ""}
                onChange={(e) => set("holiday", e.target.value)}
                onFocus={(e) => e.target.select()}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">移動係数（平日単価×係数）</Label>
              <Input
                type="number"
                min={0}
                step={0.05}
                value={form.travelFactor || ""}
                onChange={(e) => set("travelFactor", e.target.value)}
                onFocus={(e) => e.target.select()}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                移動費 = ¥{travelHourlyRate(form).toLocaleString()} / h
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}
            {saved && !error && (
              <p className="text-sm text-green-700 bg-green-50 rounded p-2">
                保存しました
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => void fetchRates()}
                disabled={saving}
              >
                元に戻す
              </Button>
              <Button type="submit" className="flex-1" disabled={saving || invalid}>
                {saving ? "保存中…" : "保存する"}
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              保存先は Supabase の app_settings テーブルです。テーブルが未作成の場合は
              既定値（平日 {DEFAULT_LABOR_RATES.regular} 円 / 休日{" "}
              {DEFAULT_LABOR_RATES.holiday} 円 / 係数 {DEFAULT_LABOR_RATES.travelFactor}）
              で動作し、保存はエラーになります。
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
