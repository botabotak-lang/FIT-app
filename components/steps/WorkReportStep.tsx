"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus, FileSpreadsheet, Upload } from "lucide-react";
import {
  BasicInfo,
  Worker,
  WorkDayEntry,
  TimeBlock,
  TimeBlockKind,
  TIME_BLOCK_LABELS,
} from "@/lib/types";
import {
  newTimeBlockId,
  calcBlockHours,
  calcLaborCostForEntry,
} from "@/lib/workDayEntry";
import {
  DEFAULT_LABOR_RATES,
  getLaborRatesForCustomer,
  type LaborRates,
} from "@/lib/laborRates";
import { getActiveEmployees, Employee } from "@/lib/employeeMaster";
import {
  WORK_REPORT_TITLE_SPACED,
  escapeHtml,
  workReportYearLabel,
  sortWorkDayEntries,
  workReportTableHeaderCellsHtml,
  workReportBodyRowsHtml,
} from "@/lib/workReportLayout";
import { confirmReportCapacity, downloadReportWorkbook } from "@/lib/reportWorkbook";
import { DEFAULT_LINE_LIMIT, overLimitLines, overLimitMessage } from "@/lib/lineWidth";
import { parseWorkReportWorkbook } from "@/lib/reportImport";
import {
  emptyImportMessage,
  formatImportErrors,
  isOversizeImportFile,
  mergeBreakBlocks,
  OVERSIZE_FILE_MESSAGE,
} from "@/lib/reportImportUi";

/** ファイル選択で受け付ける拡張子・MIME（自アプリが出力した .xlsx が前提） */
const XLSX_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Props = {
  basicInfo: BasicInfo;
  selectedWorkers: Worker[];
  workDayEntries: WorkDayEntry[];
  onWorkDayEntriesChange: (entries: WorkDayEntry[]) => void;
};

