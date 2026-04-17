"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle } from "lucide-react";
import { ProductInput, upsertProducts, UpsertResult } from "@/lib/productMaster";
import { SUPPLIERS } from "@/lib/types";

type ParsedRow = ProductInput & { _error?: string };
type Step = "upload" | "preview" | "done";

type Props = {
  onClose: () => void;
  onComplete: () => void;
};

const TEMPLATE_COLUMNS = ["品名", "型式（規格）", "仕入先", "仕入値", "売値", "備考"];

function downloadTemplate() {
  const sampleRows = [
    ["船舶用VHF無線機", "JHS-800", "JRC", 45000, 68000, ""],
    ["GPSアンテナ", "GPS-20A", "JRC", 12000, 18000, ""],
    ["航海灯（LED）", "NL-50", "モノタロウ", 4500, 7200, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...sampleRows]);
  ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "製品マスタ");
  XLSX.writeFile(wb, "製品マスタ_テンプレート.xlsx");
}

function parseSheet(data: unknown[][]): ParsedRow[] {
  if (data.length < 2) return [];
  const rows = data.slice(1);
  return rows
    .filter((r) => r.some((v) => v !== "" && v !== null && v !== undefined))
    .map((r) => {
      const name = String(r[0] ?? "").trim();
      const modelType = String(r[1] ?? "").trim();
      const supplierRaw = String(r[2] ?? "").trim();
      const supplier = SUPPLIERS.includes(supplierRaw) ? supplierRaw : "その他";
      const purchasePrice = Number(r[3]) || 0;
      const sellingPrice = Number(r[4]) || 0;
      const notes = String(r[5] ?? "").trim();

      const errors: string[] = [];
      if (!name) errors.push("品名が空");
      if (purchasePrice <= 0) errors.push("仕入単価が0以下");
      if (sellingPrice <= 0) errors.push("売値単価が0以下");

      return {
        name,
        modelType,
        supplier,
        purchasePrice,
        sellingPrice,
        notes,
        _error: errors.length > 0 ? errors.join("、") : undefined,
      };
    });
}

export default function ImportDialog({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<UpsertResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        const parsed = parseSheet(data);
        if (parsed.length === 0) {
          setError("データが見つかりませんでした。テンプレートの形式を確認してください。");
          return;
        }
        setRows(parsed);
        setStep("preview");
      } catch {
        setError("ファイルの読み込みに失敗しました。Excel（.xlsx）またはCSVを選択してください。");
      }
    };
    reader.readAsBinaryString(file);
  };

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await upsertProducts(validRows);
      setResult(res);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">Excelから一括取り込み</h2>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">取り込み手順</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>テンプレートをダウンロード</li>
                <li>ExcelまたはGoogleスプレッドシートで製品を入力</li>
                <li>.xlsxファイルをアップロード</li>
              </ol>
            </div>

            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              テンプレートをダウンロード（.xlsx）
            </Button>

            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">クリックしてファイルを選択</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx / .xls / .csv に対応</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}

            <Button variant="outline" className="w-full" onClick={onClose}>
              キャンセル
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                取り込み可能 {validRows.length}件
              </span>
              {errorRows.length > 0 && (
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium">
                  エラー {errorRows.length}件（スキップ）
                </span>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">品名</th>
                    <th className="text-left px-3 py-2">型式</th>
                    <th className="text-right px-3 py-2">仕入単価</th>
                    <th className="text-right px-3 py-2">売値単価</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-gray-500">{r.modelType}</td>
                      <td className="px-3 py-2 text-right">
                        ¥{r.purchasePrice.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ¥{r.sellingPrice.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errorRows.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded p-3 space-y-1">
                <p className="font-semibold">スキップされる行：</p>
                {errorRows.map((r, i) => (
                  <p key={i}>
                    {r.name || "（品名なし）"} — {r._error}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}

            <p className="text-xs text-gray-500">
              ※ 同じ品名がすでに登録されている場合は上書き更新されます
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("upload")}
                disabled={submitting}
              >
                戻る
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={submitting || validRows.length === 0}
              >
                {submitting ? "保存中…" : `${validRows.length}件を登録する`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">取り込み完了</p>
              <p className="text-sm text-gray-600">
                新規追加 {result.inserted}件 ／ 更新 {result.updated}件
              </p>
            </div>
            <Button className="w-full" onClick={onComplete}>
              製品一覧に戻る
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
