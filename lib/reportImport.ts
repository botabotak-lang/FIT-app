import ExcelJS from "exceljs";
import type { Material, TimeBlock, WorkDayEntry } from "./types";

export type ReportImportError = { row: number; sheet: string; reason: string };
/** row=0 / sheet="" はファイル全体のエラー。errors があれば UI では反映しない。 */
export type ReportImportResult<T> = { data: T[]; errors: ReportImportError[] };

const workSheets = ["作業報告書", ...["2", "3", "4", "5", "END"].map((n) => `作業報告書 (${n})`)];
const materialSheets = ["材料持出表", ...[2, 3, 4].map((n) => `材料持出表 (${n})`)];
const timeColumns = { E: "travel", H: "regular", K: "overtime", N: "holiday" } as const;
const materialColumns = ["A", "E", "M", "U", "X", "AB", "AE", "AF", "AO", "AX"];
const blank = (v: ExcelJS.CellValue) => v == null || v === "";
const reason = (e: unknown) => e instanceof Error ? e.message : "読み取れませんでした";
const id = () => globalThis.crypto.randomUUID();

function text(v: ExcelJS.CellValue): string {
  if (blank(v)) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v && "richText" in v) return v.richText.map((p) => p.text).join("");
  throw new Error("文字列セルに未対応の値・数式があります");
}

function date(v: ExcelJS.CellValue, date1904: boolean, year?: number): string {
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) throw new Error("日付が不正です");
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return date(new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + Math.floor(v) * 86400000), date1904);
  }
  const s = text(v).normalize("NFKC").trim();
  const match = s.match(/^(?:(\d{4})[-/年])?(\d{1,2})[-/月](\d{1,2})日?$/);
  if (!match || (!match[1] && !year)) throw new Error("日付が不正、または年を特定できません");
  const y = Number(match[1] || year), m = Number(match[2]), d = Number(match[3]);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 9999 || parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) throw new Error("存在しない日付です");
  return parsed.toISOString().slice(0, 10);
}

function time(v: ExcelJS.CellValue): string {
  let minutes: number;
  if (v instanceof Date && Number.isFinite(v.getTime())) {
    minutes = v.getUTCHours() * 60 + v.getUTCMinutes();
  } else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) {
    minutes = Math.round(v * 1440);
  } else {
    const match = text(v).normalize("NFKC").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match || Number(match[1]) > 24 || Number(match[2]) > 59 || (Number(match[1]) === 24 && Number(match[2]) !== 0)) throw new Error("時刻が不正です");
    minutes = Number(match[1]) * 60 + Number(match[2]);
  }
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function number(v: ExcelJS.CellValue): number {
  if (blank(v)) return 0;
  const s = typeof v === "number" ? String(v) : text(v).normalize("NFKC").trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)) throw new Error("数値が不正です");
  const result = Number(s.replaceAll(",", ""));
  if (!Number.isFinite(result) || result < 0) throw new Error("数値は有限の非負数にしてください");
  return result;
}

function starts(first: boolean): number[] {
  return [...Array.from({ length: first ? 14 : 16 }, (_, i) => (first ? 11 : 4) + i * 4),
    ...Array.from({ length: 16 }, (_, i) => (first ? 70 : 71) + i * 4)];
}

