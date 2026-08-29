import type { Material, ShipCase, TimeBlock, TimeBlockKind, WorkDayEntry, TimeRange, Worker } from "./types";
import { DEFAULT_LABOR_RATES, type LaborRates } from "./laborRates";

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

/** 時間ブロック1つ分の工賃（休憩は0・端数は丸めない） */
export function calcBlockCost(
  block: Pick<TimeBlock, "kind" | "start" | "end">,
  rates: LaborRates = DEFAULT_LABOR_RATES
): number {
  const h = calcBlockHours(block);
  if (h <= 0) return 0;
  switch (block.kind) {
    case "break":
      return 0;
    case "travel":
      return h * rates.regular * rates.travelFactor;
    case "regular":
    case "overtime":
      return h * rates.regular;
    case "holiday":
      return h * rates.holiday;
    default:
      return 0;
  }
}

/** 工賃（休憩は0） */
export function calcLaborCostForEntry(
  entry: WorkDayEntry,
  rates: LaborRates = DEFAULT_LABOR_RATES
): number {
  let sum = 0;
  for (const b of entry.blocks) sum += calcBlockCost(b, rates);
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

/** 旧データには unit が無い（Phase C で追加） */
export function normalizeMaterial(material: Material | Record<string, unknown>): Material {
  const m = material as Material & Record<string, unknown>;
  return { ...m, unit: typeof m.unit === "string" ? m.unit : "" };
}

export function normalizeShipCase(c: ShipCase): ShipCase {
  return {
    ...c,
    workDayEntries: (c.workDayEntries || []).map((e) => normalizeWorkDayEntry(e)),
    materials: (c.materials || []).map((m) => normalizeMaterial(m)),
  };
}
