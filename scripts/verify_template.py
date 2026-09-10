import re
from pathlib import Path

import openpyxl

from make_template import (
    MANUFACTURER_LABEL_CELL,
    MANUFACTURER_LABEL_FONT_SIZE,
    MATERIAL_SHEETS,
    MATERIAL_TOTAL_LAST_COL,
    MATERIAL_TOTAL_ROW,
    MATERIAL_TOTAL_VALUES,
    MATERIAL_WORKER_ROWS,
    check_material_sum_formulas,
    collect_worker_names,
    is_formula,
    material_detail_rows,
    scan_residual_values,
    scan_worker_names,
    total_row_sample_path,
)


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "docs/reference/FIT様式_作業報告書_材料持出表_原本20260829.xlsx"
TEMPLATE = ROOT / "public/templates/fit_report_template.xlsx"


def style_of(cell):
    """書式の比較用タプル（フォント・塗り・罫線・配置・表示形式）"""
    b = cell.border
    return (
        (cell.font.name, cell.font.sz, cell.font.b, cell.font.color and cell.font.color.value),
        (cell.fill.fill_type, cell.fill.fgColor.type, cell.fill.fgColor.value),
        tuple((s.style, s.color and s.color.value) for s in (b.left, b.right, b.top, b.bottom)),
        (cell.alignment.horizontal, cell.alignment.vertical, cell.alignment.wrapText, cell.alignment.shrinkToFit),
        cell.number_format,
    )


def check_material_total_row(template):
    """材料持出表1ページ目の行9が見本ファイルと同じ「合計」行であること"""
    sample_path = total_row_sample_path()
    assert sample_path is not None, "合計行の見本ファイルが docs/reference にありません"
    sample = openpyxl.load_workbook(sample_path, data_only=False)[MATERIAL_SHEETS[0]]
    ws = template[MATERIAL_SHEETS[0]]
    last = openpyxl.utils.column_index_from_string(MATERIAL_TOTAL_LAST_COL)
    for idx in range(1, last + 1):
        col = openpyxl.utils.get_column_letter(idx)
        cell = ws.cell(row=MATERIAL_TOTAL_ROW, column=idx)
        ref = sample.cell(row=MATERIAL_TOTAL_ROW, column=idx)
        assert style_of(cell) == style_of(ref), f"{col}{MATERIAL_TOTAL_ROW} の書式が見本と違います"
        if not isinstance(cell, openpyxl.cell.cell.MergedCell):
            expected = MATERIAL_TOTAL_VALUES.get(col)
            assert cell.value == expected, f"{col}{MATERIAL_TOTAL_ROW}={cell.value!r}（期待: {expected!r}）"
    for col, expected in MATERIAL_TOTAL_VALUES.items():
        actual = ws[f"{col}{MATERIAL_TOTAL_ROW}"].value
        assert actual == expected, f"{col}{MATERIAL_TOTAL_ROW}={actual!r}（期待: {expected!r}）"
        assert actual == sample[f"{col}{MATERIAL_TOTAL_ROW}"].value, f"{col}{MATERIAL_TOTAL_ROW} が見本と違います"
    # 氏名枠は行3〜8の6枠。テンプレートでは空欄
    for row in MATERIAL_WORKER_ROWS:
        assert ws[f"A{row}"].value is None, f"A{row}={ws[f'A{row}'].value!r}"


