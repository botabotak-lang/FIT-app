import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const buildDir = join(root, ".tmp-report-build");
execFileSync(
  join(root, "node_modules/.bin/tsc"),
  [
    "lib/reportWorkbook.ts",
    "lib/reportBlocks.ts",
    "lib/workReportLayout.ts",
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
const { createReportWorkbookBuffer } = require(join(buildDir, "reportWorkbook.js"));
const sample = JSON.parse(await readFile(join(root, "scripts/sample_case.json"), "utf8"));
const template = await readFile(join(root, "public/templates/fit_report_template.xlsx"));
// 本番の社員マスタ（sort_order順）。5枠目以降の検証用にテスト社員を足せるようにしてある
const MASTER_EMPLOYEES = ["豊島", "鈴木", "大竹", "木内"];
const EXTRA_EMPLOYEES = ["テスト5", "テスト6", "テスト7"];
const ALL_EMPLOYEES = [...MASTER_EMPLOYEES, ...EXTRA_EMPLOYEES];

/** 人数指定：`--employees=6` または環境変数 RENDER_EMPLOYEES=6 */
function requestedCount() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--employees"));
  const raw = arg ? arg.split("=")[1] : process.env.RENDER_EMPLOYEES;
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > ALL_EMPLOYEES.length) {
    throw new Error(`--employees は 1〜${ALL_EMPLOYEES.length} で指定してください: ${raw}`);
  }
  return n;
}

// app_settings を読めない環境なので既定値を直接渡す（lib/laborRates.ts の DEFAULT_LABOR_RATES と同じ）
const rates = { regular: 7000, holiday: 8400, travelFactor: 0.8 };
const templateBuffer = () =>
  template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength);

const count = requestedCount();
const outputs = count
  ? [[count, "all", `docs/verify/sample_output_${count}workers.xlsx`]]
  : [
      [MASTER_EMPLOYEES.length, "all", "docs/verify/sample_output.xlsx"],
      [MASTER_EMPLOYEES.length, "materials", "docs/verify/sample_materials.xlsx"],
      // 6名（テンプレートの5枠を超える）ときに6枠目が生成されることの検証用
      [6, "all", "docs/verify/sample_output_6workers.xlsx"],
    ];

for (const [n, kind, dest] of outputs) {
  const employees = ALL_EMPLOYEES.slice(0, n);
  const buffer = await createReportWorkbookBuffer(templateBuffer(), sample, employees, kind, rates);
  await writeFile(join(root, dest), Buffer.from(buffer));
  console.log(`created ${dest} (${kind}, ${n}名: ${employees.join("・")})`);
}
