import type { ReportImportError } from "./reportImport";
import type { TimeBlock, WorkDayEntry } from "./types";
import { newTimeBlockId } from "./workDayEntry";

/** エラーが大量に出たときに画面が埋まらないよう、表示はここまで */
const MAX_SHOWN_ERRORS = 10;

/** 読み込めるファイルサイズの上限（10MB） */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** サイズ上限を超えたときの表示メッセージ */
export const OVERSIZE_FILE_MESSAGE =
  "読み取れませんでした：ファイルサイズが大きすぎます（10MBまで）";

/** 上限を超えたファイルか（超えていたら読み込まずに中止する） */
export function isOversizeImportFile(file: { size: number }): boolean {
  return file.size > MAX_IMPORT_FILE_SIZE;
}

/**
 * 読み取れた件数が0件のときの表示メッセージ。
 * 0件で置き換えると既存データが全消しになるため、確認ダイアログを出さずに中止する。
 */
export function emptyImportMessage(kind: "work" | "materials"): string {
  const label = kind === "work" ? "作業データ" : "材料データ";
  return `読み取れる${label}がありませんでした（現在のデータは変更していません）`;
}

/** 読み込みエラーを「［シート名］12行目：理由」の形にする（row=0 はファイル全体のエラー） */
export function formatImportErrors(errors: ReportImportError[]): string[] {
  const lines = errors.map((e) => {
    const sheet = e.sheet ? `［${e.sheet}］` : "";
    return e.row === 0 ? `${sheet}${e.reason}` : `${sheet}${e.row}行目：${e.reason}`;
  });
  if (lines.length <= MAX_SHOWN_ERRORS) return lines;
  return [
    ...lines.slice(0, MAX_SHOWN_ERRORS),
    `ほか ${lines.length - MAX_SHOWN_ERRORS}件のエラーがあります`,
  ];
}

/** 開始時刻の昇順。時刻未入力のブロックは末尾に寄せる */
function byStart(a: TimeBlock, b: TimeBlock): number {
  if (!a.start) return b.start ? 1 : 0;
  if (!b.start) return -1;
  return a.start.localeCompare(b.start);
}

/**
 * 休憩は帳票（Excel）に出力されないため、読み込みで消えてしまう。
 * 置き換え前のエントリから日付ごとの休憩ブロックを集め、同じ日付の
 * 読み込み結果に足し戻してから開始時刻順に並べ替える。
 * 同じ日に複数エントリがあるときは、二重計上を避けて最初の1件にだけ足す。
 */
export function mergeBreakBlocks(
  existing: WorkDayEntry[],
  imported: WorkDayEntry[]
): WorkDayEntry[] {
  const breaksByDate = new Map<string, TimeBlock[]>();
  for (const entry of existing) {
    for (const block of entry.blocks ?? []) {
      if (block.kind !== "break") continue;
      const list = breaksByDate.get(entry.date) ?? [];
      // 同じ日の同じ時間帯の休憩は1つにまとめる
      if (list.some((b) => b.start === block.start && b.end === block.end)) continue;
      list.push(block);
      breaksByDate.set(entry.date, list);
    }
  }

  const merged = new Set<string>();
  return imported.map((entry) => {
    const breaks = breaksByDate.get(entry.date);
    if (!breaks?.length || merged.has(entry.date)) return entry;
    merged.add(entry.date);
    return {
      ...entry,
      blocks: [
        ...entry.blocks,
        ...breaks.map((b) => ({ ...b, id: newTimeBlockId() })),
      ].sort(byStart),
    };
  });
}