def main():
    original = openpyxl.load_workbook(ORIGINAL, data_only=False)
    template = openpyxl.load_workbook(TEMPLATE, data_only=False)
    assert original.sheetnames == template.sheetnames
    for name in original.sheetnames:
        o = original[name]
        t = template[name]
        assert len(o.merged_cells.ranges) == len(t.merged_cells.ranges), name
        assert o.print_area == t.print_area, name
        for row in range(11, 15):
            assert o.row_dimensions[row].height == t.row_dimensions[row].height, f"{name} row {row}"
        for col_idx in range(openpyxl.utils.column_index_from_string("B"), openpyxl.utils.column_index_from_string("CC") + 1):
            col = openpyxl.utils.get_column_letter(col_idx)
            assert o.column_dimensions[col].width == t.column_dimensions[col].width, f"{name} col {col}"
    for sheet, cell in [("作業報告書", "CJ138"), ("材料持出表", "M3"), ("材料持出表", "AJ12")]:
        assert original[sheet][cell].value == template[sheet][cell].value, f"{sheet}!{cell}"
    # CJ11 は氏名だけプレースホルダに置き換えてある。氏名以外の構造が原本と同じであること
    def mask_name(value):
        return re.sub(r'="[^"]*"', '="@"', value or "")
    assert mask_name(original["作業報告書"]["CJ11"].value) == mask_name(template["作業報告書"]["CJ11"].value), (
        original["作業報告書"]["CJ11"].value,
        template["作業報告書"]["CJ11"].value,
    )
    assert template["作業報告書"]["CJ11"].value == '=IF(Q11="作業者1",E14-E11,0)', template["作業報告書"]["CJ11"].value

    # 材料持出表系シートの明細行は AJ/AS が必ず数式（原本では値で上書きされた行がある）
    bad = check_material_sum_formulas(template)
    assert not bad, f"合計列が数式でないセル: {bad}"
    for i, name in enumerate(MATERIAL_SHEETS):
        ws = template[name]
        for row in material_detail_rows(i == 0):
            for col in ("AJ", "AS"):
                value = ws[f"{col}{row}"].value
                assert is_formula(value), f"{name}!{col}{row} が数式ではありません: {value!r}"

    # 「製造者」ラベル（縦書きの結合セル BS5:BT8）は10ptだと3文字目が切れるため8pt。配置は原本のまま
    label = template["作業報告書"][MANUFACTURER_LABEL_CELL]
    original_label = original["作業報告書"][MANUFACTURER_LABEL_CELL]
    assert label.value == "製造者", label.value
    assert label.font.sz == MANUFACTURER_LABEL_FONT_SIZE, label.font.sz
    assert label.alignment.textRotation == original_label.alignment.textRotation == 255, label.alignment.textRotation
    assert label.alignment.horizontal == original_label.alignment.horizontal, label.alignment.horizontal
    assert label.alignment.wrapText == original_label.alignment.wrapText, label.alignment.wrapText

    # 材料持出表1ページ目の行9＝工賃「合計」行（見本ファイルと一致）
    check_material_total_row(template)

    # 明細領域・作業報告書ブロック領域に原本の残存値が無いこと
    residual = scan_residual_values(template)
    assert not residual, f"テンプレートに残存値があります: {residual}"

    # 作業者別集計枠に原本の実在社員名が残っていないこと（テンプレートは静的配信される）
    leaked = scan_worker_names(template, collect_worker_names(original))
    assert not leaked, f"テンプレートに原本の氏名が残っています: {leaked[:10]}"

    # テンプレートに作成者名などの個人情報が残っていないこと
    props = template.properties
    for field in ("creator", "lastModifiedBy", "title", "subject", "description", "keywords", "category"):
        value = getattr(props, field, None)
        assert not value, f"template metadata {field}={value!r}"

    print("verify_template.py: OK")
    print(f"  製造者ラベル {MANUFACTURER_LABEL_CELL}: {label.font.sz}pt（縦書き・配置は原本のまま）")
    print(f"  材料持出表 行{MATERIAL_TOTAL_ROW}: 合計行（見本ファイルと書式・数式が一致）")
    print("  材料持出表系シートの明細行 AJ/AS: 全て数式")
    print("  明細領域・作業報告書ブロック領域の残存値: 0 件")
    print("  作業者別集計枠の原本氏名: 0 件（プレースホルダ「作業者N」に置換済み）")


if __name__ == "__main__":
    main()