export default function WorkReportStep({
  basicInfo,
  selectedWorkers,
  workDayEntries,
  onWorkDayEntriesChange,
}: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<LaborRates>(DEFAULT_LABOR_RATES);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getActiveEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  // 請求先ごとの単価。請求先が変わったら取り直す
  useEffect(() => {
    getLaborRatesForCustomer(basicInfo.customer)
      .then(setRates)
      .catch(() => setRates(DEFAULT_LABOR_RATES));
  }, [basicInfo.customer]);

  const activeWorkerNames = useMemo(
    () => employees.map((e) => e.name),
    [employees]
  );

  const workerOptions = useMemo(() => {
    const legacy = new Set<string>();
    workDayEntries.forEach((e) => {
      (e.workers ?? []).forEach((w) => {
        if (w && !activeWorkerNames.includes(w)) legacy.add(w);
      });
    });
    selectedWorkers.forEach((w) => {
      if (w && !activeWorkerNames.includes(w)) legacy.add(w);
    });
    return [...activeWorkerNames, ...Array.from(legacy)];
  }, [activeWorkerNames, workDayEntries, selectedWorkers]);

  const addEntry = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const newEntry: WorkDayEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: dateStr,
      // 作業者は自動選択しない（毎回明示的に選ばせる）
      workers: [],
      location: "",
      workContent: "",
      blocks: [],
    };
    onWorkDayEntriesChange([...workDayEntries, newEntry]);
  };

  const removeEntry = (id: string) => {
    onWorkDayEntriesChange(workDayEntries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, updates: Partial<WorkDayEntry>) => {
    onWorkDayEntriesChange(
      workDayEntries.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const addBlock = (entryId: string) => {
    const block: TimeBlock = {
      id: newTimeBlockId(),
      kind: "regular",
      start: "",
      end: "",
    };
    onWorkDayEntriesChange(
      workDayEntries.map((e) =>
        e.id === entryId ? { ...e, blocks: [...e.blocks, block] } : e
      )
    );
  };

  const removeBlock = (entryId: string, blockId: string) => {
    onWorkDayEntriesChange(
      workDayEntries.map((e) =>
        e.id === entryId
          ? { ...e, blocks: e.blocks.filter((b) => b.id !== blockId) }
          : e
      )
    );
  };

  const updateBlock = (
    entryId: string,
    blockId: string,
    patch: Partial<Pick<TimeBlock, "kind" | "start" | "end">>
  ) => {
    onWorkDayEntriesChange(
      workDayEntries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              blocks: e.blocks.map((b) =>
                b.id === blockId ? { ...b, ...patch } : b
              ),
            }
          : e
      )
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルをもう一度選べるように、ここで選択をリセットしておく
    e.target.value = "";
    if (!file) return;
    if (isOversizeImportFile(file)) {
      setImportErrors([OVERSIZE_FILE_MESSAGE]);
      return;
    }
    setImporting(true);
    setImportErrors([]);
    try {
      const result = await parseWorkReportWorkbook(await file.arrayBuffer());
      if (result.errors.length > 0) {
        setImportErrors(formatImportErrors(result.errors));
        return;
      }
      // 0件で置き換えると既存データが全消しになるため、確認を出さずに中止する
      if (result.data.length === 0) {
        setImportErrors([emptyImportMessage("work")]);
        return;
      }
      const ok = window.confirm(
        `現在の作業データ${workDayEntries.length}件をExcelの内容${result.data.length}件で置き換えます。よろしいですか？`
      );
      if (!ok) return;
      // 休憩はExcelに出力されないので、既存データから同じ日付のものを引き継ぐ
      onWorkDayEntriesChange(mergeBreakBlocks(workDayEntries, result.data));
    } catch (err) {
      setImportErrors([
        err instanceof Error ? err.message : "読み取れませんでした",
      ]);
    } finally {
      setImporting(false);
    }
  };

  const handleExportWorkReportExcel = async () => {
    const sorted = sortWorkDayEntries(workDayEntries);
    const payload = { basicInfo, workDayEntries: sorted, materials: [] };
    if (!confirmReportCapacity(payload, "workReport", activeWorkerNames)) return;
    await downloadReportWorkbook(payload, activeWorkerNames, "workReport", rates);
  };

  const handlePrint = () => {
    const sorted = sortWorkDayEntries(workDayEntries);
    const year = workReportYearLabel(basicInfo);
    const bodyHtml = workReportBodyRowsHtml(sorted);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>修理作業報告書</title>
<style>
  @page { size: A4 landscape; margin: 9mm 13mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "MS PGothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif; padding: 10px; font-size: 11px; color: #000; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .title { font-size: 20px; font-weight: bold; letter-spacing: 8px; text-align: left; }
  .year { font-size: 12px; }
  .info-row { display: flex; gap: 0; border: 1px solid #000; border-bottom: none; }
  .info-cell { border-right: 1px solid #000; padding: 3px 6px; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 10px; color: #555; }
  .info-value { font-size: 12px; font-weight: bold; min-width: 80px; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #000; }
  th { border: 1px solid #000; padding: 3px 4px; text-align: center; background: #f0f0f0; font-size: 10px; white-space: nowrap; }
  td { border: 1px solid #ccc; padding: 3px 4px; font-size: 10px; min-height: 20px; }
  td.center { text-align: center; white-space: nowrap; }
  td.work-content { white-space: pre-wrap; word-break: break-word; vertical-align: top; text-align: left; }
  .col-date { width: 4%; }
  .col-time { width: 5.5%; }
  .col-worker { width: 6%; }
  .col-location { width: 7%; }
  .col-content { width: 57%; }
  @media print { body { padding: 0; } }
</style>
</head><body>
  <div class="page-header">
    <div class="title">${WORK_REPORT_TITLE_SPACED}</div>
    <div class="year">${year}</div>
  </div>
  <div class="info-row">
    <div class="info-cell"><div class="info-label">船名</div><div class="info-value">${escapeHtml(basicInfo.shipName) || "　"}</div></div>
    <div class="info-cell"><div class="info-label">科目</div><div class="info-value">${escapeHtml(basicInfo.category) || "　"}</div></div>
    <div class="info-cell"><div class="info-label">型名</div><div class="info-value">${escapeHtml(basicInfo.modelName) || "　"}</div></div>
    <div class="info-cell"><div class="info-label">製造者</div><div class="info-value">${escapeHtml(basicInfo.manufacturer) || "　"}</div></div>
  </div>
  <table>
    <thead>
      ${workReportTableHeaderCellsHtml()}
    </thead>
    <tbody>
      ${bodyHtml}
    </tbody>
  </table>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const sortedEntries = [...workDayEntries].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const blockKinds: TimeBlockKind[] = [
    "travel",
    "break",
    "regular",
    "overtime",
    "holiday",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">作業報告書の入力</h2>
          <p className="text-sm text-gray-500 mt-1">
            {basicInfo.shipName} / {basicInfo.customer}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            移動・休憩・作業内・作業外・休日を、時間帯ごとに「＋時間を追加」で何度でも登録できます。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button
            variant="default"
            onClick={handleExportWorkReportExcel}
            disabled={workDayEntries.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            作業報告書をExcel出力
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            data-testid="work-report-import"
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "読み込み中…" : "Excelから読み込み"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={XLSX_ACCEPT}
            className="hidden"
            onChange={handleImportFile}
            data-testid="work-report-import-file"
          />
          <Button variant="outline" onClick={handlePrint} disabled={workDayEntries.length === 0}>
            <Printer className="w-4 h-4 mr-2" />
            印刷
          </Button>
        </div>
      </div>

      {importErrors.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm"
          data-testid="work-report-import-errors"
        >
          <p className="font-semibold mb-1">
            Excelを読み込めませんでした（作業データは変更していません）
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {importErrors.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {workDayEntries.length === 0 && (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
          <p className="mb-3">作業日の記録がありません</p>
          <Button onClick={addEntry}>
            <Plus className="w-4 h-4 mr-2" />
            最初の作業日を追加
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {sortedEntries.map((entry) => {
          const cost = calcLaborCostForEntry(entry, rates);
          // 作業内容の1行が全角50文字を超えていないか（入力のたびに再計算）
          const overLines = overLimitLines(entry.workContent ?? "", DEFAULT_LINE_LIMIT);
          const overWarning = overLimitMessage(overLines, DEFAULT_LINE_LIMIT);
          return (
            <div key={entry.id} className="border rounded-xl p-4 space-y-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">月/日</Label>
                  <Input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">作業者（複数選択可）</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {workerOptions.map((w) => {
                      const isSelected = (entry.workers ?? []).includes(w);
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            const current = entry.workers ?? [];
                            const next = isSelected
                              ? current.filter((x) => x !== w)
                              : [...current, w];
                            updateEntry(entry.id, { workers: next });
                          }}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {w}
                          {!activeWorkerNames.includes(w) ? "＊" : ""}
                        </button>
                      );
                    })}
                  </div>
                  {(entry.workers ?? []).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.workers.join("、")}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-600">場所</Label>
                  <Input
                    value={entry.location}
                    onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
                    placeholder="例：焼津港、○○造船所"
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-800">時間ブロック</Label>
                {entry.blocks.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    下の「時間を追加」から移動・休憩・作業内などを登録してください。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entry.blocks.map((b, idx) => (
                      <div
                        key={b.id}
                        className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 bg-white border rounded-lg p-3"
                      >
                        <span className="text-xs text-gray-400 w-6 shrink-0 pt-2">{idx + 1}.</span>
                        <div className="w-full sm:w-40">
                          <Label className="text-xs text-gray-500">種別</Label>
                          <Select
                            value={b.kind}
                            onValueChange={(v) =>
                              updateBlock(entry.id, b.id, { kind: v as TimeBlockKind })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {blockKinds.map((k) => (
                                <SelectItem key={k} value={k}>
                                  {TIME_BLOCK_LABELS[k]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Input
                            type="time"
                            value={b.start}
                            onChange={(e) =>
                              updateBlock(entry.id, b.id, { start: e.target.value })
                            }
                            className="w-[110px] text-sm"
                          />
                          <span className="text-gray-400 text-sm">~</span>
                          <Input
                            type="time"
                            value={b.end}
                            onChange={(e) =>
                              updateBlock(entry.id, b.id, { end: e.target.value })
                            }
                            className="w-[110px] text-sm"
                          />
                          {b.start && b.end && (
                            <span className="text-xs text-blue-600 ml-1">
                              {calcBlockHours(b).toFixed(1)}h
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBlock(entry.id, b.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg self-end sm:self-auto"
                          aria-label="このブロックを削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto mt-1"
                  onClick={() => addBlock(entry.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  時間を追加
                </Button>
              </div>

              <div>
                <Label className="text-xs text-gray-600">作業内容</Label>
                <textarea
                  value={entry.workContent}
                  onChange={(e) => updateEntry(entry.id, { workContent: e.target.value })}
                  placeholder="作業内容を入力（改行可）"
                  rows={4}
                  aria-invalid={overWarning ? true : undefined}
                  className={`w-full border rounded-md px-3 py-2 text-sm bg-white resize-y min-h-[5rem] whitespace-pre-wrap focus:outline-none focus:ring-2 ${
                    overWarning
                      ? "border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  改行1つ＝報告書の1行。1行は全角50文字程度まで（超えた分は印刷で切れます）
                </p>
                {overWarning && (
                  <p role="alert" className="text-xs text-red-600 mt-1" data-testid="line-limit-warning">
                    {overWarning}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-semibold text-blue-700">
                  工賃: ¥{cost.toLocaleString()}
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    （休憩は0円）
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  この日を削除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {workDayEntries.length > 0 && (
        <>
          <Button variant="outline" onClick={addEntry} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            作業日を追加
          </Button>

          <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
            <span className="text-sm text-gray-600">工賃合計</span>
            <span className="text-xl font-bold text-blue-700">
              ¥
              {workDayEntries
                .reduce((sum, e) => sum + calcLaborCostForEntry(e, rates), 0)
                .toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
