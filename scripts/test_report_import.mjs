import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, copyFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const temp = await mkdtemp(join(tmpdir(), "fit-import-"));
const arrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const withoutId = ({ id, ...rest }) => { void id; return rest; };
const normalizeWork = (entries) => entries.map((entry) => ({ ...withoutId(entry), workers: [...entry.workers].sort(), blocks: entry.blocks.filter((b) => b.kind !== "break").map(withoutId) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const normalizeMaterials = (items) => items.map(withoutId).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
try {
  // 既存の検証用xlsxを変更しないよう、同じrender_sampleを隔離コピーで実行する。
  for (const path of ["scripts", "docs/verify", "public/templates"]) await mkdir(join(temp, path), { recursive: true });
  for (const path of ["node_modules", "lib"]) await symlink(join(root, path), join(temp, path), "dir");
  for (const path of ["scripts/render_sample.mjs", "scripts/sample_case.json", "public/templates/fit_report_template.xlsx"]) await copyFile(join(root, path), join(temp, path));
  execFileSync(process.execPath, ["scripts/render_sample.mjs"], { cwd: temp, stdio: "inherit", env: { ...process.env, RENDER_EMPLOYEES: "" } });
  execFileSync(join(root, "node_modules/.bin/tsc"), ["lib/reportImport.ts", "--module", "commonjs", "--target", "ES2022", "--esModuleInterop", "--skipLibCheck", "--strict", "--outDir", join(temp, "parser")], { cwd: root, stdio: "inherit" });
  const { parseWorkReportWorkbook: work, parseMaterialsWorkbook: materials } = require(join(temp, "parser/reportImport.js"));
  const { createReportWorkbook } = require(join(temp, ".tmp-report-build/reportWorkbook.js"));
  const sample = JSON.parse(await readFile(join(root, "scripts/sample_case.json"), "utf8"));
  const bytes = arrayBuffer(await readFile(join(temp, "docs/verify/sample_output.xlsx")));
  const fresh = () => new ExcelJS.Workbook().xlsx.load(bytes);
  const encoded = async (wb) => arrayBuffer(await wb.xlsx.writeBuffer());
  const ok = (result) => { assert.deepEqual(result.errors, []); return result.data; };
  await check("work round-trip: all fields except ids, entry/worker order and breaks", async () => {
    assert.deepEqual(normalizeWork(ok(await work(bytes))), normalizeWork(sample.workDayEntries));
  });
  await check("materials round-trip: exact fields with every carrier restored from first-page Z25", async () => {
    const wb = await fresh();
    const carrier = wb.getWorksheet("材料持出表").getCell("Z25").value;
    const actual = ok(await materials(bytes));
    assert.ok(actual.length > 0);
    for (const item of actual) assert.equal(item.carrier, carrier);
    const expected = sample.materials.map((m) => ({ ...m, carrier }));
    assert.deepEqual(normalizeMaterials(actual), normalizeMaterials(expected));
  });
  await check("first-page Z25 overrides continuation carriers, including an empty Z25", async () => {
    for (const carrier of ["テスト持出者", ""]) {
      const wb = await fresh();
      wb.getWorksheet("材料持出表").getCell("Z25").value = carrier;
      for (const page of [2, 3, 4]) {
        wb.getWorksheet(`材料持出表 (${page})`).getCell("Z26").value = `別のテスト持出者${page}`;
      }
      const actual = ok(await materials(await encoded(wb)));
      for (const item of actual) assert.equal(item.carrier, carrier);
      assert.deepEqual(normalizeMaterials(actual), normalizeMaterials(sample.materials.map((m) => ({ ...m, carrier }))));
    }
  });
  await check("one-cell manual edit (work and materials independently)", async () => {
    const wb = await fresh();
    wb.getWorksheet("作業報告書").getCell("W11").value = "手編集による確認";
    const expected = structuredClone(sample.workDayEntries);
    expected[0].workContent = ["手編集による確認", ...expected[0].workContent.split("\n").slice(1)].join("\n");
    assert.deepEqual(normalizeWork(ok(await work(await encoded(wb)))), normalizeWork(expected));
    const mb = await fresh();
    mb.getWorksheet("材料持出表").getCell("AB12").value = 7;
    const item = ok(await materials(await encoded(mb)))[0];
    assert.equal(item.quantity, 7); assert.equal(item.purchaseTotal, 77.27 * 7); assert.equal(item.sellingTotal, 840);
  });
  await check("append one material row in next available detail slot; ignore AJ/AS", async () => {
    const wb = await fresh(), ws = wb.getWorksheet("材料持出表 (2)");
    const values = { A: "2026-02-06", E: "追記テスト部品", M: "TEST-X", U: "✓", X: "テスト仕入先", AB: 2, AE: "袋", AF: 125, AO: 200, AX: 30 };
    for (const [col, value] of Object.entries(values)) ws.getCell(`${col}5`).value = value;
    ws.getCell("AJ5").value = { formula: "1/0", result: { error: "#DIV/0!" } };
    ws.getCell("AS5").value = 999999;
    const items = ok(await materials(await encoded(wb)));
    assert.equal(items.length, 16);
    assert.deepEqual(withoutId(items[15]), { date: "2026-02-06", productName: "追記テスト部品", modelType: "TEST-X", isStock: true, supplier: "テスト仕入先", quantity: 2, unit: "袋", purchasePrice: 125, purchaseTotal: 250, sellingPrice: 200, sellingTotal: 400, shippingFee: 30, carrier: sample.workDayEntries[0].workers[0] });
  });
  await check("reject unrelated xlsx, renamed fake sheets, broken structure and invalid bytes", async () => {
    const unrelated = new ExcelJS.Workbook(); unrelated.addWorksheet("製品マスタ").addRow(["品名", "型式", "単価"]);
    for (const parser of [work, materials]) {
      for (const input of [await encoded(unrelated), new ArrayBuffer(8)]) {
        const result = await parser(input); assert.equal(result.data.length, 0); assert.ok(result.errors.length);
      }
    }
    unrelated.getWorksheet("製品マスタ").name = "作業報告書";
    assert.ok((await work(await encoded(unrelated))).errors.length);
    const wb = await fresh(); wb.getWorksheet("作業報告書").unMergeCells("W11:CC14");
    assert.ok((await work(wb)).errors.some((e) => e.sheet === "作業報告書" && e.row === 11));
  });
  await check("collect multiple row errors without throwing or contaminating date fill", async () => {
    const wb = await fresh(), ws = wb.getWorksheet("作業報告書");
    ws.getCell("B11").value = "2026-02-30"; ws.getCell("E14").value = "bad";
    const result = await work(await encoded(wb));
    assert.ok(result.errors.some((e) => e.row === 11 && e.sheet === ws.name));
    assert.ok(result.errors.some((e) => e.row === 15));
    assert.equal(result.data[0].date, "2026-01-30");
    const ms = wb.getWorksheet("材料持出表"); ms.getCell("AB12").value = "bad"; ms.getCell("AF13").value = -1;
    const mr = await materials(await encoded(wb)); assert.deepEqual(mr.errors.map((e) => e.row), [12, 13]); assert.equal(mr.data.length, 13);
  });
  await check("all page boundaries, multiline content without times, worker union and fresh ids", async () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ id: `source-${i}`, date: `2026-03-${String(i + 1).padStart(2, "0")}`, workers: ["テスト作業者A", "テスト作業者B"], location: "テスト場所", workContent: Array.from({ length: 13 }, (_, j) => `確認${i}-${j}`).join("\n"), blocks: [{ id: `block-${i}`, kind: "regular", start: "09:00", end: "10:00" }] }));
    const ms = Array.from({ length: 82 }, (_, i) => ({ ...sample.materials[0], id: `material-${i}`, date: "2026-03-01", productName: `テスト部品${i}`, carrier: entries[0].workers[0] }));
    const template = arrayBuffer(await readFile(join(root, "public/templates/fit_report_template.xlsx")));
    const wb = await createReportWorkbook(template, { ...sample, workDayEntries: entries, materials: ms }, entries[0].workers, "all", { regular: 7000, holiday: 8400, travelFactor: 0.8 });
    const carrier = "全ページ共通のテスト持出者";
    wb.getWorksheet("材料持出表").getCell("Z25").value = carrier;
    for (const page of [2, 3, 4]) wb.getWorksheet(`材料持出表 (${page})`).getCell("Z26").value = `別のテスト持出者${page}`;
    const input = await encoded(wb);
    const actual = ok(await work(input));
    assert.deepEqual(normalizeWork(actual), normalizeWork(entries));
    const actualMaterials = ok(await materials(input));
    for (const item of actualMaterials) assert.equal(item.carrier, carrier);
    assert.deepEqual(normalizeMaterials(actualMaterials), normalizeMaterials(ms.map((m) => ({ ...m, carrier }))));
    const again = ok(await work(input)); assert.notEqual(actual[0].id, again[0].id);
    const ids = actual.flatMap((e) => [e.id, ...e.blocks.map((b) => b.id)]); assert.equal(new Set(ids).size, ids.length);
  });
  await check("same-day entry boundaries, identical content merge, internal blank lines", async () => {
    const base = { date: "2026-04-01", workers: ["テスト作業者A"], location: "テスト場所", blocks: [], id: "source" };
    const entries = [ { ...base, workContent: "確認\n\n完了" }, { ...base, workContent: "別作業" }, { ...base, workers: ["テスト作業者B"], workContent: "別作業" }, { ...base, workContent: "確認\n\n完了" } ];
    const template = arrayBuffer(await readFile(join(root, "public/templates/fit_report_template.xlsx")));
    const wb = await createReportWorkbook(template, { ...sample, workDayEntries: entries }, [], "workReport", { regular: 7000, holiday: 8400, travelFactor: 0.8 });
    const expected = [entries[0], { ...entries[1], workers: ["テスト作業者A", "テスト作業者B"] }, entries[3]];
    assert.deepEqual(normalizeWork(ok(await work(await encoded(wb)))), normalizeWork(expected));
  });
  await check("date/time strings, numeric serials, 1904 epoch, standalone materials", async () => {
    const wb = await fresh(), ws = wb.getWorksheet("作業報告書");
    ws.getCell("B11").value = "1/22"; ws.getCell("E11").value = "08:00"; ws.getCell("E14").value = 9 / 24;
    assert.deepEqual(normalizeWork(ok(await work(wb))), normalizeWork(sample.workDayEntries));
    wb.properties.date1904 = true; ws.getCell("B11").value = (Date.UTC(2026, 0, 22) - Date.UTC(1904, 0, 1)) / 86400000;
    assert.equal(ok(await work(wb))[0].date, "2026-01-22");
    const mb = arrayBuffer(await readFile(join(temp, "docs/verify/sample_materials.xlsx")));
    assert.equal(ok(await materials(mb)).length, 15);
    assert.ok((await work(mb)).errors.length);
  });
  console.log(`PASS ${passed} test groups, 0 failed (carrier restored from first-page Z25; all other comparisons unchanged)`);
} finally { await rm(temp, { recursive: true, force: true }); }
