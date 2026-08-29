"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShipCase, CaseStatus } from "@/lib/types";
import {
  listCases,
  deleteShipCase,
  isSupabaseConfigured,
} from "@/lib/caseRepository";
import LocalCasesImportBanner from "@/components/LocalCasesImportBanner";
import { Plus, Ship, ChevronDown, ChevronRight, Trash2, FileText, Package, Building2, Users, Settings } from "lucide-react";

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string }> = {
  draft: { label: "作業中", color: "bg-yellow-100 text-yellow-800" },
  materials_added: { label: "材料入力済", color: "bg-blue-100 text-blue-800" },
  invoiced: { label: "請求済み", color: "bg-green-100 text-green-800" },
};

/** 受付日が未入力・不正な案件をまとめるキー */
const UNKNOWN_KEY = "__unknown__";
/** 受付年月セレクトの「すべて」を表す値（Radix Select は空文字を許容しないため） */
const ALL_MONTHS = "__all__";

type ShipGroup = { key: string; shipName: string; cases: ShipCase[] };
type MonthGroup = { key: string; label: string; count: number; ships: ShipGroup[] };
type YearGroup = { key: string; label: string; count: number; months: MonthGroup[] };

/** "YYYY-MM-DD" → { year: "YYYY", month: "YYYY-MM" }。未入力・不正は UNKNOWN_KEY */
function receptionYearMonth(c: ShipCase): { year: string; month: string } {
  const m = /^(\d{4})-(\d{2})/.exec(c.basicInfo.receptionDate ?? "");
  if (!m) return { year: UNKNOWN_KEY, month: UNKNOWN_KEY };
  return { year: m[1], month: `${m[1]}-${m[2]}` };
}

/** 新しい順（UNKNOWN は常に最後） */
function compareKeysDesc(a: string, b: string): number {
  if (a === UNKNOWN_KEY) return 1;
  if (b === UNKNOWN_KEY) return -1;
  return b.localeCompare(a);
}

/** 受付日降順（同日は更新日時降順） */
function compareCasesDesc(a: ShipCase, b: ShipCase): number {
  const ad = a.basicInfo.receptionDate || "";
  const bd = b.basicInfo.receptionDate || "";
  if (ad !== bd) return bd.localeCompare(ad);
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** 年 ＞ 月 ＞ 船名 の3階層に組み立てる */
function buildYearGroups(cases: ShipCase[]): YearGroup[] {
  const years = new Map<string, Map<string, ShipCase[]>>();
  for (const c of cases) {
    const { year, month } = receptionYearMonth(c);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(c);
  }

  return Array.from(years.entries())
    .sort((a, b) => compareKeysDesc(a[0], b[0]))
    .map(([yearKey, monthMap]) => {
      const months: MonthGroup[] = Array.from(monthMap.entries())
        .sort((a, b) => compareKeysDesc(a[0], b[0]))
        .map(([monthKey, list]) => {
          const shipMap = new Map<string, ShipCase[]>();
          for (const c of list) {
            const name = c.basicInfo.shipName || "（船名未入力）";
            if (!shipMap.has(name)) shipMap.set(name, []);
            shipMap.get(name)!.push(c);
          }
          const ships: ShipGroup[] = Array.from(shipMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0], "ja"))
            .map(([shipName, shipCases]) => ({
              key: `${monthKey}::${shipName}`,
              shipName,
              cases: [...shipCases].sort(compareCasesDesc),
            }));
          return {
            key: monthKey,
            label:
              monthKey === UNKNOWN_KEY
                ? ""
                : `${Number(monthKey.slice(5, 7))}月`,
            count: list.length,
            ships,
          };
        });
      return {
        key: yearKey,
        label: yearKey === UNKNOWN_KEY ? "未分類（受付日なし）" : `${yearKey}年`,
        count: months.reduce((s, m) => s + m.count, 0),
        months,
      };
    });
}

function monthOptionLabel(monthKey: string): string {
  return `${monthKey.slice(0, 4)}年${Number(monthKey.slice(5, 7))}月`;
}

