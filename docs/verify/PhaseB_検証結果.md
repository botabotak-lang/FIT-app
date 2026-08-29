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
