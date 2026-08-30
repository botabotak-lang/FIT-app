# Phase B 検証結果

## テンプレート作成

- 入力: `docs/reference/FIT様式_作業報告書_材料持出表_原本20260829.xlsx`
  - **原本はクライアントの実データを含むためリポジトリには含めない**（`.gitignore` で `/docs/reference/` を除外）。原本が無い環境で `make_template.py` を実行するとメッセージを出して終了する
- 出力: `public/templates/fit_report_template.xlsx`
- スクリプト: `scripts/make_template.py`
- 消した項目:
  - 作業報告書: 1ページ目の `C5` / `Y5` / `BB5` / `BT5` / `BU5` / `BU2`、各ブロックの `B` / `E` / `H` / `K` / `N` / `Q` / `T` / `W` の入力値
  - ブックのメタデータ（作成者・最終更新者・タイトル等）
  - 材料持出表: 1ページ目の `D1` / `S1` / `AH1` / `AX1`、行3-9の氏名・備考、明細入力値、持出者
- 残した項目:
  - 結合セル、罫線、列幅、行高、印刷範囲、数式、入力規則リスト
  - 作業報告書の集計数式、材料持出表の `AJ` / `AS` 合計数式
  - 材料持出表の行27以降の入力規則用リスト

## テンプレート検証

`python3 scripts/verify_template.py`

```text
verify_template.py: OK
```

確認内容:

- シート名一覧一致
- 結合セル数一致
- 印刷範囲一致
- 行高（行11-14）一致
- 列幅（B-CC）一致
- `CJ11` / `CJ138` / `M3` / `AJ12` の数式一致
- ブックのメタデータ（creator / lastModifiedBy / title 等）が空であること

## ExcelJS round-trip

- 欠落した属性: なし
- 対処: 印刷範囲・結合セル・行高・列幅・主要数式はテンプレートを維持していることをopenpyxlで確認した
- 備考: 入力規則はExcelJS保存後にopenpyxl上の件数表現が分割されるが、欠落ではない。原本のリスト範囲は保持される
- 超過ページ: 今回はテンプレートに含まれる作業報告書6ページ（30+32*5ブロック）を使用。ExcelJSのシート複製は使わず、容量超過分は現時点では既存6ページ容量まで出力する

## サンプル出力検証

サンプル案件（`scripts/sample_case.json`）は**架空データ**。実案件の船名・作業内容・訪問先は含めない。
検証に必要な構造（複数日・複数作業者・移動/作業内/作業外/休日/休憩の混在・複数行の作業内容・材料15件＝1ページ13行超）は維持している。

生成:

```text
created docs/verify/sample_output.xlsx
created docs/verify/sample_materials.xlsx
```

`python3 scripts/verify_output.py`

```text
verify_output.py: OK
BU2=令 和 ８年 BU5=サンプル電機 W11=・機器の取付位置を確認し、取付可否を判断した。
材料持出表(統合) G3==SUM('作業報告書:作業報告書 (END)'!CJ139)
材料持出表(単体) G3=6:00:00 S3=2:00:00 AK3=1:00:00
```

## Phase B 修正（2026/08/30）

| 事象 | 対処 |
|---|---|
| 製造者が結合ラベル側（`BT5`）に書かれていた | 値セル `BU5`（結合 `BU5:CC8`）へ変更 |
| 材料持出表の単体出力で `SUM('作業報告書:作業報告書 (END)'!CJ139)` が #REF! になる | `kind === "materials"` のときは `sumHoursByWorker()` の集計値（Excel時間値＝日の小数）を `G` / `S` / `Y` / `AK` に直接書く。`kind === "all"` は数式のまま |
| 用紙容量超過が無警告 | `REPORT_BLOCK_CAPACITY`（190ブロック）/ `MATERIAL_ROW_CAPACITY`（82行）を超えたら出力ボタンで確認ダイアログ |
| 年号が半角（`令 和 8年`） | 原本どおり全角（`令 和 ８年`） |
| 未参照ファイル | `lib/workReportExcel.ts` / `lib/workReportImport.ts` を削除。`workReportLayout.ts` のExcel専用定数も削除 |

## 検証FAIL対応（2026/08/30・2巡目）

