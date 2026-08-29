from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "docs/reference/FIT様式_作業報告書_材料持出表_原本20260829.xlsx"
TEMPLATE = ROOT / "public/templates/fit_report_template.xlsx"


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
    for sheet, cell in [("作業報告書", "CJ11"), ("作業報告書", "CJ138"), ("材料持出表", "M3"), ("材料持出表", "AJ12")]:
        assert original[sheet][cell].value == template[sheet][cell].value, f"{sheet}!{cell}"

    # テンプレートに作成者名などの個人情報が残っていないこと
    props = template.properties
    for field in ("creator", "lastModifiedBy", "title", "subject", "description", "keywords", "category"):
        value = getattr(props, field, None)
        assert not value, f"template metadata {field}={value!r}"

    print("verify_template.py: OK")


if __name__ == "__main__":
    main()
