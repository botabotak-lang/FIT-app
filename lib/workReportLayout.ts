import type { BasicInfo, WorkDayEntry } from "./types";
import {
  aggregateRangesForKind,
  formatBreaksForContent,
} from "./workDayEntry";

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
  "作業内容（休憩は先頭に記載）",
] as const;

/** 明細の最低行数（印刷・Excel で一致） */
export const WORK_REPORT_MIN_BODY_ROWS = 15;

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

/** 船名・科目・型名・製造者（Excel 8列・印刷 info 行と同じ並び） */
export function buildWorkReportInfoRow(basic: BasicInfo): string[] {
  const empty = "　";
  return [
    "船名",
    basic.shipName || empty,
    "科目",
    basic.category || empty,
    "型名",
    basic.modelName || empty,
    "製造者",
    basic.manufacturer || empty,
  ];
}

/** 1行 = 1作業日（データ行のみ） */
export function buildWorkReportDataRows(sorted: WorkDayEntry[]): string[][] {
  return sorted.map((e) => [
    formatMonthDay(e.date),
    aggregateRangesForKind(e, "travel"),
    aggregateRangesForKind(e, "regular"),
    aggregateRangesForKind(e, "overtime"),
    aggregateRangesForKind(e, "holiday"),
    e.worker,
    e.location,
    formatBreaksForContent(e),
  ]);
}

export function buildWorkReportBlankRows(
  dataRowCount: number
): string[][] {
  const blankCount = Math.max(0, WORK_REPORT_MIN_BODY_ROWS - dataRowCount);
  return Array.from({ length: blankCount }, () => Array<string>(8).fill(""));
}

/** Excel 用：タイトル行（A〜G タイトル、H 年） */
export function buildWorkReportTitleRow(yearLabel: string): (string | number)[] {
  return [WORK_REPORT_TITLE_SPACED, "", "", "", "", "", "", yearLabel];
}

/** Excel 用：タイトル行の結合（0行 0〜6列） */
export const WORK_REPORT_TITLE_MERGE = {
  s: { r: 0, c: 0 },
  e: { r: 0, c: 6 },
} as const;

/** Excel 用列幅（印刷の列比率に近い） */
export const WORK_REPORT_EXCEL_COLS = [
  { wch: 6 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 10 },
  { wch: 8 },
  { wch: 12 },
  { wch: 44 },
];

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
        <th class="col-content">作　　業　　内　　容<br><span style="font-weight:normal;font-size:9px">（休憩は先頭に記載）</span></th>
      </tr>`;
}

/** 印刷用 tbody 行 HTML */
export function workReportBodyRowsHtml(sorted: WorkDayEntry[]): string {
  const dataRows = buildWorkReportDataRows(sorted);
  const rows = dataRows
    .map(
      (cells) => `
      <tr>
        <td class="center">${cells[0]}</td>
        <td class="center">${cells[1]}</td>
        <td class="center">${cells[2]}</td>
        <td class="center">${cells[3]}</td>
        <td class="center">${cells[4]}</td>
        <td class="center">${cells[5]}</td>
        <td class="center">${cells[6]}</td>
        <td class="work-content">${cells[7]}</td>
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
