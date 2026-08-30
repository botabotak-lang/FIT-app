import ExcelJS from "exceljs";
import type { BasicInfo, Material, ShipCase, TimeBlockKind, WorkDayEntry } from "./types";
import { workReportYearLabel } from "./workReportLayout";
import { travelHourlyRate, type LaborRates } from "./laborRates";
import {
  MATERIAL_ROW_CAPACITY,
  REPORT_BLOCK_CAPACITY,
  buildMaterialRows,
  buildReportBlocks,
  sumHoursByWorker,
  type WorkerHours,
} from "./reportBlocks";

export type ReportWorkbookKind = "workReport" | "materials" | "all";

const TEMPLATE_PATH = "/templates/fit_report_template.xlsx";
const WORK_SHEETS = ["作業報告書", "作業報告書 (2)", "作業報告書 (3)", "作業報告書 (4)", "作業報告書 (5)", "作業報告書 (END)"];
const MATERIAL_SHEETS = ["材料持出表", "材料持出表 (2)", "材料持出表 (3)", "材料持出表 (4)"];
/**
 * 作業者別集計枠（原本パターン）。
 * ラベル列は CF→CP→CZ→DJ→DT と10列間隔、値列はラベル列＋4列。
 * テンプレートに書式があるのは5枠目（DT〜EB）まで。6枠目以降（ED/EH, EN/ER …）は
 * 同じ間隔で列を計算し、5枠目のセル書式をコピーして生成する。
 */
const WORKER_LABEL_BASE_COL = "CF";
const WORKER_COL_STRIDE = 10;
const WORKER_VALUE_COL_OFFSET = 4;
/** テンプレートに書式が用意されている枠数 */
const WORKER_TEMPLATE_SLOTS = 5;
/** 材料持出表の作業者別集計行（行3〜9） */
const MATERIAL_WORKER_ROWS = 7;

function columnIndexOf(letter: string): number {
  let index = 0;
  for (const ch of letter) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index;
}

