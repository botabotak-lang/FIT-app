"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShipCase, CaseStatus } from "@/lib/types";
import {
  listCases,
  deleteShipCase,
  isSupabaseConfigured,
} from "@/lib/caseRepository";
import LocalCasesImportBanner from "@/components/LocalCasesImportBanner";
import { Plus, Ship, ChevronDown, ChevronRight, Trash2, FileText, Package, Building2, Users } from "lucide-react";

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string }> = {
  draft: { label: "作業中", color: "bg-yellow-100 text-yellow-800" },
  materials_added: { label: "材料入力済", color: "bg-blue-100 text-blue-800" },
  invoiced: { label: "請求済み", color: "bg-green-100 text-green-800" },
};

export default function HomePage() {
  const router = useRouter();
  const [cases, setCases] = useState<ShipCase[]>([]);
  const [search, setSearch] = useState("");
  const [expandedShips, setExpandedShips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshCases = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoadError(
        "Supabase が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
      );
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const list = await listCases();
      setCases(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "一覧の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCases();
  }, [refreshCases]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("この案件を削除しますか？")) return;
    try {
      await deleteShipCase(id);
      await refreshCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const toggleShip = (shipName: string) => {
    setExpandedShips((prev) => {
      const next = new Set(prev);
      if (next.has(shipName)) next.delete(shipName);
      else next.add(shipName);
      return next;
    });
  };

  // 船名でグループ化
  const grouped = cases.reduce<Record<string, ShipCase[]>>((acc, c) => {
    const key = c.basicInfo.shipName || "（船名未入力）";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  // 検索フィルタ
  const filteredKeys = Object.keys(grouped).filter(
    (k) =>
      k.toLowerCase().includes(search.toLowerCase()) ||
      grouped[k].some((c) =>
        c.basicInfo.customer.toLowerCase().includes(search.toLowerCase())
      )
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center text-gray-500">
        読み込み中...
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          {loadError}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">修理作業報告</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/products")}
            >
              <Package className="w-4 h-4 mr-1" />
              製品
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/customers")}
            >
              <Building2 className="w-4 h-4 mr-1" />
              顧客
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/employees")}
            >
              <Users className="w-4 h-4 mr-1" />
              社員
            </Button>
            <Button onClick={() => router.push("/case/new")}>
              <Plus className="w-4 h-4 mr-2" />
              新規作業
            </Button>
          </div>
        </div>

        <LocalCasesImportBanner onImported={() => void refreshCases()} />

        {/* 検索 */}
        <Input
          placeholder="船名・顧客名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 bg-white"
        />

        <p className="text-sm text-gray-500 mb-4">
          {filteredKeys.length}隻 / {cases.length}件
        </p>

        {/* 一覧 */}
        {filteredKeys.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-4">
              {cases.length === 0 ? "まだ作業報告がありません" : "検索結果がありません"}
            </p>
            {cases.length === 0 && (
              <Button onClick={() => router.push("/case/new")}>
                <Plus className="w-4 h-4 mr-2" />
                最初の作業報告を作成
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredKeys.sort().map((shipName) => {
              const shipCases = grouped[shipName].sort((a, b) =>
                b.updatedAt.localeCompare(a.updatedAt)
              );
              const isExpanded = expandedShips.has(shipName);
              const latestCase = shipCases[0];
              const statusCfg = STATUS_CONFIG[latestCase.status];

              return (
                <div key={shipName} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* 船名カード */}
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleShip(shipName)}
                  >
                    <div className="flex items-center gap-3">
                      <Ship className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">{shipName}</div>
                        <div className="text-sm text-gray-500">
                          {latestCase.basicInfo.customer} ・ {shipCases.length}件
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* 案件一覧（展開時） */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {shipCases.map((c) => {
                        const cfg = STATUS_CONFIG[c.status];
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                            onClick={() => router.push(`/case/${c.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {c.basicInfo.category || "（科目未入力）"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {c.basicInfo.receptionDate
                                    ? new Date(
                                        c.basicInfo.receptionDate + "T12:00:00"
                                      ).toLocaleDateString("ja-JP")
                                    : "—"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <button
                                onClick={(e) => void handleDelete(c.id, e)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                aria-label="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
