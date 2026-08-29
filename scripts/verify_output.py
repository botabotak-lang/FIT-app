from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/verify/sample_output.xlsx"
MATERIALS_ONLY = ROOT / "docs/verify/sample_materials.xlsx"


def is_formula(value):
    return isinstance(value, str) and value.startswith("=")


def check_all():
    wb = openpyxl.load_workbook(OUTPUT, data_only=False)
    ws = wb["作業報告書"]
    mat = wb["材料持出表"]

    # 作業報告書：ヘッダー
    assert ws["BU2"].value == "令 和 ８年", ws["BU2"].value
    assert ws["C5"].value == "第一テスト丸"
    assert ws["Y5"].value == "サンプル工事"
    assert ws["BB5"].value == "TEST-100"
    # 製造者の値セルは BU5（BS5:BT8 はラベル）
    assert ws["BU5"].value == "サンプル電機", ws["BU5"].value

    # 作業報告書：1ブロック目（移動 8:00〜9:00）と作業内容の1行目
    assert ws["B11"].value is not None
    assert ws["E11"].value is not None
    assert ws["E14"].value is not None
    assert ws["Q11"].value == "大竹"
    assert ws["W11"].value == "・機器の取付位置を確認し、取付可否を判断した。"
    # 作業内容は改行で1ブロック1行
    assert ws["W15"].value == "　既存架台の寸法が合わないため、加工が必要と判断した。"
    assert ws["W19"].value == "・必要な部材を確認し、手配を依頼した。"
    assert ws["CJ12"].value == '=IF(Q11="大竹",H14-H11,0)'

    # 材料持出表（1ブック統合）：作業者集計は3D参照の数式のまま
    assert mat["D1"].value == "第一テスト丸"
    assert mat["S1"].value == "サンプル工事"
    assert mat["AH1"].value == "TEST-100"
    assert mat["A3"].value == "大竹"
    assert mat["G3"].value == "=SUM('作業報告書:作業報告書 (END)'!CJ139)", mat["G3"].value
    assert mat["A12"].value is not None
    assert mat["E12"].value == "サンプルボルト"
    assert mat["U13"].value == "✓"
    assert mat["AJ12"].value == "=SUM(AF12*AB12)"
    # 単位（Phase C）は AE列
    assert mat["AE12"].value == "本", mat["AE12"].value
    assert mat["AE13"].value == "個", mat["AE13"].value
    # 工賃ヘッダーは設定値の単価
    assert mat["M2"].value == "工　賃(@7,000)", mat["M2"].value
    assert mat["AE2"].value == "工　賃(@8,400)", mat["AE2"].value
    assert mat["AO2"].value == "移動費(×0.8)", mat["AO2"].value
    assert mat["M3"].value == "=(G3*24)*7000", mat["M3"].value
    assert mat["AO3"].value == "=(AK3*24)*5600", mat["AO3"].value

    # 14件目以降は2ページ目へ
    assert wb["材料持出表 (2)"]["E3"].value == "サンプル絶縁テープ"
    return ws, mat


def check_materials_only():
    wb = openpyxl.load_workbook(MATERIALS_ONLY, data_only=False)
    assert wb.sheetnames == ["材料持出表", "材料持出表 (2)", "材料持出表 (3)", "材料持出表 (4)"], wb.sheetnames
    ws = wb["材料持出表"]

    # 作業報告書シートが無いので、3D参照ではなく集計済みの時間値が入る
    for cell in ("G3", "S3", "Y3", "AK3"):
        assert not is_formula(ws[cell].value), f"{cell} は数式のままです: {ws[cell].value!r}"
    # 大竹：平日時間(内) 6h ＝ 6/24 日
    assert abs(ws["G3"].value.total_seconds() / 3600 - 6) < 1e-6, ws["G3"].value
    assert abs(ws["S3"].value.total_seconds() / 3600 - 2) < 1e-6, ws["S3"].value
    assert abs(ws["AK3"].value.total_seconds() / 3600 - 1) < 1e-6, ws["AK3"].value
    # 豊島：1/30の1時間だけ
    assert abs(ws["G4"].value.total_seconds() / 3600 - 1) < 1e-6, ws["G4"].value
    # 鈴木：休日3時間
    assert abs(ws["Y5"].value.total_seconds() / 3600 - 3) < 1e-6, ws["Y5"].value
    # 工賃の数式は残る（値を掛けるだけなので #REF! にならない）
    assert is_formula(ws["M3"].value), ws["M3"].value
    # 船名・科目・型名は値で書かれている（作業報告書への参照ではない）
    assert ws["D1"].value == "第一テスト丸"
    assert ws["S1"].value == "サンプル工事"
    return ws


def main():
    ws, mat = check_all()
    mat_only = check_materials_only()
    print("verify_output.py: OK")
    print(f"BU2={ws['BU2'].value} BU5={ws['BU5'].value} W11={ws['W11'].value}")
    print(f"材料持出表(統合) G3={mat['G3'].value}")
    print(f"材料持出表(単体) G3={mat_only['G3'].value} S3={mat_only['S3'].value} AK3={mat_only['AK3'].value}")


if __name__ == "__main__":
    main()