function columnLetterOf(index: number): string {
  let letter = "";
  let n = index;
  while (n > 0) {
    const rest = (n - 1) % 26;
    letter = String.fromCharCode(65 + rest) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

const WORKER_LABEL_BASE_INDEX = columnIndexOf(WORKER_LABEL_BASE_COL);

/** i番目（0始まり）の作業者枠のラベル列 */
function workerLabelCol(slot: number): string {
  return columnLetterOf(WORKER_LABEL_BASE_INDEX + slot * WORKER_COL_STRIDE);
}

/** i番目（0始まり）の作業者枠の値列 */
function workerValueCol(slot: number): string {
  return columnLetterOf(WORKER_LABEL_BASE_INDEX + slot * WORKER_COL_STRIDE + WORKER_VALUE_COL_OFFSET);
}

/** 5枠目のセル書式を6枠目以降にコピーする（テンプレートに書式が無いため） */
function copyCellStyle(ws: ExcelJS.Worksheet, fromAddress: string, toAddress: string): void {
  const src = ws.getCell(fromAddress);
  const dst = ws.getCell(toAddress);
  if (src.font) dst.font = src.font;
  if (src.alignment) dst.alignment = src.alignment;
  if (src.border) dst.border = src.border;
  if (src.fill) dst.fill = src.fill;
  if (src.numFmt) dst.numFmt = src.numFmt;
}

function excelFormula(formula: string): ExcelJS.CellValue {
  return { formula: formula.replace(/^=/, "") };
}

function timeValue(value?: string): number | undefined {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
  return (h * 60 + m) / 1440;
}

function dateValue(value?: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (Date.UTC(y, m - 1, d) - excelEpoch) / 86400000;
}

function setFormula(cell: ExcelJS.Cell, formula: string): void {
  cell.value = excelFormula(formula);
}

function setTime(cell: ExcelJS.Cell, value?: string): void {
  cell.value = timeValue(value) ?? null;
  cell.numFmt = "h:mm";
}

function safeName(name: string): string {
  return name.replace(/"/g, '""');
}

/** 原本は年号を全角数字で書いている（例「令 和 ８年」） */
function toFullWidthDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
}

/** 時間（h）→ Excel の時間値（日の小数。1時間 = 1/24） */
function hoursToExcelTime(hours: number): number {
  return hours / 24;
}

/** 社員マスタが空でも枠だけは出す（氏名は空欄） */
function workerNames(employees: string[]): string[] {
  return employees.filter(Boolean);
}

function workSheetStarts(firstPage: boolean): number[] {
  return firstPage
    ? [...Array.from({ length: 14 }, (_, i) => 11 + i * 4), ...Array.from({ length: 16 }, (_, i) => 70 + i * 4)]
    : [...Array.from({ length: 16 }, (_, i) => 4 + i * 4), ...Array.from({ length: 16 }, (_, i) => 71 + i * 4)];
}

function timeColumns(kind?: TimeBlockKind): ["E" | "H" | "K" | "N", "E" | "H" | "K" | "N"] | undefined {
  if (kind === "travel") return ["E", "E"];
  if (kind === "regular") return ["H", "H"];
  if (kind === "overtime") return ["K", "K"];
  if (kind === "holiday") return ["N", "N"];
  return undefined;
}

function clearReportBlock(ws: ExcelJS.Worksheet, row: number): void {
  for (const col of ["B", "E", "H", "K", "N", "Q", "T", "W"]) ws.getCell(`${col}${row}`).value = null;
  for (const col of ["E", "H", "K", "N"]) ws.getCell(`${col}${row + 3}`).value = null;
}

/** 作業者別集計の見出し行。ページ上部・ページ中央・合計欄でシートごとに位置が違う */
function workerHeaderRows(firstPage: boolean): number[] {
  return firstPage ? [9, 68, 136] : [2, 69, 136];
}

/** 6枠目以降は5枠目の書式を各行にコピーしてから書き込む */
function prepareExtraSlot(ws: ExcelJS.Worksheet, slot: number, rows: number[]): void {
  if (slot < WORKER_TEMPLATE_SLOTS) return;
  const srcLabel = workerLabelCol(WORKER_TEMPLATE_SLOTS - 1);
  const srcValue = workerValueCol(WORKER_TEMPLATE_SLOTS - 1);
  const labelCol = workerLabelCol(slot);
  const valueCol = workerValueCol(slot);
  for (const row of rows) {
    copyCellStyle(ws, `${srcLabel}${row}`, `${labelCol}${row}`);
    copyCellStyle(ws, `${srcValue}${row}`, `${valueCol}${row}`);
  }
}

function writeWorkerFormulas(wb: ExcelJS.Workbook, names: string[]): void {
  const slots = Math.max(WORKER_TEMPLATE_SLOTS, names.length);
  for (const sheetName of WORK_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    const firstPage = sheetName === "作業報告書";
    const starts = workSheetStarts(firstPage);
    const headerRows = workerHeaderRows(firstPage);
    const blockRows = starts.flatMap((row) => [row, row + 1, row + 2, row + 3]);
    const totalRows = [138, 139, 140, 141];
    for (let i = 0; i < slots; i += 1) {
      const labelCol = workerLabelCol(i);
      const valueCol = workerValueCol(i);
      const name = names[i] ?? "";
      prepareExtraSlot(ws, i, [...headerRows, ...blockRows, ...totalRows]);
      ws.getCell(`${labelCol}${headerRows[0]}`).value = `所要時間　${name}`;
      ws.getCell(`${labelCol}${headerRows[1]}`).value = `所要時間　${name}`;
      ws.getCell(`${labelCol}${headerRows[2]}`).value = `合計（${name}）`;
      for (const row of starts) {
        ws.getCell(`${labelCol}${row}`).value = "移動";
        ws.getCell(`${labelCol}${row + 1}`).value = "時間内";
        ws.getCell(`${labelCol}${row + 2}`).value = "時間外";
        ws.getCell(`${labelCol}${row + 3}`).value = "休日";
        setFormula(ws.getCell(`${valueCol}${row}`), name ? `IF(Q${row}="${safeName(name)}",E${row + 3}-E${row},0)` : "0");
        setFormula(ws.getCell(`${valueCol}${row + 1}`), name ? `IF(Q${row}="${safeName(name)}",H${row + 3}-H${row},0)` : "0");
        setFormula(ws.getCell(`${valueCol}${row + 2}`), name ? `IF(Q${row}="${safeName(name)}",K${row + 3}-K${row},0)` : "0");
        setFormula(ws.getCell(`${valueCol}${row + 3}`), name ? `IF(Q${row}="${safeName(name)}",N${row + 3}-N${row},0)` : "0");
      }
      for (let offset = 0; offset < 4; offset += 1) {
        const rows = starts.map((row) => `${valueCol}${row + offset}`);
        setFormula(ws.getCell(`${valueCol}${138 + offset}`), rows.join("+"));
      }
    }
    // 行137以降の作業者名リスト。枠を増やしたぶんだけ行も増やす
    for (let i = 0; i < slots; i += 1) {
      const row = 137 + i;
      if (i >= WORKER_TEMPLATE_SLOTS) copyCellStyle(ws, "Q141", `Q${row}`);
      ws.getCell(`Q${row}`).value = names[i] ?? "";
    }
    for (let offset = 0; offset < 4; offset += 1) {
      const refs = Array.from({ length: slots }, (_, i) => `${workerValueCol(i)}${138 + offset}`);
      setFormula(ws.getCell(`BZ${138 + offset}`), refs.join("+"));
    }
  }
}

/**
 * 材料持出表の作業者別集計。
 * hoursByWorker を渡した場合（材料持出表の単体出力）は、作業報告書シートを
 * 参照する 3D 数式が #REF! になるため、集計済みの時間値を直接書き込む。
 */
function writeMaterialWorkerFormulas(
  wb: ExcelJS.Workbook,
  names: string[],
  rates: LaborRates,
  hoursByWorker: Map<string, WorkerHours> | null
): void {
  const ws = wb.getWorksheet("材料持出表");
  if (!ws) return;
  // ヘッダーの単価表記を設定値に合わせる
  ws.getCell("M2").value = `工\u3000賃(@${rates.regular.toLocaleString("en-US")})`;
  ws.getCell("AE2").value = `工\u3000賃(@${rates.holiday.toLocaleString("en-US")})`;
  ws.getCell("AO2").value = `移動費(×${rates.travelFactor})`;
  for (let i = 0; i < MATERIAL_WORKER_ROWS; i += 1) {
    const row = 3 + i;
    const name = names[i] ?? "";
    ws.getCell(`A${row}`).value = name || null;
    ws.getCell(`AU${row}`).value = null;
    if (!name) {
      // 空き枠に 0 を印字しない
      for (const col of ["G", "S", "Y", "AK", "M", "AE", "AO"]) ws.getCell(`${col}${row}`).value = null;
      continue;
    }
    const valueCol = workerValueCol(i);
    if (hoursByWorker) {
      const h = hoursByWorker.get(name) ?? { travel: 0, regular: 0, overtime: 0, holiday: 0 };
      ws.getCell(`G${row}`).value = hoursToExcelTime(h.regular);
      ws.getCell(`S${row}`).value = hoursToExcelTime(h.overtime);
      ws.getCell(`Y${row}`).value = hoursToExcelTime(h.holiday);
      ws.getCell(`AK${row}`).value = hoursToExcelTime(h.travel);
    } else {
      setFormula(ws.getCell(`G${row}`), `SUM('作業報告書:作業報告書 (END)'!${valueCol}139)`);
      setFormula(ws.getCell(`S${row}`), `SUM('作業報告書:作業報告書 (END)'!${valueCol}140)`);
      setFormula(ws.getCell(`Y${row}`), `SUM('作業報告書:作業報告書 (END)'!${valueCol}141)`);
      setFormula(ws.getCell(`AK${row}`), `SUM('作業報告書:作業報告書 (END)'!${valueCol}138)`);
    }
    setFormula(ws.getCell(`M${row}`), `(G${row}*24)*${rates.regular}`);
    setFormula(ws.getCell(`AE${row}`), `(S${row}*24+Y${row}*24)*${rates.holiday}`);
    setFormula(ws.getCell(`AO${row}`), `(AK${row}*24)*${travelHourlyRate(rates)}`);
  }
}

function writeWorkReport(wb: ExcelJS.Workbook, basicInfo: BasicInfo, entries: WorkDayEntry[]): void {
  const first = wb.getWorksheet("作業報告書");
  if (first) {
    first.getCell("BU2").value = toFullWidthDigits(
      workReportYearLabel(basicInfo).replace("令和", "令 和 ")
    );
    first.getCell("C5").value = basicInfo.shipName || "";
    first.getCell("Y5").value = basicInfo.category || "";
    first.getCell("BB5").value = basicInfo.modelName || "";
    // BS5:BT8 はラベル「製造者」。値セルは BU5（結合 BU5:CC8）
    first.getCell("BU5").value = basicInfo.manufacturer || "";
  }
  const blocks = buildReportBlocks(entries);
  let index = 0;
  for (const sheetName of WORK_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;
    for (const row of workSheetStarts(sheetName === "作業報告書")) {
      clearReportBlock(ws, row);
      const block = blocks[index++];
      if (!block) continue;
      ws.getCell(`B${row}`).value = block.showDate ? dateValue(block.date) ?? block.monthDay : null;
      ws.getCell(`Q${row}`).value = block.worker;
      ws.getCell(`T${row}`).value = block.location;
      ws.getCell(`W${row}`).value = block.content;
      ws.getCell(`W${row}`).alignment = { ...(ws.getCell(`W${row}`).alignment ?? {}), wrapText: false };
      ws.getCell(`W${row}`).font = { ...(ws.getCell(`W${row}`).font ?? {}), name: "游ゴシック", size: 10 };
      const cols = timeColumns(block.timeBlock?.kind);
      if (cols && block.timeBlock) {
        setTime(ws.getCell(`${cols[0]}${row}`), block.timeBlock.start);
        setTime(ws.getCell(`${cols[1]}${row + 3}`), block.timeBlock.end);
      }
    }
  }
}

/**
 * 材料持出表の明細行と合計行。
 * 合計行はラベル（1ページ目 AF25/AO25・2ページ目以降 AF26/AO26）の右の結合セルで、
 * 仕入合計＝AJ列（結合 AJ{row}:AN{row}）・売値合計＝AS列（結合 AS{row}:AW{row}）。
 */
function materialRowSlots(): Array<{ sheet: string; rows: number[]; carrierCell: string; totalRow: number }> {
  const firstRows = Array.from({ length: 13 }, (_, i) => 12 + i);
  const restRows = Array.from({ length: 23 }, (_, i) => 3 + i);
  return [
    { sheet: "材料持出表", rows: firstRows, carrierCell: "Z25", totalRow: 25 },
    { sheet: "材料持出表 (2)", rows: restRows, carrierCell: "Z26", totalRow: 26 },
    { sheet: "材料持出表 (3)", rows: restRows, carrierCell: "Z26", totalRow: 26 },
    { sheet: "材料持出表 (4)", rows: restRows, carrierCell: "Z26", totalRow: 26 },
  ];
}

function writeMaterials(wb: ExcelJS.Workbook, basicInfo: BasicInfo, entries: WorkDayEntry[], materials: Material[]): void {
  const first = wb.getWorksheet("材料持出表");
  if (first) {
    first.getCell("D1").value = basicInfo.shipName || "";
    first.getCell("S1").value = basicInfo.category || "";
    first.getCell("AH1").value = basicInfo.modelName || "";
    // 完成月日は完成日フィールド。未入力なら空欄（受付日で代用しない）
    first.getCell("AX1").value = dateValue(basicInfo.completionDate) ?? null;
  }
  const rows = buildMaterialRows(materials);
  let index = 0;
  const firstWorker = entries.flatMap((e) => e.workers ?? []).find(Boolean) ?? "";
  for (const slot of materialRowSlots()) {
    const ws = wb.getWorksheet(slot.sheet);
    if (!ws) continue;
    ws.getCell(slot.carrierCell).value = firstWorker;
    for (const row of slot.rows) {
      for (const col of ["A", "E", "M", "U", "X", "AB", "AE", "AF", "AO", "AX"]) ws.getCell(`${col}${row}`).value = null;
      const item = rows[index++];
      if (!item) continue;
      ws.getCell(`A${row}`).value = dateValue(item.date) ?? item.monthDay;
      ws.getCell(`E${row}`).value = item.productName;
      ws.getCell(`M${row}`).value = item.modelType;
      ws.getCell(`U${row}`).value = item.stockMark;
      ws.getCell(`X${row}`).value = item.supplier;
      ws.getCell(`AB${row}`).value = item.quantity;
      ws.getCell(`AE${row}`).value = item.unit;
      ws.getCell(`AF${row}`).value = item.purchasePrice;
      ws.getCell(`AO${row}`).value = item.sellingPrice;
      ws.getCell(`AX${row}`).value = item.shippingFee;
    }
    // 仕入合計・売値合計（明細が無いページは 0 になる）
    const firstRow = slot.rows[0];
    const lastRow = slot.rows[slot.rows.length - 1];
    setFormula(ws.getCell(`AJ${slot.totalRow}`), `SUM(AJ${firstRow}:AJ${lastRow})`);
    setFormula(ws.getCell(`AS${slot.totalRow}`), `SUM(AS${firstRow}:AS${lastRow})`);
  }
}

function removeUnneededSheets(wb: ExcelJS.Workbook, kind: ReportWorkbookKind): void {
  if (kind === "all") return;
  const keep = new Set(kind === "workReport" ? WORK_SHEETS : MATERIAL_SHEETS);
  for (const ws of [...wb.worksheets]) {
    if (!keep.has(ws.name)) wb.removeWorksheet(ws.id);
  }
}

export async function createReportWorkbook(
  templateBuffer: ArrayBuffer,
  shipCase: Pick<ShipCase, "basicInfo" | "workDayEntries" | "materials">,
  employees: string[],
  kind: ReportWorkbookKind,
  rates: LaborRates
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const names = workerNames(employees);
  writeWorkReport(wb, shipCase.basicInfo, shipCase.workDayEntries);
  writeWorkerFormulas(wb, names);
  writeMaterials(wb, shipCase.basicInfo, shipCase.workDayEntries, shipCase.materials);
  // 材料持出表の単体出力は作業報告書シートを削除するため、3D参照ではなく集計値を書く
  writeMaterialWorkerFormulas(
    wb,
    names,
    rates,
    kind === "materials" ? sumHoursByWorker(shipCase.workDayEntries) : null
  );
  removeUnneededSheets(wb, kind);
  return wb;
}

export async function createReportWorkbookBuffer(
  templateBuffer: ArrayBuffer,
  shipCase: Pick<ShipCase, "basicInfo" | "workDayEntries" | "materials">,
  employees: string[],
  kind: ReportWorkbookKind,
  rates: LaborRates
): Promise<ExcelJS.Buffer> {
  const wb = await createReportWorkbook(templateBuffer, shipCase, employees, kind, rates);
  return wb.xlsx.writeBuffer();
}

function filename(kind: ReportWorkbookKind, basicInfo: BasicInfo): string {
  const prefix = kind === "workReport" ? "作業報告書" : kind === "materials" ? "材料持出表" : "帳票一式";
  const ship = (basicInfo.shipName || "未入力").replace(/[\\/:*?"<>|]/g, "_");
  const date = (basicInfo.receptionDate || new Date().toISOString().slice(0, 10)).replaceAll("-", "");
  return `${prefix}_${ship}_${date}.xlsx`;
}

/** 用紙に収まらない件数のときだけ警告文を返す（収まるなら null） */
export function reportCapacityWarning(
  shipCase: Pick<ShipCase, "workDayEntries" | "materials">,
  kind: ReportWorkbookKind,
  employees: string[] = []
): string | null {
  const messages: string[] = [];
  if (kind !== "workReport") {
    const workerCount = employees.filter(Boolean).length;
    if (workerCount > MATERIAL_WORKER_ROWS) {
      messages.push(
        `作業者が${workerCount}名です。材料持出表の工賃集計は${MATERIAL_WORKER_ROWS}名分しか行がないため、` +
          `${workerCount - MATERIAL_WORKER_ROWS}名分は出力されません（テンプレートの拡張が必要です）。`
      );
    }
  }
  if (kind !== "materials") {
    const count = buildReportBlocks(shipCase.workDayEntries).length;
    if (count > REPORT_BLOCK_CAPACITY) {
      messages.push(
        `作業報告書の明細 ${count}件が用紙に収まりません。先頭${REPORT_BLOCK_CAPACITY}件のみ出力します。`
      );
    }
  }
  if (kind !== "workReport") {
    const count = shipCase.materials.length;
    if (count > MATERIAL_ROW_CAPACITY) {
      messages.push(
        `材料明細 ${count}件が用紙に収まりません。先頭${MATERIAL_ROW_CAPACITY}件のみ出力します。`
      );
    }
  }
  if (messages.length === 0) return null;
  return `${messages.join("\n")}\n続行しますか？`;
}

/** 出力ボタンから呼ぶ。収まらない場合のみ確認ダイアログを出す */
export function confirmReportCapacity(
  shipCase: Pick<ShipCase, "workDayEntries" | "materials">,
  kind: ReportWorkbookKind,
  employees: string[] = []
): boolean {
  const warning = reportCapacityWarning(shipCase, kind, employees);
  if (!warning) return true;
  return window.confirm(warning);
}

export async function downloadReportWorkbook(
  shipCase: Pick<ShipCase, "basicInfo" | "workDayEntries" | "materials">,
  employees: string[],
  kind: ReportWorkbookKind,
  rates: LaborRates
): Promise<void> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) throw new Error("帳票テンプレートを読み込めませんでした");
  const buffer = await createReportWorkbookBuffer(
    await response.arrayBuffer(),
    shipCase,
    employees,
    kind,
    rates
  );
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename(kind, shipCase.basicInfo);
  a.click();
  URL.revokeObjectURL(url);
}