export default function HomePage() {
  const router = useRouter();
  const [cases, setCases] = useState<ShipCase[]>([]);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedShips, setExpandedShips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const expandInitializedRef = useRef(false);

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

  const toggleKey = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 受付年月セレクトの選択肢（データに存在する年月のみ・新しい順）
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      const { month } = receptionYearMonth(c);
      if (month !== UNKNOWN_KEY) set.add(month);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [cases]);

  // 検索（船名・顧客名）と受付年月の AND 絞り込み
  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      const matchText =
        !q ||
        (c.basicInfo.shipName || "").toLowerCase().includes(q) ||
        (c.basicInfo.customer || "").toLowerCase().includes(q);
      const matchMonth =
        !monthFilter || (c.basicInfo.receptionDate ?? "").startsWith(monthFilter);
      return matchText && matchMonth;
    });
  }, [cases, search, monthFilter]);

  const yearGroups = useMemo(() => buildYearGroups(filteredCases), [filteredCases]);
  const isFiltering = search.trim() !== "" || monthFilter !== "";
  const shipCount = useMemo(
    () =>
      new Set(filteredCases.map((c) => c.basicInfo.shipName || "（船名未入力）"))
        .size,
    [filteredCases]
  );

  // 初回読み込み時のみ、最新の年・月だけを開いておく
  useEffect(() => {
    if (expandInitializedRef.current || cases.length === 0) return;
    expandInitializedRef.current = true;
    const groups = buildYearGroups(cases);
    const latestYear = groups[0];
    if (!latestYear) return;
    setExpandedYears(new Set([latestYear.key]));
    setExpandedMonths(
      latestYear.months[0] ? new Set([latestYear.months[0].key]) : new Set()
    );
  }, [cases]);

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

  /** 船名カード（展開すると案件一覧） */
  const renderShipCard = (sg: ShipGroup) => {
    const isExpanded = expandedShips.has(sg.key);
    const latestCase = sg.cases[0];
    const statusCfg = STATUS_CONFIG[latestCase.status];

    return (
      <div key={sg.key} className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 船名カード */}
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          onClick={() => toggleKey(setExpandedShips, sg.key)}
        >
          <div className="flex items-center gap-3">
            <Ship className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-gray-900">{sg.shipName}</div>
              <div className="text-sm text-gray-500">
                {latestCase.basicInfo.customer} ・ {sg.cases.length}件
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
            {sg.cases.map((c) => {
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
  };

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/settings")}
            >
              <Settings className="w-4 h-4 mr-1" />
              設定
            </Button>
            <Button onClick={() => router.push("/case/new")}>
              <Plus className="w-4 h-4 mr-2" />
              新規作業
            </Button>
          </div>
        </div>

        <LocalCasesImportBanner onImported={() => void refreshCases()} />

        {/* 検索（テキスト＋受付年月・AND条件） */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <Input
            placeholder="船名・顧客名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white flex-1"
          />
          <Select
            value={monthFilter === "" ? ALL_MONTHS : monthFilter}
            onValueChange={(v) => setMonthFilter(v === ALL_MONTHS ? "" : v)}
          >
            <SelectTrigger className="bg-white w-full sm:w-[150px] shrink-0">
              <SelectValue placeholder="受付年月" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS}>すべて</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthOptionLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {shipCount}隻 / {filteredCases.length}件
          {isFiltering && `（全${cases.length}件）`}
        </p>

        {/* 一覧（年 ＞ 月 ＞ 船名 ＞ 案件） */}
        {filteredCases.length === 0 ? (
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
            {yearGroups.map((yg) => {
              // 絞り込み中は該当する年・月を自動で開く
              const yearOpen = isFiltering || expandedYears.has(yg.key);
              return (
                <div key={yg.key} className="space-y-2">
                  {/* 年 */}
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    onClick={() => toggleKey(setExpandedYears, yg.key)}
                  >
                    <div className="flex items-center gap-2">
                      {yearOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-bold text-gray-900">{yg.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{yg.count}件</span>
                  </button>

                  {yearOpen && (
                    <div className="space-y-2 pl-2">
                      {yg.months.map((mg) => {
                        // 「未分類」は月の階層を作らず船名カードを直接並べる
                        if (mg.label === "") {
                          return (
                            <div key={mg.key} className="space-y-2">
                              {mg.ships.map(renderShipCard)}
                            </div>
                          );
                        }
                        const monthOpen = isFiltering || expandedMonths.has(mg.key);
                        return (
                          <div key={mg.key} className="space-y-2">
                            {/* 月 */}
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white shadow-sm hover:bg-gray-50 transition-colors"
                              onClick={() => toggleKey(setExpandedMonths, mg.key)}
                            >
                              <div className="flex items-center gap-2">
                                {monthOpen ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="font-semibold text-gray-800">
                                  {mg.label}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {mg.count}件
                              </span>
                            </button>

                            {monthOpen && (
                              <div className="space-y-2 pl-2">
                                {mg.ships.map(renderShipCard)}
                              </div>
                            )}
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