function validate(wb: ExcelJS.Workbook, materials: boolean): ReportImportError[] {
  const errors: ReportImportError[] = [];
  const names = materials ? materialSheets : workSheets;
  if (!wb.getWorksheet(names[0])) return [{ row: 0, sheet: "", reason: "読み取れませんでした：対象の帳票シートがありません" }];
  for (const [index, name] of names.entries()) {
    const ws = wb.getWorksheet(name);
    if (!ws) { errors.push({ row: 0, sheet: name, reason: "読み取れませんでした：帳票の続きシートがありません" }); continue; }
    const headers = materials ? [index === 0 ? 11 : 2] : index === 0 ? [9, 68] : [2, 69];
    const expected = materials
      ? { A: "月/日", E: "品名", M: "型式", U: "在庫", X: "仕入先", AB: "数量", AF: "仕入単価", AO: "売値単価", AX: "送料" }
      : { B: "月/日", E: "移動", H: "作業内(平日)", K: "作業外(平日)", N: "休日", Q: "作業者", T: "場所", W: "作業内容" };
    for (const row of headers) {
      try {
        for (const [col, label] of Object.entries(expected)) {
          if (text(ws.getCell(`${col}${row}`).value).normalize("NFKC").replace(/\s/g, "") !== label) throw new Error("読み取れませんでした：帳票の見出し・行配置が異なります");
        }
      } catch (e) { errors.push({ row, sheet: name, reason: reason(e) }); }
    }
    // 結合を失ったり、明細行を挿入して固定枠がずれたブックも拒否する。
    const rows = materials ? Array.from({ length: index === 0 ? 13 : 23 }, (_, i) => (index === 0 ? 12 : 3) + i) : starts(index === 0);
    for (const row of rows) {
      const anchor = `${materials ? "E" : "W"}${row}`;
      const end = `${materials ? "L" : "CC"}${materials ? row : row + 3}`;
      if (ws.getCell(end).master.address !== anchor) errors.push({ row, sheet: name, reason: "読み取れませんでした：明細の結合・行配置が異なります" });
    }
  }
  return errors;
}

function yearHint(wb: ExcelJS.Workbook): number | undefined {
  const label = text(wb.getWorksheet(workSheets[0])?.getCell("BU2").value ?? null).normalize("NFKC").replace(/\s/g, "");
  const match = label.match(/令和(\d+)年/);
  if (match) return 2018 + Number(match[1]);
  const completion = wb.getWorksheet(materialSheets[0])?.getCell("AX1").value;
  return blank(completion ?? null) ? undefined : Number(date(completion ?? null, !!wb.properties.date1904).slice(0, 4));
}

async function parse<T>(input: ArrayBuffer | ExcelJS.Workbook, materials: boolean, read: (wb: ExcelJS.Workbook, result: ReportImportResult<T>) => void): Promise<ReportImportResult<T>> {
  const result: ReportImportResult<T> = { data: [], errors: [] };
  try {
    const wb = input instanceof ExcelJS.Workbook ? input : await new ExcelJS.Workbook().xlsx.load(input);
    result.errors = validate(wb, materials);
    if (!result.errors.length) read(wb, result);
  } catch (e) { result.errors.push({ row: 0, sheet: "", reason: `読み取れませんでした：${reason(e)}` }); }
  return result;
}

/**
 * ArrayBuffer または読み込み済み Workbook を受け、元ブックを変更しない。
 * 作業者単位の連続行を復元後、隣接する (日付, 場所, 全文) を統合する。
 * 出力で埋められた末尾空行と元の末尾改行は区別できないため末尾空行を除く。
 */
