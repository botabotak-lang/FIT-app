import * as XLSX from "xlsx";
import type { WorkDayEntry, TimeBlock, TimeBlockKind } from "./types";
import { newTimeBlockId } from "./workDayEntry";

/**
 * 時間範囲テキスト「08:00~09:00 / 16:15~17:00」→ TimeBlock[]
 * aggregateRangesForKind の逆変換
 */
function parseTimeRanges(text: string, kind: TimeBlockKind): TimeBlock[] {
  if (!text || !text.trim()) return [];
  return text
    .split(" / ")
    .map((rangeStr) => {
      const parts = rangeStr.trim().split("~");
      if (parts.length !== 2) return null;
      const start = parts[0].trim();
      const end = parts[1].trim();
      if (!start || !end) return null;
      const block: TimeBlock = { id: newTimeBlockId(), kind, start, end };
      return block;
    })
    .filter((b): b is TimeBlock => b !== null);
}

/**
 * 月/日テキスト「1/22」→ 「YYYY-MM-DD」
 * 年は receptionDate から取得
 */
function parseMonthDay(text: string, year: number): string {
  const match = String(text).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return "";
  const m = parseInt(match[1], 10).toString().padStart(2, "0");
  const d = parseInt(match[2], 10).toString().padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * 作業内容テキストから休憩ブロックを分離
 * formatBreaksForContent の逆変換
 * 例: 「休憩 08:00~09:00 ／ 作業内容テキスト」
 */
function parseWorkContent(
  text: string
): { workContent: string; breakBlocks: TimeBlock[] } {
  if (!text || !text.trim()) return { workContent: "", breakBlocks: [] };

  const lines = text.split(" ／ ");
  const breakBlocks: TimeBlock[] = [];
  const nonBreakLines: string[] = [];

  for (const line of lines) {
    const breakMatch = line.trim().match(/^休憩\s*(\d{2}:\d{2})~(\d{2}:\d{2})/);
    if (breakMatch) {
      breakBlocks.push({
        id: newTimeBlockId(),
        kind: "break",
        start: breakMatch[1],
        end: breakMatch[2],
      });
    } else {
      nonBreakLines.push(line);
    }
  }

  return {
    workContent: nonBreakLines.filter(Boolean).join(" ／ "),
    breakBlocks,
  };
}

/**
 * 作業報告書 Excel ファイル（アプリ出力形式）を読み込んで WorkDayEntry[] を返す。
 * 5行目以降がデータ行（1〜4行目はヘッダー）。
 */
export function importWorkReportFromExcel(
  file: File,
  receptionDate: string
): Promise<WorkDayEntry[]> {
  const year = receptionDate
    ? new Date(receptionDate).getFullYear()
    : new Date().getFullYear();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        const DATA_START_INDEX = 4; // 0-indexed（5行目 = index 4）
        const entries: WorkDayEntry[] = [];

        for (let i = DATA_START_INDEX; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const monthDay = String(row?.[0] ?? "").trim();
          if (!monthDay) continue; // 月/日が空の行はスキップ

          const dateStr = parseMonthDay(monthDay, year);
          if (!dateStr) continue;

          const travel = parseTimeRanges(String(row[1] ?? ""), "travel");
          const regular = parseTimeRanges(String(row[2] ?? ""), "regular");
          const overtime = parseTimeRanges(String(row[3] ?? ""), "overtime");
          const holiday = parseTimeRanges(String(row[4] ?? ""), "holiday");

          const workerStr = String(row[5] ?? "").trim();
          const workers = workerStr
            ? workerStr.split(/[、,]/).map((w) => w.trim()).filter(Boolean)
            : [];

          const location = String(row[6] ?? "").trim();
          const rawContent = String(row[7] ?? "").trim();
          const { workContent, breakBlocks } = parseWorkContent(rawContent);

          entries.push({
            id: `import-${Date.now()}-${i}`,
            date: dateStr,
            workers,
            location,
            workContent,
            blocks: [...travel, ...regular, ...overtime, ...holiday, ...breakBlocks],
          });
        }

        resolve(entries);
      } catch (e) {
        reject(new Error(`Excelの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`));
      }
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsBinaryString(file);
  });
}
