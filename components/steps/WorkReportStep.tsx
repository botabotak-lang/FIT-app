"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
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
import { getActiveEmployees, Employee } from "@/lib/employeeMaster";
import {
  WORK_REPORT_TITLE_SPACED,
  WORK_REPORT_TABLE_HEADERS,
  workReportYearLabel,
  sortWorkDayEntries,
  buildWorkReportInfoRow,
  buildWorkReportDataRows,
  buildWorkReportBlankRows,
  buildWorkReportTitleRow,
  WORK_REPORT_TITLE_MERGE,
  WORK_REPORT_EXCEL_COLS,
  workReportTableHeaderCellsHtml,
  workReportBodyRowsHtml,
} from "@/lib/workReportLayout";

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

  useEffect(() => {
    getActiveEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  const activeWorkerNames = useMemo(
    () => employees.map((e) => e.name),
    [employees]
  );

  const workerOptions = useMemo(() => {
    const legacy = new Set<string>();
    workDayEntries.forEach((e) => {
      if (e.worker && !activeWorkerNames.includes(e.worker)) legacy.add(e.worker);
    });
    selectedWorkers.forEach((w) => {
      if (w && !activeWorkerNames.includes(w)) legacy.add(w);
    });
    return [...activeWorkerNames, ...Array.from(legacy)];
  }, [activeWorkerNames, workDayEntries, selectedWorkers]);

  const defaultWorker = selectedWorkers[0] || activeWorkerNames[0] || "";

  const addEntry = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const newEntry: WorkDayEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: dateStr,
      worker: defaultWorker || workerOptions[0] || "",
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

  const handleExportWorkReportExcel = () => {
    const sorted = sortWorkDayEntries(workDayEntries);
    const year = workReportYearLabel(basicInfo);
    const dataRows = buildWorkReportDataRows(sorted);
    const blankRows = buildWorkReportBlankRows(sorted.length);
    const aoa: (string | number)[][] = [
      buildWorkReportTitleRow(year),
      buildWorkReportInfoRow(basicInfo),
      [...WORK_REPORT_TABLE_HEADERS],
      ...dataRows,
      ...blankRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: WORK_REPORT_TITLE_MERGE.s, e: WORK_REPORT_TITLE_MERGE.e },
    ];
    ws["!cols"] = WORK_REPORT_EXCEL_COLS;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "作業報告1枚目");
    const stamp = new Date().toISOString().slice(0, 10);
    const safeShip = (basicInfo.shipName || "案件").replace(/[/\\?*[\]:]/g, "_");
    XLSX.writeFile(wb, `修理作業報告1枚目_${safeShip}_${stamp}.xlsx`);
  };

  const handlePrint = () => {
    const sorted = sortWorkDayEntries(workDayEntries);
    const year = workReportYearLabel(basicInfo);
    const bodyHtml = workReportBodyRowsHtml(sorted);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>修理作業報告書</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif; padding: 20px; font-size: 11px; color: #000; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .title { font-size: 20px; font-weight: bold; letter-spacing: 8px; }
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
  @media print { body { padding: 10px; } }
</style>
</head><body>
  <div class="page-header">
    <div class="title">${WORK_REPORT_TITLE_SPACED}</div>
    <div class="year">${year}</div>
  </div>
  <div class="info-row">
    <div class="info-cell"><div class="info-label">船名</div><div class="info-value">${basicInfo.shipName || "　"}</div></div>
    <div class="info-cell"><div class="info-label">科目</div><div class="info-value">${basicInfo.category || "　"}</div></div>
    <div class="info-cell"><div class="info-label">型名</div><div class="info-value">${basicInfo.modelName || "　"}</div></div>
    <div class="info-cell"><div class="info-label">製造者</div><div class="info-value">${basicInfo.manufacturer || "　"}</div></div>
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
            Excelで出力（1枚目）
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={workDayEntries.length === 0}>
            <Printer className="w-4 h-4 mr-2" />
            印刷
          </Button>
        </div>
      </div>

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
          const cost = calcLaborCostForEntry(entry);
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
                  <Label className="text-xs text-gray-600">作業者</Label>
                  <Select
                    value={entry.worker}
                    onValueChange={(v) => updateEntry(entry.id, { worker: v })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workerOptions.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                          {!activeWorkerNames.includes(w) ? "（マスタ外）" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div>
                <Label className="text-xs text-gray-600">作業内容</Label>
                <textarea
                  value={entry.workContent}
                  onChange={(e) => updateEntry(entry.id, { workContent: e.target.value })}
                  placeholder="作業内容を入力（改行可。休憩は下の時間ブロックで登録すると印刷・Excelで先頭へ結合されます）"
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white resize-y min-h-[5rem] whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                .reduce((sum, e) => sum + calcLaborCostForEntry(e), 0)
                .toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
