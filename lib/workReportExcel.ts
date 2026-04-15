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

const borderAll: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

const emptyJp = "　";

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

/** 印刷用 HTML に近い見出しセル（改行・折り返し） */
function styleTableHeaderCell(cell: ExcelJS.Cell, colIndex: number): void {
  cell.border = borderAll;
  cell.fill = HEADER_FILL;
  cell.font = { bold: true, size: 10, name: "Yu Gothic", color: { argb: "FF000000" } };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: (colIndex >= 2 && colIndex <= 3) || colIndex === 7,
  };
}

function styleBodyCell(cell: ExcelJS.Cell, colIndex: number): void {
  cell.border = {
    top: thin,
    left: thin,
    bottom: thin,
    right: thin,
  };
  cell.font = { size: 10, name: "Yu Gothic", color: { argb: "FF000000" } };
  const centerCols = [0, 1, 2, 3, 4, 5, 6];
  if (centerCols.includes(colIndex)) {
    cell.alignment = {
      horizontal: "center",
      vertical: "top",
      wrapText: false,
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

  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, 7);
  const titleCell = ws.getCell(TITLE_ROW, 1);
  titleCell.value = WORK_REPORT_TITLE_SPACED;
  titleCell.font = { bold: true, size: 20, name: "Yu Gothic" };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = borderAll;

  const yearCell = ws.getCell(TITLE_ROW, 8);
  yearCell.value = year;
  yearCell.font = { size: 12, name: "Yu Gothic" };
  yearCell.alignment = { horizontal: "right", vertical: "middle" };
  yearCell.border = borderAll;

  ws.getRow(TITLE_ROW).height = 28;

  const ship = basicInfo.shipName || emptyJp;
  const category = basicInfo.category || emptyJp;
  const model = basicInfo.modelName || emptyJp;
  const manufacturer = basicInfo.manufacturer || emptyJp;

  const labelFont: Partial<ExcelJS.Font> = {
    size: 10,
    color: { argb: "FF555555" },
    name: "Yu Gothic",
  };
  const labelAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
  };
  const valueFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 12,
    name: "Yu Gothic",
  };
  const valueAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
  };

  ws.mergeCells(INFO_LABEL_ROW, 1, INFO_LABEL_ROW, 2);
  const shipLabel = ws.getCell(INFO_LABEL_ROW, 1);
  shipLabel.value = "船名";
  shipLabel.font = labelFont;
  shipLabel.alignment = labelAlign;
  shipLabel.border = borderAll;

  ws.mergeCells(INFO_LABEL_ROW, 3, INFO_LABEL_ROW, 4);
  const catLabel = ws.getCell(INFO_LABEL_ROW, 3);
  catLabel.value = "科目";
  catLabel.font = labelFont;
  catLabel.alignment = labelAlign;
  catLabel.border = borderAll;

  ws.mergeCells(INFO_LABEL_ROW, 5, INFO_LABEL_ROW, 6);
  const modelLabel = ws.getCell(INFO_LABEL_ROW, 5);
  modelLabel.value = "型名";
  modelLabel.font = labelFont;
  modelLabel.alignment = labelAlign;
  modelLabel.border = borderAll;

  ws.mergeCells(INFO_LABEL_ROW, 7, INFO_LABEL_ROW, 8);
  const mfgLabel = ws.getCell(INFO_LABEL_ROW, 7);
  mfgLabel.value = "製造者";
  mfgLabel.font = labelFont;
  mfgLabel.alignment = labelAlign;
  mfgLabel.border = borderAll;

  ws.mergeCells(INFO_VALUE_ROW, 1, INFO_VALUE_ROW, 2);
  const shipVal = ws.getCell(INFO_VALUE_ROW, 1);
  shipVal.value = ship;
  shipVal.font = valueFont;
  shipVal.alignment = valueAlign;
  shipVal.border = borderAll;

  ws.mergeCells(INFO_VALUE_ROW, 3, INFO_VALUE_ROW, 4);
  const catVal = ws.getCell(INFO_VALUE_ROW, 3);
  catVal.value = category;
  catVal.font = valueFont;
  catVal.alignment = valueAlign;
  catVal.border = borderAll;

  ws.mergeCells(INFO_VALUE_ROW, 5, INFO_VALUE_ROW, 6);
  const modelVal = ws.getCell(INFO_VALUE_ROW, 5);
  modelVal.value = model;
  modelVal.font = valueFont;
  modelVal.alignment = valueAlign;
  modelVal.border = borderAll;

  ws.mergeCells(INFO_VALUE_ROW, 7, INFO_VALUE_ROW, 8);
  const mfgVal = ws.getCell(INFO_VALUE_ROW, 7);
  mfgVal.value = manufacturer;
  mfgVal.font = valueFont;
  mfgVal.alignment = valueAlign;
  mfgVal.border = borderAll;

  ws.getRow(INFO_LABEL_ROW).height = 18;
  ws.getRow(INFO_VALUE_ROW).height = 22;

  const headers = tableHeaderValues();
  headers.forEach((text, i) => {
    const cell = ws.getCell(TABLE_HEADER_ROW, i + 1);
    cell.value = text;
    styleTableHeaderCell(cell, i);
  });
  ws.getRow(TABLE_HEADER_ROW).height = 36;

  bodyRows.forEach((row, ri) => {
    const r = DATA_START_ROW + ri;
    row.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val;
      styleBodyCell(cell, ci);
    });
    ws.getRow(r).height = 18;
  });

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
