"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { upsertCase } from "@/lib/caseRepository";
import {
  getCasesFromLocalStorage,
  clearCasesLocalStorage,
} from "@/lib/storage";
import { Upload } from "lucide-react";

type Props = {
  onImported: () => void;
};

export default function LocalCasesImportBanner({ onImported }: Props) {
  const [localCount, setLocalCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshLocalCount = () => {
    setLocalCount(getCasesFromLocalStorage().length);
  };

  useEffect(() => {
    refreshLocalCount();
  }, []);

  if (localCount === 0) return null;

  const handleImport = async () => {
    const locals = getCasesFromLocalStorage();
    if (locals.length === 0) return;

    const ok = window.confirm(
      `このブラウザにだけ保存されている案件が ${locals.length} 件あります。\n` +
        "Supabase にアップロードします。同じ案件 ID が既にある場合は、ブラウザ側の内容で上書きされます。\n\n" +
        "完了後、ブラウザ内のコピーは削除します（二重表示を防ぐため）。続行しますか？"
    );
    if (!ok) return;

    setImporting(true);
    setMessage(null);
    try {
      for (const c of locals) {
        await upsertCase(c);
      }
      clearCasesLocalStorage();
      setLocalCount(0);
      setMessage(`${locals.length} 件をクラウドに取り込みました。`);
      onImported();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Upload className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <div>
            <p className="font-medium">ブラウザ内の旧データがあります（{localCount} 件）</p>
            <p className="text-blue-800/90 mt-0.5">
              以前のバージョンでは案件がこの端末のブラウザにだけ保存されていました。クラウドに取り込むと、他の端末からも同じ案件を開けます。
            </p>
            {message && (
              <p className="mt-2 text-blue-900 font-medium" role="status">
                {message}
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 bg-white border-blue-200"
          disabled={importing}
          onClick={() => void handleImport()}
        >
          {importing ? "取り込み中..." : "クラウドに取り込む"}
        </Button>
      </div>
    </div>
  );
}
