# Phase B 実装指示：原本様式どおりのExcel帳票出力（作業報告書＋材料持出表）

作業ディレクトリ（絶対パス）：`/Users/kubotakeisuke/Projects/ClaudeCode/FIT/apps/ship-repair-app`
必読：`docs/改修要件定義書_v1.0_20260830.md` §3・§4（仕様の正本）、原本 `docs/reference/FIT様式_作業報告書_材料持出表_原本20260829.xlsx`

## ゴール
アプリの案件データ（`ShipCase`）から、大竹氏の原本Excelと**同じ見た目・同じシート構成**の .xlsx をブラウザで生成してダウンロードできるようにする。

## 方針（必ず守る）
1. **テンプレート方式**：原本 .xlsx からデータだけ消した `public/templates/fit_report_template.xlsx` を作り、ExcelJS（既に依存に入っている `exceljs@4`）で `fetch` → `workbook.xlsx.load(arrayBuffer)` → セルに値を書く → `writeBuffer` → ダウンロード。結合セル・罫線・列幅・行高・印刷範囲・入力規則・数式はテンプレートのものを使い、コードで再構築しない
2. テンプレート作成は Python（openpyxl）スクリプト `scripts/make_template.py` で行い、リポジトリに残す（再生成できるように）。消すもの：作業報告書系シートの行5の値（C5/Y5/BB5/製造者）、行11〜133（2ページ目以降は行4〜134）の B/E/H/K/N/Q/T/W 列の入力値（「～」と数式は残す）、材料持出表系シートの行1の値、行3〜9の氏名(A列)・備考(AU列)（数式は残す）、明細行（1ページ目 行12〜24、2ページ目以降 行3〜25）の入力値（AJ/AS の数式は残す）、持出者（Z25 / Z26）。行27以降の入力規則リストは残す
3. 生成後のファイルは openpyxl で読み戻し、原本と「シート名一覧・結合セル数・印刷範囲・行高（行11〜14）・列幅（B〜CC）・CJ11/CJ138/M3/AJ12 の数式」が一致することを `scripts/verify_template.py` で確認し、結果を `docs/verify/PhaseB_検証結果.md` に書く
4. ExcelJS の load/save で欠落する属性があれば（入力規則・印刷タイトル等）、欠落した項目を検証結果に明記し、コードで補える物は補う（例：`ws.dataValidations`、`ws.pageSetup.printArea`）

## 出力仕様
### 共通
- 新規モジュール `lib/reportWorkbook.ts`（テンプレート読込・書込の中核）、`lib/reportBlocks.ts`（ShipCase → 出力ブロック列への変換。純関数・単体テスト可能に）
- 年号：受付日から `令和X年`（既存 `workReportYearLabel` を流用）
- 作業者名は社員マスタ（`getActiveEmployees()`・sort_order順）を使う。テンプレートの集計列（CF/CP/CZ/DJ/DT ＝ 5枠）の作業者名と `=IF(Q11="大竹",…)` 数式、行137〜141の作業者名リスト、材料持出表 行3〜7 の氏名と `=SUM('作業報告書:作業報告書 (END)'!CJ139)` 参照をマスタの名前で**再生成**する。有効社員が5名を超える場合は6枠目以降を同じ列間隔（10列ごと）で追加する。5名未満なら余った枠は名前を空にし数式は `0` を返す形でよい