export async function parseWorkReportWorkbook(input: ArrayBuffer | ExcelJS.Workbook): Promise<ReportImportResult<WorkDayEntry>> {
  return parse(input, false, (wb, result) => {
    let previousDate = "";
    let group: { entry: WorkDayEntry; worker: string; lines: string[] } | undefined;
    let adjacent = false;
    const year = yearHint(wb);
    const flush = () => {
      if (!group) return;
      while (group.lines.length && group.lines[group.lines.length - 1] === "") group.lines.pop();
      group.entry.workContent = group.lines.join("\n");
      const entry = group.entry;
      const last = adjacent ? result.data[result.data.length - 1] : undefined;
      if (last && last.date === entry.date && last.location === entry.location && last.workContent === entry.workContent) {
        last.workers = [...new Set([...last.workers, ...entry.workers])];
        // 作業者別複製の時間は重複計上しない。同じ作業者内の重複は保持。
        const seen = new Set(last.blocks.map((b) => JSON.stringify([b.kind, b.start, b.end])));
        last.blocks.push(...entry.blocks.filter((b) => !seen.has(JSON.stringify([b.kind, b.start, b.end]))));
      } else result.data.push(entry);
      group = undefined;
      adjacent = true;
    };
    for (const [index, name] of workSheets.entries()) {
      const ws = wb.getWorksheet(name)!;
      for (const row of starts(index === 0)) {
        const get = (col: string, offset = 0) => ws.getCell(`${col}${row + offset}`).value;
        const rawDate = get("B");
        try {
          if (["B", "Q", "T", "W", ...Object.keys(timeColumns)].every((col) => blank(get(col))) && Object.keys(timeColumns).every((col) => blank(get(col, 3)))) { flush(); adjacent = false; continue; }
          if (!blank(rawDate)) previousDate = date(rawDate, !!wb.properties.date1904, year);
          if (!previousDate) throw new Error("日付がなく前方補完できません");
          const worker = text(get("Q")), location = text(get("T")), content = text(get("W"));
          const blocks: TimeBlock[] = [];
          for (const [col, kind] of Object.entries(timeColumns)) {
            if (blank(get(col)) && blank(get(col, 3))) continue;
            if (blank(get(col)) || blank(get(col, 3))) throw new Error(`${col}列の開始・終了時刻が片方ありません`);
            blocks.push({ id: id(), kind, start: time(get(col)), end: time(get(col, 3)) });
          }
          if (group && (!blank(rawDate) || group.worker !== worker || group.entry.location !== location || group.entry.date !== previousDate)) flush();
          if (!group) group = { worker, lines: [], entry: { id: id(), date: previousDate, workers: worker ? [worker] : [], location, workContent: "", blocks: [] } };
          group.lines.push(content);
          group.entry.blocks.push(...blocks);
        } catch (e) {
          flush(); adjacent = false;
          if (!blank(rawDate)) previousDate = "";
          result.errors.push({ row, sheet: name, reason: reason(e) });
        }
      }
    }
    flush();
  });
}

/** 明細の合計は数量×単価で復元。carrier は全明細で1ページ目 Z25 の持出者を復元。 */
export async function parseMaterialsWorkbook(input: ArrayBuffer | ExcelJS.Workbook): Promise<ReportImportResult<Material>> {
  return parse(input, true, (wb, result) => {
    const year = yearHint(wb);
    for (const [index, name] of materialSheets.entries()) {
      const ws = wb.getWorksheet(name)!;
      const first = index === 0;
      for (let row = first ? 12 : 3; row <= (first ? 24 : 25); row++) {
        const get = (col: string) => ws.getCell(`${col}${row}`).value;
        if (materialColumns.every((col) => blank(get(col)))) continue;
        try {
          const productName = text(get("E"));
          if (!productName.trim()) throw new Error("品名がありません");
          const stock = text(get("U")).trim();
          if (stock && stock !== "✓") throw new Error("在庫欄は空欄または✓にしてください");
          const quantity = number(get("AB")), purchasePrice = number(get("AF")), sellingPrice = number(get("AO"));
          const purchaseTotal = quantity * purchasePrice, sellingTotal = quantity * sellingPrice;
          if (!Number.isFinite(purchaseTotal) || !Number.isFinite(sellingTotal)) throw new Error("合計が数値の範囲を超えています");
          result.data.push({ id: id(), date: blank(get("A")) ? "" : date(get("A"), !!wb.properties.date1904, year), productName,
            modelType: text(get("M")), isStock: stock === "✓", supplier: text(get("X")), quantity, unit: text(get("AE")),
            purchasePrice, purchaseTotal, sellingPrice, sellingTotal, shippingFee: number(get("AX")), carrier: text(wb.getWorksheet(materialSheets[0])!.getCell("Z25").value) });
        } catch (e) { result.errors.push({ row, sheet: name, reason: reason(e) }); }
      }
    }
  });
}