| # | 事象 | 対処 |
|---|---|---|
| 1 | テンプレートの `材料持出表!AJ17/AJ18/AJ19` が数式でなく固定値（952.7 / 136.3 / 154.5）。原本で数式が値に上書きされていたセルをそのまま引き継いでいた | `make_template.py` で材料持出表系の全明細行（1ページ目 行12〜24／2ページ目以降 行3〜25）の `AJ` を `=SUM(AF{r}*AB{r})`、`AS` を `=SUM(AO{r}*AB{r})` に**無条件で上書き**。あわせて明細領域（A〜BB）・作業報告書ブロック領域（B〜CC）に「数式でも空でもない残存値」が無いかスキャンし、検出したら列挙して失敗終了する |
| 2 | 作業者集計枠が5枠固定で、6名以上だと6人目以降が集計されない | ラベル列を `CF` から10列間隔、値列をラベル列＋4列で**関数計算**（6枠目 `ED`/`EH`、7枠目 `EN`/`ER` …）。6枠目以降はテンプレートに書式が無いため、5枠目（`DT`/`DX`）のセル書式（font / alignment / border / fill / numFmt）を各行でコピーしてから書き込む。見出し（行9・68・136／2ページ目以降は行2・69・136）、各ブロックの4行、行138〜141の合計、`BZ138〜141` の全員合計、行137以降の作業者名リストを枠数に追随させた |
| 3 | 2ページ目以降の集計見出し（`CF2` / `CF69`）に原本の氏名が残っていた | 見出し行がシートで異なる（1ページ目 9・68／2ページ目以降 2・69）ことに合わせて書き込み位置を修正 |
| 4 | 材料持出表 行3〜9 の空き枠に `0` が印字される | 氏名が無い枠は `G` / `S` / `Y` / `AK` と工賃数式 `M` / `AE` / `AO` をすべて空欄（null）にする |
| 5 | `BASE_WORKER_NAMES` に現行マスタに存在しない氏名がコードに残っていた | 削除。社員マスタが空のときは氏名なしの枠だけを出す |
| 6 | `render_sample.mjs` の社員順が本番マスタ順と違う | 本番マスタ4名と同じ人数・並び順に修正（氏名は架空の `作業者A`〜`作業者D`）。`--employees=N`（または環境変数 `RENDER_EMPLOYEES`）で人数指定可 |
| 7 | 未参照コンポーネントが残っていた | `components/MaterialsForm.tsx` / `components/WorkReportForm.tsx` / `components/steps/WorkerSelectionStep.tsx` を削除 |
| 8 | （security-reviewer指摘）テンプレートの作業者別集計枠（`CF9`〜`DT9` / `CF68`〜 / `CF136`〜 / `Q137`〜`Q141` と `CJ`〜`DX` 列の集計数式）に**実在社員の氏名が焼き付いたまま**だった。テンプレートは `public/templates/` から認証なしで静的配信されるため、URLを知っていれば氏名が閲覧できた | `make_template.py` で氏名をプレースホルダ `作業者1`〜`作業者5` に置換（見出し・合計ラベル・数式・氏名リスト）。原本から氏名一覧を抽出し、生成後のブック全シートを走査して1件でも残っていれば失敗終了するチェックを追加。`verify_template.py` にも同じassertを追加。アプリ出力時は `writeWorkerFormulas` が全枠を社員マスタの氏名で上書きするため、出力ファイルにプレースホルダは残らない（検証済み） |

### 未対応（窪田判断が必要）

- **テンプレート `public/templates/fit_report_template.xlsx` は認証なしの静的配信。** 氏名は除去済みだが、様式そのものは誰でもダウンロードできる。様式自体を秘匿する必要があるならAPI Route経由の配信に切り替える

### 既知の制約

- **作業者が8名以上になると、材料持出表の工賃集計は7名分（行3〜9）しか出力できない。** 8名以上を扱うにはテンプレートの拡張（行の追加と合計式の付け替え）が必要。現状は出力ボタン押下時に確認ダイアログで警告する。作業報告書側は枠を自動生成するため人数の上限なし

### 検証コマンドと出力

```text
$ python3 scripts/make_template.py
created public/templates/fit_report_template.xlsx
残存値スキャン: 0 件（明細領域・作業報告書ブロック領域）
氏名スキャン: 0 件（原本の氏名 5 名を全シート走査）

$ python3 scripts/verify_template.py
verify_template.py: OK
  材料持出表系シートの明細行 AJ/AS: 全て数式
  明細領域・作業報告書ブロック領域の残存値: 0 件
  作業者別集計枠の原本氏名: 0 件（プレースホルダ「作業者N」に置換済み）

$ node scripts/render_sample.mjs
created docs/verify/sample_output.xlsx (all, 4名: 作業者A・作業者B・作業者C・作業者D)
created docs/verify/sample_materials.xlsx (materials, 4名: 作業者A・作業者B・作業者C・作業者D)
created docs/verify/sample_output_6workers.xlsx (all, 6名: 作業者A・作業者B・作業者C・作業者D・作業者E・作業者F)

$ python3 scripts/verify_output.py
verify_output.py: OK
BU2=令 和 ８年 BU5=サンプル電機 W11=・機器の取付位置を確認し、取付可否を判断した。
材料持出表(統合) A3=作業者A G3==SUM('作業報告書:作業報告書 (END)'!CJ139) G8=None G9=None
材料持出表(単体) G3=1:00:00 S3=2:00:00 G5=6:00:00
完成月日 AX1=2026-02-06 00:00:00 合計 AJ25==SUM(AJ12:AJ24) AS25==SUM(AS12:AS24)
6名レンダー ED9=所要時間　作業者F EH11==IF(Q11="作業者F",E14-E11,0)
```

## ビルド

`npm run build`

```text
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /case/[id]
├ ○ /case/new
├ ○ /customers
├ ○ /employees
└ ○ /products

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
