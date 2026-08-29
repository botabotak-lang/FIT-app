"""原本Excelからデータを消してテンプレートを作る。

原本（docs/reference/）はクライアントの実データを含むためリポジトリには含めない。
原本が無い環境ではメッセージを出して終了する（テンプレート自体はコミット済み）。
"""

import sys
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import MergedCell


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/reference/FIT様式_作業報告書_材料持出表_原本20260829.xlsx"
DEST = ROOT / "public/templates/fit_report_template.xlsx"

WORK_SHEETS = [
    "作業報告書",
    "作業報告書 (2)",
    "作業報告書 (3)",
    "作業報告書 (4)",
    "作業報告書 (5)",
    "作業報告書 (END)",
]
MATERIAL_SHEETS = [
    "材料持出表",
    "材料持出表 (2)",
    "材料持出表 (3)",
    "材料持出表 (4)",
]


def clear_if_not_formula(ws, cell):
    if isinstance(ws[cell], MergedCell):
        return
    value = ws[cell].value
    if isinstance(value, str) and value.startswith("="):
        return
    ws[cell].value = None


def clear_work_report(ws, first_page):
    if first_page:
        for cell in ("C5", "Y5", "BB5", "BT5", "BU5", "BU2"):
            clear_if_not_formula(ws, cell)
        starts = list(range(11, 67, 4)) + list(range(70, 134, 4))
    else:
        starts = list(range(4, 68, 4)) + list(range(71, 135, 4))

    for row in starts:
        for col in ("B", "E", "H", "K", "N", "Q", "T", "W"):
            clear_if_not_formula(ws, f"{col}{row}")
        for col in ("E", "H", "K", "N"):
            clear_if_not_formula(ws, f"{col}{row + 3}")


def clear_materials(ws, first_page):
    if first_page:
        for cell in ("D1", "S1", "AH1", "AX1"):
            clear_if_not_formula(ws, cell)
        for row in range(3, 10):
            clear_if_not_formula(ws, f"A{row}")
            clear_if_not_formula(ws, f"AU{row}")
        detail_rows = range(12, 25)
        carrier_cell = "Z25"
    else:
        detail_rows = range(3, 26)
        carrier_cell = "Z26"

    for row in detail_rows:
        for col in ("A", "E", "M", "U", "X", "AB", "AE", "AF", "AO", "AX"):
            clear_if_not_formula(ws, f"{col}{row}")
    clear_if_not_formula(ws, carrier_cell)


def clear_metadata(wb):
    """作成者名などの個人情報をテンプレートに残さない"""
    props = wb.properties
    props.creator = ""
    props.lastModifiedBy = ""
    props.title = ""
    props.subject = ""
    props.description = ""
    props.keywords = ""
    props.category = ""
    props.identifier = None
    props.language = None
    props.revision = None
    props.contentStatus = None


def main():
    if not SOURCE.exists():
        print(f"原本が見つかりません: {SOURCE}")
        print("原本は実データを含むためリポジトリに含めていません。")
        print("テンプレート（public/templates/fit_report_template.xlsx）はコミット済みのものを使用してください。")
        return 0
    wb = openpyxl.load_workbook(SOURCE)
    for i, name in enumerate(WORK_SHEETS):
        clear_work_report(wb[name], i == 0)
    for i, name in enumerate(MATERIAL_SHEETS):
        clear_materials(wb[name], i == 0)
    clear_metadata(wb)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    wb.save(DEST)
    print(f"created {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
