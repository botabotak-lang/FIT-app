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
const employees = ["大竹", "豊島", "鈴木", "木内"];
// app_settings を読めない環境なので既定値を直接渡す（lib/laborRates.ts の DEFAULT_LABOR_RATES と同じ）
const rates = { regular: 7000, holiday: 8400, travelFactor: 0.8 };
const templateBuffer = () =>
  template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength);

const outputs = [
  ["all", "docs/verify/sample_output.xlsx"],
  ["materials", "docs/verify/sample_materials.xlsx"],
];

for (const [kind, dest] of outputs) {
  const buffer = await createReportWorkbookBuffer(templateBuffer(), sample, employees, kind, rates);
  await writeFile(join(root, dest), Buffer.from(buffer));
  console.log(`created ${dest}`);
}
