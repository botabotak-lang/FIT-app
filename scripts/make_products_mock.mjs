/**
 * 製品マスタ画面（/products）の検証用モックを生成する。
 *
 * 使い方:
 *   node scripts/make_products_mock.mjs "<製品マスタ.xlsx>"
 *   NEXT_PUBLIC_PRODUCTS_MOCK=1 npm run dev
 *
 * dry_run_import.mjs と同じ解析（lib/importProducts.ts）で読み、
 * public/mock/products.json に Product 形式の配列を書き出す。
 * **DB には一切書き込まない**。出力先は .gitignore 済み（コミットしない）。
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const buildDir = join(root, ".tmp-import-build");
const outPath = join(root, "public", "mock", "products.json");

/** 何件かを「無効」にしておく（状態フィルタの検証用） */
const INACTIVE_EVERY = 100;

const filePath = process.argv[2];
if (!filePath) {
  console.error('使い方: node scripts/make_products_mock.mjs "<製品マスタ.xlsx>"');
  process.exit(1);
}

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
const { parseWorkbook, dedupeRows } = require(join(buildDir, "importProducts.js"));

const absolutePath = resolve(process.cwd(), filePath);
const workbook = XLSX.read(await readFile(absolutePath), { type: "buffer" });
const parsed = parseWorkbook(workbook).filter((r) => !r.error);
const { rows } = dedupeRows(parsed);

// 更新日は品名順とわざとずらす（「更新日の新しい順」を検証できるように）
const baseTime = Date.parse("2026-08-30T09:00:00Z");
const products = rows.map((row, i) => {
  const updatedAt = new Date(baseTime - ((i * 37) % rows.length) * 3600_000).toISOString();
  return {
    id: `mock-${String(i + 1).padStart(4, "0")}`,
    name: row.name,
    modelType: row.modelType,
    supplier: row.supplier,
    unit: row.unit ?? "",
    purchasePrice: row.purchasePrice,
    sellingPrice: row.sellingPrice,
    notes: row.notes ?? "",
    isActive: i % INACTIVE_EVERY !== 7,
    createdAt: new Date(baseTime - 30 * 24 * 3600_000).toISOString(),
    updatedAt,
  };
});

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(products, null, 0), "utf8");

const inactive = products.filter((p) => !p.isActive).length;
const unpriced = products.filter((p) => !(p.sellingPrice > 0)).length;
console.log(`=== 検証用モックを生成しました（DBには書き込みません）===`);
console.log(`出力     : ${outPath}`);
console.log(`件数     : ${products.length}件（無効 ${inactive}件 / 売値未設定 ${unpriced}件）`);
console.log(`使い方   : NEXT_PUBLIC_PRODUCTS_MOCK=1 npm run dev`);
