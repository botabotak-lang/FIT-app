import type { BasicInfo, WorkDayEntry } from "./types";
import { aggregateRangesForKind } from "./workDayEntry";

/** 印刷・Excel で共通 */
export const WORK_REPORT_TITLE_SPACED = "修 理 作 業 報 告 書";

export const WORK_REPORT_TABLE_HEADERS = [
  "月/日",
  "移動",
  "作業内(平日)",
  "作業外(平日)",
  "休日",
  "作業者",
  "場　所",
  "作業内容",
] as const;

/** 明細の最低行数（印刷・Excel で一致） */
export const WORK_REPORT_MIN_BODY_ROWS = 15;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** 印刷用HTMLに埋め込むユーザー入力は必ずこれを通す（改行は pre-wrap で表示） */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function toReiwa(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `令和${d.getFullYear() - 2018}年`;
}

export function workReportYearLabel(basic: BasicInfo): string {
  return basic.receptionDate
    ? toReiwa(basic.receptionDate)
    : toReiwa(new Date().toISOString().slice(0, 10));
}

export function formatMonthDay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function sortWorkDayEntries(entries: WorkDayEntry[]): WorkDayEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/** 1行 = 1作業日（データ行のみ） */
export function buildWorkReportDataRows(sorted: WorkDayEntry[]): string[][] {
  return sorted.map((e) => [
    formatMonthDay(e.date),
    aggregateRangesForKind(e, "travel"),
    aggregateRangesForKind(e, "regular"),
    aggregateRangesForKind(e, "overtime"),
    aggregateRangesForKind(e, "holiday"),
    (e.workers ?? []).join("、"),
    e.location,
    e.workContent,
  ]);
}

/** 印刷用テーブルヘッダー HTML（th 内） */
export function workReportTableHeaderCellsHtml(): string {
  return `
      <tr>
        <th class="col-date">${WORK_REPORT_TABLE_HEADERS[0]}</th>
        <th class="col-time">${WORK_REPORT_TABLE_HEADERS[1]}</th>
        <th class="col-time">${WORK_REPORT_TABLE_HEADERS[2].replace("(平日)", "<br>(平日)")}</th>
        <th class="col-time">${WORK_REPORT_TABLE_HEADERS[3].replace("(平日)", "<br>(平日)")}</th>
        <th class="col-time">${WORK_REPORT_TABLE_HEADERS[4]}</th>
        <th class="col-worker">${WORK_REPORT_TABLE_HEADERS[5]}</th>
        <th class="col-location">${WORK_REPORT_TABLE_HEADERS[6]}</th>
        <th class="col-content">作　　業　　内　　容</th>
      </tr>`;
}

/** 印刷用 tbody 行 HTML */
export function workReportBodyRowsHtml(sorted: WorkDayEntry[]): string {
  const dataRows = buildWorkReportDataRows(sorted);
  const rows = dataRows
    .map(
      (cells) => `
      <tr>
        <td class="center">${escapeHtml(cells[0])}</td>
        <td class="center">${escapeHtml(cells[1])}</td>
        <td class="center">${escapeHtml(cells[2])}</td>
        <td class="center">${escapeHtml(cells[3])}</td>
        <td class="center">${escapeHtml(cells[4])}</td>
        <td class="center">${escapeHtml(cells[5])}</td>
        <td class="center">${escapeHtml(cells[6])}</td>
        <td class="work-content">${escapeHtml(cells[7])}</td>
      </tr>`
    )
    .join("");

  const blankRows = Math.max(0, WORK_REPORT_MIN_BODY_ROWS - sorted.length);
  const blanks = Array(blankRows)
    .fill(
      `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="work-content"></td></tr>`
    )
    .join("");

  return rows + blanks;
}
