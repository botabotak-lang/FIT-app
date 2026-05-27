import ExcelJS from "exceljs";
import type { BasicInfo, WorkDayEntry } from "./types";
import {
  WORK_REPORT_TITLE_SPACED,
  WORK_REPORT_TABLE_HEADERS,
  WORK_REPORT_EXCEL_COLS,
  workReportYearLabel,
  buildWorkReportDataRows,
  buildWorkReportBlankRows,
} from "./workReportLayout";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F0F0" },
};

const thin: ExcelJS.Border = {
  style: "thin",
  color: { argb: "FF000000" },
};

const hair: ExcelJS.Border = {
  style: "hair",
  color: { argb: "FF000000" },
};

/**
 * 罫線ヘルパー：セルの位置に応じた罫線オブジェクトを生成する。
 * 縦線ルール: A列（colIndex===0）のleft=thin、それ以外はhair。rightは常にhair。
 * @param topStyle  上辺スタイル（undefined = 設定なし）
 * @param bottomStyle 下辺スタイル
 * @param colIndex  0ベースの列インデックス（0=A列）
 */
function makeBorder(
  topStyle: ExcelJS.Border | undefined,
  bottomStyle: ExcelJS.Border,
  colIndex: number
): Partial<ExcelJS.Borders> {
  const b: Partial<ExcelJS.Borders> = {
    bottom: bottomStyle,
    left: colIndex === 0 ? thin : hair,
    right: hair,
  };
  if (topStyle) b.top = topStyle;
  return b;
}

const emptyJp = "　";

// 作業内容はH〜O列（列8〜15）をマージ
const CONTENT_COL_START = 8;
const CONTENT_COL_END = 15;

function tableHeaderValues(): string[] {
  return [
    WORK_REPORT_TABLE_HEADERS[0],
    WORK_REPORT_TABLE_HEADERS[1],
    WORK_REPORT_TABLE_HEADERS[2].replace("(平日)", "\n(平日)"),
    WORK_REPORT_TABLE_HEADERS[3].replace("(平日)", "\n(平日)"),
    WORK_REPORT_TABLE_HEADERS[4],
    WORK_REPORT_TABLE_HEADERS[5],
    WORK_REPORT_TABLE_HEADERS[6],
    `作　　業　　内　　容\n（休憩は先頭に記載）`,
  ];
}

function applyColumnWidths(ws: ExcelJS.Worksheet): void {
  WORK_REPORT_EXCEL_COLS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.wch;
  });
}

function styleTableHeaderCell(cell: ExcelJS.Cell, colIndex: number): void {
  // 行4: 上下=thin、左=A列のみthin/他はhair、右=hair
  cell.border = makeBorder(thin, thin, colIndex);
  cell.fill = HEADER_FILL;
  cell.font = { bold: true, size: 10, name: "MS PGothic", color: { argb: "FF000000" } };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: (colIndex >= 2 && colIndex <= 3) || colIndex === 7,
  };
}

/** H〜O列幅の合計から行高ポイントを推定 */
function estimateBodyRowHeightPts(
  workContent: string,
  columnWidthChars: number
): number {
  const w = Math.max(8, columnWidthChars);
  const charsPerLine = Math.max(8, Math.floor(w * 0.75));
  const parts =
    workContent.length === 0 ? [""] : workContent.split("\n");
  let displayLines = 0;
  for (const part of parts) {
    const len = part.length;
    displayLines += Math.max(1, Math.ceil(len / charsPerLine));
  }
  return Math.min(409, Math.max(18, 6 + displayLines * 13));
}

/**
 * データ行セルのスタイルを設定する。
 * @param isFirstRow データ行内の最初の行か（top罫線を省略する）
 * @param isLastRow  データ行内の最後の行か（bottom=thin にする）
 */
function styleBodyCell(
  cell: ExcelJS.Cell,
  colIndex: number,
  isFirstRow: boolean,
  isLastRow: boolean
): void {
  // 最初の行はtop罫線なし（行4のbottom=thinと境界を共用）
  // 最終行はbottom=thin、それ以外はhair
  const topStyle = isFirstRow ? undefined : hair;
  const bottomStyle = isLastRow ? thin : hair;
  cell.border = makeBorder(topStyle, bottomStyle, colIndex);

  cell.font = { size: 10, name: "MS PGothic", color: { argb: "FF000000" } };
  const wrapCols = [1, 2, 3, 4, 5];
  const centerCols = [0, 1, 2, 3, 4, 5, 6];
  if (centerCols.includes(colIndex)) {
    cell.alignment = {
      horizontal: "center",
      vertical: "top",
      wrapText: wrapCols.includes(colIndex),
    };
  } else {
    cell.alignment = {
      horizontal: "left",
      vertical: "top",
      wrapText: true,
    };
  }
}

