"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus } from "lucide-react";
import {
  BasicInfo,
  Worker,
  WorkDayEntry,
  TimeRange,
  WORKERS,
  REGULAR_RATE,
  HOLIDAY_RATE,
  TRAVEL_RATE,
  COMPANY_INFO,
} from "@/lib/types";

type Props = {
  basicInfo: BasicInfo;
  selectedWorkers: Worker[];
  workDayEntries: WorkDayEntry[];
  onWorkDayEntriesChange: (entries: WorkDayEntry[]) => void;
};

function calcHours(range: TimeRange): number {
  if (!range.start || !range.end) return 0;
  const [sh, sm] = range.start.split(":").map(Number);
  const [eh, em] = range.end.split(":").map(Number);
  const h = (eh * 60 + em - sh * 60 - sm) / 60;
  return h > 0 ? h : 0;
}

function toReiwa(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `令和${d.getFullYear() - 2018}年`;
}

function formatMonthDay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatRange(range: TimeRange): string {
  if (!range.start && !range.end) return "";
  if (range.start && range.end) return `${range.start}~${range.end}`;
  return range.start || range.end;
}

export default function WorkReportStep({
  basicInfo,
  selectedWorkers,
  workDayEntries,
  onWorkDayEntriesChange,
}: Props) {
  const defaultWorker = selectedWorkers[0] || WORKERS[0];

  const addEntry = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const newEntry: WorkDayEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: dateStr,
      worker: defaultWorker,
      location: "",
      workContent: "",
      travel: { start: "", end: "" },
      regular: { start: "", end: "" },
      overtime: { start: "", end: "" },
      holiday: { start: "", end: "" },
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

  const updateRange = (
    id: string,
    category: "travel" | "regular" | "overtime" | "holiday",
    field: "start" | "end",
    value: string
  ) => {
    const entry = workDayEntries.find((e) => e.id === id);
    if (!entry) return;
    onWorkDayEntriesChange(
      workDayEntries.map((e) =>
        e.id === id
          ? { ...e, [category]: { ...e[category], [field]: value } }
          : e
      )
    );
  };

  const calcEntryCost = (entry: WorkDayEntry) => {
    const travelH = calcHours(entry.travel);
    const regularH = calcHours(entry.regular);
    const overtimeH = calcHours(entry.overtime);
    const holidayH = calcHours(entry.holiday);
    return Math.round(
      travelH * REGULAR_RATE * TRAVEL_RATE +
        regularH * REGULAR_RATE +
        overtimeH * REGULAR_RATE +
        holidayH * HOLIDAY_RATE
    );
  };

  const handlePrint = () => {
    const sorted = [...workDayEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const year = basicInfo.receptionDate
      ? toReiwa(basicInfo.receptionDate)
      : toReiwa(new Date().toISOString().slice(0, 10));

    const rows = sorted
      .map(
        (e) => `
      <tr>
        <td class="center">${formatMonthDay(e.date)}</td>
        <td class="center">${formatRange(e.travel)}</td>
        <td class="center">${formatRange(e.regular)}</td>
        <td class="center">${formatRange(e.overtime)}</td>
        <td class="center">${formatRange(e.holiday)}</td>
        <td class="center">${e.worker}</td>
        <td class="center">${e.location}</td>
        <td>${e.workContent}</td>
      </tr>`
      )
      .join("");

    const blankRows = Math.max(0, 15 - sorted.length);
    const blanks = Array(blankRows)
      .fill(
        `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      )
      .join("");

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
  table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  th { border: 1px solid #000; padding: 3px 4px; text-align: center; background: #f0f0f0; font-size: 10px; white-space: nowrap; }
  td { border: 1px solid #ccc; padding: 3px 4px; font-size: 10px; height: 20px; }
  td.center { text-align: center; white-space: nowrap; }
  .col-date { width: 5%; }
  .col-time { width: 8%; }
  .col-worker { width: 7%; }
  .col-location { width: 8%; }
  .col-content { width: auto; }
  @media print { body { padding: 10px; } }
</style>
</head><body>
  <div class="page-header">
    <div class="title">修 理 作 業 報 告 書</div>
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
      <tr>
        <th class="col-date">月/日</th>
        <th class="col-time">移動</th>
        <th class="col-time">作業内<br>(平日)</th>
        <th class="col-time">作業外<br>(平日)</th>
        <th class="col-time">休日</th>
        <th class="col-worker">作業者</th>
        <th class="col-location">場　所</th>
        <th class="col-content">作　　業　　内　　容</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${blanks}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">作業報告書の入力</h2>
          <p className="text-sm text-gray-500 mt-1">
            {basicInfo.shipName} / {basicInfo.customer}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} disabled={workDayEntries.length === 0}>
          <Printer className="w-4 h-4 mr-2" />
          1枚目を印刷
        </Button>
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
          const cost = calcEntryCost(entry);
          return (
            <div key={entry.id} className="border rounded-xl p-4 space-y-4 bg-gray-50">
              {/* 基本情報行 */}
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
                    onValueChange={(v) => updateEntry(entry.id, { worker: v as Worker })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKERS.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
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

              {/* 作業内容 */}
              <div>
                <Label className="text-xs text-gray-600">作業内容</Label>
                <textarea
                  value={entry.workContent}
                  onChange={(e) => updateEntry(entry.id, { workContent: e.target.value })}
                  placeholder="作業内容を入力してください"
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 時間範囲 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(
                  [
                    { key: "travel", label: "移動" },
                    { key: "regular", label: "時間内（平日）" },
                    { key: "overtime", label: "時間外（平日）" },
                    { key: "holiday", label: "休日" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-gray-600">{label}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="time"
                        value={entry[key].start}
                        onChange={(e) => updateRange(entry.id, key, "start", e.target.value)}
                        className="bg-white text-xs px-1"
                      />
                      <span className="text-gray-400 text-xs">~</span>
                      <Input
                        type="time"
                        value={entry[key].end}
                        onChange={(e) => updateRange(entry.id, key, "end", e.target.value)}
                        className="bg-white text-xs px-1"
                      />
                    </div>
                    {(entry[key].start || entry[key].end) && (
                      <p className="text-xs text-blue-600">
                        {calcHours(entry[key]).toFixed(1)}h
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* 合計と削除 */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-semibold text-blue-700">
                  工賃: ¥{cost.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  削除
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
              ¥{workDayEntries.reduce((sum, e) => sum + calcEntryCost(e), 0).toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
