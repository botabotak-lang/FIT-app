/**
 * 製品マスタ Excel の取込ドライラン。
 *
 * 使い方:
 *   node scripts/dry_run_import.mjs "<製品マスタ.xlsx>"
 *
 * ImportDialog と同じ解析ロジック（lib/importProducts.ts）で読み、
 * 取り込み結果の内訳だけを標準出力に出す。**DB には一切書き込まない**。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const buildDir = join(root, ".tmp-import-build");

const filePath = process.argv[2];
if (!filePath) {
  console.error('使い方: node scripts/dry_run_import.mjs "<製品マスタ.xlsx>"');
  process.exit(1);
}

// lib/importProducts.ts をそのまま使うため、CommonJS に落としてから require する
execFileSync(
  join(root, "node_modules/.bin/tsc"),
  [
    "lib/importProducts.ts",
    "lib/types.ts",
    "--module",
    "commonjs",
    "--target",
    "ES2022",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir",
    buildDir,
  ],
  { cwd: root, stdio: "inherit" }
);

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { parseWorkbook, summarizeRows } = require(join(buildDir, "importProducts.js"));

const absolutePath = resolve(process.cwd(), filePath);
const buffer = await readFile(absolutePath);
const workbook = XLSX.read(buffer, { type: "buffer" });

const rows = parseWorkbook(workbook);
const summary = summarizeRows(rows);

const sorted = (record) => Object.entries(record).sort((a, b) => b[1] - a[1]);
const line = (label, value) => console.log(`${label.padEnd(22, "　")}${value}`);

console.log("=== 製品マスタ 取込ドライラン（DBには書き込みません） ===");
console.log(`ファイル: ${absolutePath}`);
console.log(`シート  : ${workbook.SheetNames.length}件（うち記入例シートは除外）`);
console.log("");

line("総行数", `${summary.totalRows}件`);
line("有効（登録対象）", `${summary.validRows}件`);
line("重複でまとめた件数", `${summary.merged}件`);
line("エラー（スキップ）", `${summary.errorRows}件`);
line("小数の仕入値", `${summary.decimalPurchaseCount}件（全解析行）`);
console.log("");

console.log("--- エラー理由別 ---");
if (summary.errorRows === 0) {
  console.log("なし");
} else {
  for (const [reason, count] of sorted(summary.errorReasons)) {
    console.log(`  ${reason}: ${count}件`);
  }
  console.log("  （先頭10件）");
  for (const row of rows.filter((r) => r.error).slice(0, 10)) {
    console.log(
      `   [${row.sheetName} ${row.rowNumber}行目] ${row.name || "（品名なし）"} — ${row.error}`
    );
  }
}
console.log("");

console.log("--- 仕入先内訳（全解析行・正規化後）---");
for (const [supplier, count] of sorted(summary.supplierCounts)) {
  console.log(`  ${supplier}: ${count}件`);
}
console.log("");

console.log("--- シート別の解析行数 ---");
for (const [sheet, count] of Object.entries(summary.sheetCounts)) {
  console.log(`  ${sheet}: ${count}件`);
}
