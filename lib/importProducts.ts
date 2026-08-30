import * as XLSX from "xlsx";
import type { ProductInput } from "./productMaster";
import { normalizeSupplier } from "./types";

/** テンプレートの列（「単位」は任意列。無いブックでも取り込める） */
export const TEMPLATE_COLUMNS = ["品名", "型式（規格）", "仕入先", "仕入値", "売値", "備考", "単位"];

/** 取り込み対象外のシート（テンプレートの記入例） */
export const SKIP_SHEETS = ["製品マスタ 例"];

export type ParsedRow = ProductInput & {
  /** 取込元シート名（エラー表示・調査用） */
  sheetName: string;
  /** Excel 上の行番号（ヘッダー行を 1 とする） */
  rowNumber: number;
  /** 取り込めない理由（undefined なら取り込み可） */
  error?: string;
};

/**
 * 既存製品との突合キー。品名だけだと同名・別型式（例「アンテナ」×7）を
 * 1件に潰してしまうため、品名＋型式で識別する。
 */
export function productKey(name: string, modelType: string): string {
  return `${name} ${modelType}`.trim();
}

/** ヘッダー行から「単位」列の位置を探す（列順は問わない。無ければ -1） */
export function findUnitColumn(header: unknown[]): number {
  return header.findIndex((cell) => String(cell ?? "").trim().replace(/\s/g, "") === "単位");
}

/** セル内改行を空白に潰して trim する */
function flatten(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim();
}

/** 1シート分の二次元配列を取込行に変換する（1行目はヘッダー） */
export function parseSheet(data: unknown[][], sheetName: string): ParsedRow[] {
  if (data.length < 2) return [];
  const unitIndex = findUnitColumn(data[0] ?? []);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i] ?? [];
    // 完全な空行は無視する
    if (!r.some((v) => v !== "" && v !== null && v !== undefined)) continue;

    const name = flatten(r[0]);
    const modelType = flatten(r[1]);
    // 仕入先は whitelist で潰さず、表記ゆれだけ正規化してそのまま保存する
    const supplier = normalizeSupplier(r[2]);

    // 仕入値は小数のまま扱う（例 25.7円・0.67円）
    const purchaseParsed = Number(r[3]);
    const purchasePrice = Number.isFinite(purchaseParsed) ? purchaseParsed : 0;

    const sellingRaw = String(r[4] ?? "").trim();
    const sellingParsed = Number(r[4]);
    // 「?」「？」空欄は「売値未定」として 0＋備考で残す
    const sellingUnknown = sellingRaw === "" || !Number.isFinite(sellingParsed);
    const sellingPrice = sellingUnknown ? 0 : sellingParsed;

    const unit = unitIndex >= 0 ? flatten(r[unitIndex]) : "";

    const notesBase = flatten(r[5]);
    const notes = sellingUnknown
      ? notesBase
        ? `${notesBase}・売値要確認`
        : "売値要確認"
      : notesBase;

    const errors: string[] = [];
    if (!name) errors.push("品名が空");
    if (purchasePrice <= 0) errors.push("仕入単価が0以下");
    if (!sellingUnknown && sellingPrice <= 0) errors.push("売値単価が0以下");

    rows.push({
      name,
      modelType,
      supplier,
      unit,
      purchasePrice,
      sellingPrice,
      notes,
      sheetName,
      rowNumber: i + 1,
      error: errors.length > 0 ? errors.join("、") : undefined,
    });
  }
  return rows;
}

/** ブック全体を取込行に変換する（記入例シートは除く） */
export function parseWorkbook(wb: XLSX.WorkBook): ParsedRow[] {
  const all: ParsedRow[] = [];
  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.includes(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    all.push(...parseSheet(data, sheetName));
  }
  return all;
}

/**
 * 同一バッチ内で「品名＋型式」が重複する行を後勝ちで1件にまとめる。
 * merged は「まとめて消えた行数」。
 */
export function dedupeRows<T extends ProductInput>(rows: T[]): { rows: T[]; merged: number } {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    byKey.set(productKey(row.name, row.modelType), row);
  }
  return { rows: [...byKey.values()], merged: rows.length - byKey.size };
}

export type ImportSummary = {
  /** 解析できた行数（空行・記入例シートを除く） */
  totalRows: number;
  /** 取り込み可能な行数（重複をまとめた後） */
  validRows: number;
  /** 重複でまとめた件数 */
  merged: number;
  /** エラーでスキップする行数 */
  errorRows: number;
  /** エラー理由ごとの件数 */
  errorReasons: Record<string, number>;
  /** 仕入先ごとの件数（解析できた全行） */
  supplierCounts: Record<string, number>;
  /** 仕入値が小数の行数（解析できた全行） */
  decimalPurchaseCount: number;
  /** シートごとの件数（解析できた行数ベース） */
  sheetCounts: Record<string, number>;
};

/** 取込内容の集計（プレビュー表示・ドライラン用。DBには触れない） */
export function summarizeRows(rows: ParsedRow[]): ImportSummary {
  const valid = rows.filter((r) => !r.error);
  const errors = rows.filter((r) => r.error);
  const { rows: unique, merged } = dedupeRows(valid);

  const errorReasons: Record<string, number> = {};
  for (const r of errors) {
    const reason = r.error ?? "不明";
    errorReasons[reason] = (errorReasons[reason] ?? 0) + 1;
  }

  const supplierCounts: Record<string, number> = {};
  for (const r of rows) {
    const key = r.supplier || "（空欄）";
    supplierCounts[key] = (supplierCounts[key] ?? 0) + 1;
  }

  const sheetCounts: Record<string, number> = {};
  for (const r of rows) {
    sheetCounts[r.sheetName] = (sheetCounts[r.sheetName] ?? 0) + 1;
  }

  return {
    totalRows: rows.length,
    validRows: unique.length,
    merged,
    errorRows: errors.length,
    errorReasons,
    supplierCounts,
    decimalPurchaseCount: rows.filter((r) => r.purchasePrice % 1 !== 0).length,
    sheetCounts,
  };
}
