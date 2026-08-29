import type { Material, TimeBlock, TimeBlockKind, WorkDayEntry } from "./types";
import { calcBlockHours } from "./workDayEntry";
import { formatMonthDay, sortWorkDayEntries } from "./workReportLayout";

/** 作業報告書シートに収まるブロック数（1ページ目30 ＋ 2〜6ページ目 32×5） */
export const REPORT_BLOCK_CAPACITY = 30 + 32 * 5;
/** 材料持出表シートに収まる明細行数（1ページ目13 ＋ 2〜4ページ目 23×3） */
export const MATERIAL_ROW_CAPACITY = 13 + 23 * 3;

export type ReportBlock = {
  date: string;
  monthDay: string;
  showDate: boolean;
  worker: string;
  location: string;
  content: string;
  timeBlock?: TimeBlock;
};

export type MaterialRow = {
  date: string;
  monthDay: string;
  productName: string;
  modelType: string;
  stockMark: string;
  supplier: string;
  quantity: number | "";
  unit: string;
  purchasePrice: number | "";
  sellingPrice: number | "";
  shippingFee: number | "";
};

function contentLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  return lines.length === 0 ? [""] : lines;
}

function sortedOutputBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return [...(blocks ?? [])]
    .filter((b) => b.kind !== "break")
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

export function buildReportBlocks(entries: WorkDayEntry[]): ReportBlock[] {
  const result: ReportBlock[] = [];
  for (const entry of sortWorkDayEntries(entries)) {
    const workers = (entry.workers ?? []).filter(Boolean);
    const targetWorkers = workers.length > 0 ? workers : [""];
    let dateWritten = false;

    for (const worker of targetWorkers) {
      const blocks = sortedOutputBlocks(entry.blocks);
      const lines = contentLines(entry.workContent);
      const count = Math.max(blocks.length, lines.length, 1);
      for (let i = 0; i < count; i += 1) {
        const showDate = !dateWritten;
        result.push({
          date: entry.date,
          monthDay: formatMonthDay(entry.date),
          showDate,
          worker,
          location: entry.location,
          content: lines[i] ?? "",
          timeBlock: blocks[i],
        });
        if (showDate) dateWritten = true;
      }
    }
  }
  return result;
}

export type WorkerHours = {
  travel: number;
  regular: number;
  overtime: number;
  holiday: number;
};

function emptyWorkerHours(): WorkerHours {
  return { travel: 0, regular: 0, overtime: 0, holiday: 0 };
}

/**
 * 作業者ごと・種別ごとの合計時間（単位：時間）。
 * 出力ブロック（buildReportBlocks）を数えるので、
 * 作業報告書シートの集計数式（CJ138〜141）と同じ値になる。
 */
export function sumHoursByWorker(entries: WorkDayEntry[]): Map<string, WorkerHours> {
  const result = new Map<string, WorkerHours>();
  for (const block of buildReportBlocks(entries)) {
    const timeBlock = block.timeBlock;
    if (!timeBlock) continue;
    const kind: TimeBlockKind = timeBlock.kind;
    if (kind === "break") continue;
    const hours = calcBlockHours(timeBlock);
    if (hours <= 0) continue;
    const current = result.get(block.worker) ?? emptyWorkerHours();
    current[kind] += hours;
    result.set(block.worker, current);
  }
  return result;
}

export function buildMaterialRows(materials: Material[]): MaterialRow[] {
  return [...materials]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((m) => ({
      date: m.date,
      monthDay: formatMonthDay(m.date),
      productName: m.productName,
      modelType: m.modelType,
      stockMark: m.isStock ? "✓" : "",
      supplier: m.supplier,
      quantity: m.quantity || "",
      unit: m.unit ?? "",
      purchasePrice: m.purchasePrice || "",
      sellingPrice: m.sellingPrice || "",
      shippingFee: m.shippingFee || "",
    }));
}