### 作業報告書（§3）
- ページ1「作業報告書」：行11〜133 = 30ブロック。ページ2〜「作業報告書 (2)」…「(5)」「(END)」：行4〜134 = 32ブロック（原本を確認して正確な数を取ること）
- 1ブロック=4行。書き込みセルは要件定義書 §3-2 の表どおり。時刻は Excel の時刻値（Date または小数）で書き、表示形式 `h:mm` を維持
- `ShipCase.workDayEntries` → ブロック列の変換規則は §3-2 の 1〜4（休憩は出力しない／改行1つ=1ブロック行／自動折返しなし／作業者複数はブロック複製／日付は当日先頭ブロックのみ）
- ブロック総数が全ページ容量（30+32×5）を超える場合は、超過分を切り捨てず**「作業報告書 (END)」の直前にシートを複製して追加**する（ExcelJS でのシート複製は難しいため、テンプレート側に予備ページを多めに持たせる案でもよい。どちらにするか検証結果に書く）
- 作業内容セル（W:CC 結合）は `wrapText: false`、原本と同じフォント（游ゴシック 10pt）

### 材料持出表（§4）
- ページ1「材料持出表」：行1 の船名(D1)・科目(S1)・型名(AH1)・完成月日(AX1・Date)、行3〜 の氏名、行12〜24 = 明細13行、Z25 持出者（先頭作業者 or 空）
- ページ2〜「材料持出表 (2)」〜「(4)」：行3〜25 = 23行
- 明細列は §4 のとおり。AE列（単位）は Phase C まで空欄。仕入合計・売値合計の数式は維持（値を上書きしない）
- 在庫：`isStock===true` → `✓`、それ以外は空欄

### ボタン配置
- ステップ2（`components/steps/WorkReportStep.tsx`）：既存「Excelで出力（1枚目）」を **「作業報告書をExcel出力」** に置き換え、新方式で作業報告書シート群のみのブックを出力。旧 `downloadWorkReportExcel` は削除。「Excelから読み込み」（`workReportImport.ts`）は新様式のブックを読めるようにするのが理想だが、工数が大きければ削除し、その旨を報告
- ステップ3（`components/steps/MaterialsStep.tsx`）：**「材料持出表をExcel出力」** ボタンを追加（材料持出表シート群のみのブック）
- ステップ4（`components/steps/InvoicePreviewStep.tsx`）：**「帳票一式をExcel出力」** ボタンを追加（作業報告書＋材料持出表の全シート入り）。既存の見積書/請求書出力は残す
- ファイル名：`作業報告書_{船名}_{YYYYMMDD}.xlsx` / `材料持出表_{船名}_{YYYYMMDD}.xlsx` / `帳票一式_{船名}_{YYYYMMDD}.xlsx`
- 印刷（`handlePrint`）は当面そのまま残す

## 検証（必須）
- `scripts/sample_case.json` に原本1ページ目相当の構造を持つ架空のサンプル案件（複数日の作業と材料。実案件の船名・作業内容は使わない）を用意し、Node スクリプト `scripts/render_sample.mjs` で `docs/verify/sample_output.xlsx` を生成（ブラウザ無しで `lib/reportWorkbook.ts` を呼べる構造にする。tsx か esbuild が無ければ `npx tsx` は使わず、ts を `node --experimental-strip-types` で動かすか、検証専用に最小の .mjs を書く）
- 生成物を openpyxl で読み戻し、W11・H11・H14・B11・Q11・CJ12 の値/数式が期待どおりかを `scripts/verify_output.py` で assert
- `npm run build` 成功

## 制約
- git commit はローカルのみ。**push・リモート設定・git init・Vercel操作・Supabaseスキーマ変更は絶対にしない**
- 依存追加は不可（exceljs / xlsx / openpyxl(Python側は可) の範囲で）
- `lib/types.ts` の型は Phase C で `Material.unit` が増える予定。今回は触らない
- 既存の他機能（保存・一覧・見積書）を壊さない

## 完了報告フォーマット
- 変更/追加ファイル一覧（1行ずつ）
- テンプレート作成で消した/残した項目
- ExcelJS round-trip で欠落した属性と対処
- サンプル出力の検証結果（verify_output.py の出力）
- `npm run build` 末尾10行
- コミットハッシュ（メッセージ：`feat: Phase B 原本様式の作業報告書・材料持出表Excel出力`）
- 未対応・判断に迷った点