/**
 * 作業報告1枚目を、印刷レイアウトに近い罫線・フォントで Excel 出力する。
 * A〜O列15列構造。H〜O列（8列）を作業内容のマージセルとして使用。
 */
export async function downloadWorkReportExcel(
  basicInfo: BasicInfo,
  sortedEntries: WorkDayEntry[]
): Promise<void> {
  const year = workReportYearLabel(basicInfo);
  const dataRows = buildWorkReportDataRows(sortedEntries);
  const blankRows = buildWorkReportBlankRows(sortedEntries.length);
  const bodyRows = [...dataRows, ...blankRows];

  const wb = new ExcelJS.Workbook();
  wb.creator = "FIT ship-repair-app";
  const ws = wb.addWorksheet("作業報告1枚目", {
    views: [{ showGridLines: false }],
  });

  applyColumnWidths(ws);

  const TITLE_ROW = 1;
  const INFO_LABEL_ROW = 2;
  const INFO_VALUE_ROW = 3;
  const TABLE_HEADER_ROW = 4;
  const DATA_START_ROW = 5;

  // ── 行1: タイトル行 ─────────────────────────────
  // A〜N列: 修理作業報告書（罫線なし）
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, 14);
  const titleCell = ws.getCell(TITLE_ROW, 1);
  titleCell.value = WORK_REPORT_TITLE_SPACED;
  titleCell.font = { bold: true, size: 20, name: "MS PGothic" };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  // 罫線なし（③対応）

  // O列: 令和8年（太文字、罫線なし）
  const yearCell = ws.getCell(TITLE_ROW, 15);
  yearCell.value = year;
  yearCell.font = { bold: true, size: 12, name: "MS PGothic" };
  yearCell.alignment = { horizontal: "right", vertical: "middle" };
  // 罫線なし（③対応）

  ws.getRow(TITLE_ROW).height = 28;

  const ship = basicInfo.shipName || emptyJp;
  const category = basicInfo.category || emptyJp;
  const model = basicInfo.modelName || emptyJp;
  const manufacturer = basicInfo.manufacturer || emptyJp;

  const labelFont: Partial<ExcelJS.Font> = {
    size: 10,
    color: { argb: "FF555555" },
    name: "MS PGothic",
  };
  const labelAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
  };
  const valueFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 12,
    name: "MS PGothic",
  };
  const valueAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
  };

  // ── 行2: 情報ラベル行（上辺=thin、下辺=hair）─────────
  // A-B: 船名（A列のため left=thin）
  ws.mergeCells(INFO_LABEL_ROW, 1, INFO_LABEL_ROW, 2);
  const shipLabel = ws.getCell(INFO_LABEL_ROW, 1);
  shipLabel.value = "船名";
  shipLabel.font = labelFont;
  shipLabel.alignment = labelAlign;
  shipLabel.border = makeBorder(thin, hair, 0); // colIndex=0 → A列

  // C-G: 科目
  ws.mergeCells(INFO_LABEL_ROW, 3, INFO_LABEL_ROW, 7);
  const catLabel = ws.getCell(INFO_LABEL_ROW, 3);
  catLabel.value = "科目";
  catLabel.font = labelFont;
  catLabel.alignment = labelAlign;
  catLabel.border = makeBorder(thin, hair, 1); // colIndex≠0 → left=hair

  // H-L: 型名
  ws.mergeCells(INFO_LABEL_ROW, 8, INFO_LABEL_ROW, 12);
  const modelLabel = ws.getCell(INFO_LABEL_ROW, 8);
  modelLabel.value = "型名";
  modelLabel.font = labelFont;
  modelLabel.alignment = labelAlign;
  modelLabel.border = makeBorder(thin, hair, 1);

  // M-O: 製造者
  ws.mergeCells(INFO_LABEL_ROW, 13, INFO_LABEL_ROW, 15);
  const mfgLabel = ws.getCell(INFO_LABEL_ROW, 13);
  mfgLabel.value = "製造者";
  mfgLabel.font = labelFont;
  mfgLabel.alignment = labelAlign;
  mfgLabel.border = makeBorder(thin, hair, 1);

  // ── 行3: 情報値行（上辺=hair、下辺=thin）─────────────
  ws.mergeCells(INFO_VALUE_ROW, 1, INFO_VALUE_ROW, 2);
  const shipVal = ws.getCell(INFO_VALUE_ROW, 1);
  shipVal.value = ship;
  shipVal.font = valueFont;
  shipVal.alignment = valueAlign;
  shipVal.border = makeBorder(hair, thin, 0); // A列

  ws.mergeCells(INFO_VALUE_ROW, 3, INFO_VALUE_ROW, 7);
  const catVal = ws.getCell(INFO_VALUE_ROW, 3);
  catVal.value = category;
  catVal.font = valueFont;
  catVal.alignment = valueAlign;
  catVal.border = makeBorder(hair, thin, 1);

  ws.mergeCells(INFO_VALUE_ROW, 8, INFO_VALUE_ROW, 12);
  const modelVal = ws.getCell(INFO_VALUE_ROW, 8);
  modelVal.value = model;
  modelVal.font = valueFont;
  modelVal.alignment = valueAlign;
  modelVal.border = makeBorder(hair, thin, 1);

  ws.mergeCells(INFO_VALUE_ROW, 13, INFO_VALUE_ROW, 15);
  const mfgVal = ws.getCell(INFO_VALUE_ROW, 13);
  mfgVal.value = manufacturer;
  mfgVal.font = valueFont;
  mfgVal.alignment = valueAlign;
  mfgVal.border = makeBorder(hair, thin, 1);

  ws.getRow(INFO_LABEL_ROW).height = 18;
  ws.getRow(INFO_VALUE_ROW).height = 22;

  // ── 行4: テーブルヘッダー行 ──────────────────────
  const headers = tableHeaderValues();
  // A〜G列: 個別ヘッダー
  for (let i = 0; i < 7; i++) {
    const cell = ws.getCell(TABLE_HEADER_ROW, i + 1);
    cell.value = headers[i];
    styleTableHeaderCell(cell, i);
  }
  // H〜O列: 作業内容（マージセル）
  ws.mergeCells(TABLE_HEADER_ROW, CONTENT_COL_START, TABLE_HEADER_ROW, CONTENT_COL_END);
  const contentHeaderCell = ws.getCell(TABLE_HEADER_ROW, CONTENT_COL_START);
  contentHeaderCell.value = headers[7];
  styleTableHeaderCell(contentHeaderCell, 7);

  ws.getRow(TABLE_HEADER_ROW).height = 36;

  // H〜O列の合計幅（行高推定用）: 80px × 8列 → 10.71 × 8 ≈ 85.71
  const contentColTotalWidth = 10.71 * 8;

  // ── 行5以降: データ行 ───────────────────────────
  bodyRows.forEach((row, ri) => {
    const r = DATA_START_ROW + ri;
    const isFirstRow = ri === 0;
    const isLastRow = ri === bodyRows.length - 1;

    // A〜G列: 7列分のデータ
    for (let ci = 0; ci < 7; ci++) {
      const cell = ws.getCell(r, ci + 1);
      cell.value = row[ci];
      styleBodyCell(cell, ci, isFirstRow, isLastRow);
    }
    // H〜O列: 作業内容（マージセル）colIndex=7（H列相当）→ left=hair
    ws.mergeCells(r, CONTENT_COL_START, r, CONTENT_COL_END);
    const contentCell = ws.getCell(r, CONTENT_COL_START);
    contentCell.value = row[7] ?? "";
    styleBodyCell(contentCell, 7, isFirstRow, isLastRow);

    const workContent = String(row[7] ?? "");
    const isBlankRow = row.every((c) => c === "");
    ws.getRow(r).height = isBlankRow
      ? 18
      : estimateBodyRowHeightPts(workContent, contentColTotalWidth);
  });

  // 印刷設定: 横向き・白黒・2ページ目以降もヘッダー行(4行目)を繰り返す
  ws.pageSetup.paperSize = 9; // A4
  ws.pageSetup.orientation = "landscape";
  ws.pageSetup.blackAndWhite = true;
  ws.pageSetup.printTitlesRow = "4:4"; // ②④: "$4:$4" だとExcelJSが不正なdefinedNameを生成するため修正
  ws.pageSetup.fitToPage = false;
  ws.pageSetup.margins = {
    top: 0.354, bottom: 0.354,
    left: 0.512, right: 0.512,
    header: 0.2, footer: 0.2,
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeShip = (basicInfo.shipName || "案件").replace(/[/\\?*[\]:]/g, "_");
  const filename = `修理作業報告1枚目_${safeShip}_${stamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
