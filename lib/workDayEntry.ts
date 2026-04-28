import type { ShipCase, TimeBlock, TimeBlockKind, WorkDayEntry, TimeRange, Worker } from "./types";
import { REGULAR_RATE, HOLIDAY_RATE, TRAVEL_RATE } from "./types";

export function newTimeBlockId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function calcBlockHours(block: { start: string; end: string }): number {
  if (!block.start || !block.end) return 0;
  const [sh, sm] = block.start.split(":").map(Number);
  const [eh, em] = block.end.split(":").map(Number);
  const h = (eh * 60 + em - sh * 60 - sm) / 60;
  return h > 0 ? h : 0;
}

function migrateWorkers(ex: Record<string, unknown>): Worker[] {
  if (Array.isArray(ex.workers)) return ex.workers as Worker[];
  if (typeof ex.worker === "string" && ex.worker) return [ex.worker as Worker];
  return [];
}

/** 旧形式（travel/regular/overtime/holiday / worker 文字列）を正規化 */
export function normalizeWorkDayEntry(entry: WorkDayEntry | Record<string, unknown>): WorkDayEntry {
  const ex = entry as Record<string, unknown>;
  if (Array.isArray(ex.blocks)) {
    // blocks あり = 新形式だが worker→workers マイグレーションは常に実行
    const e = entry as WorkDayEntry;
    return Array.isArray(ex.workers)
      ? e
      : { ...e, workers: migrateWorkers(ex) };
  }
  const blocks: TimeBlock[] = [];
  const tryAdd = (kind: TimeBlockKind, r: unknown) => {
    const range = r as TimeRange | undefined;
    if (!range?.start || !range?.end) return;
    const h = calcBlockHours(range);
    if (h <= 0) return;
    blocks.push({ id: newTimeBlockId(), kind, start: range.start, end: range.end });
  };
  tryAdd("travel", ex.travel);
  tryAdd("regular", ex.regular);
  tryAdd("overtime", ex.overtime);
  tryAdd("holiday", ex.holiday);
  return {
    id: String(ex.id ?? ""),
    date: String(ex.date ?? ""),
    workers: migrateWorkers(ex),
    location: String(ex.location ?? ""),
    workContent: String(ex.workContent ?? ""),
    blocks,
  };
}

/** 工賃（休憩は0） */
export function calcLaborCostForEntry(entry: WorkDayEntry): number {
  let sum = 0;
  for (const b of entry.blocks) {
    const h = calcBlockHours(b);
    if (h <= 0) continue;
    switch (b.kind) {
      case "break":
        break;
      case "travel":
        sum += h * REGULAR_RATE * TRAVEL_RATE;
        break;
      case "regular":
      case "overtime":
        sum += h * REGULAR_RATE;
        break;
      case "holiday":
        sum += h * HOLIDAY_RATE;
        break;
    }
  }
  return Math.round(sum);
}

export function formatBlockRange(b: TimeBlock): string {
  if (!b.start && !b.end) return "";
  if (b.start && b.end) return `${b.start}~${b.end}`;
  return b.start || b.end;
}

/** 印刷用：種別ごとに複数ブロックを結合 */
export function aggregateRangesForKind(entry: WorkDayEntry, kind: TimeBlockKind): string {
  return entry.blocks
    .filter((b) => b.kind === kind)
    .map(formatBlockRange)
    .filter(Boolean)
    .join(" / ");
}

/** 印刷用：休憩を作業内容欄向けに整形 */
export function formatBreaksForContent(entry: WorkDayEntry): string {
  const parts = entry.blocks
    .filter((b) => b.kind === "break" && b.start && b.end)
    .map((b) => `休憩 ${b.start}~${b.end}`);
  if (parts.length === 0) return entry.workContent;
  return [...parts, entry.workContent].filter(Boolean).join(" ／ ");
}

export function normalizeShipCase(c: ShipCase): ShipCase {
  return {
    ...c,
    workDayEntries: (c.workDayEntries || []).map((e) => normalizeWorkDayEntry(e)),
  };
}
