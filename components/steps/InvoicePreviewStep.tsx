"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet } from "lucide-react";
import {
  BasicInfo,
  WorkDayEntry,
  Material,
  DocumentType,
  REGULAR_RATE,
  HOLIDAY_RATE,
  TRAVEL_RATE,
  COMPANY_INFO,
} from "@/lib/types";
import { calcBlockHours } from "@/lib/workDayEntry";
import * as XLSX from "xlsx";

type Props = {
  basicInfo: BasicInfo;
  workDayEntries: WorkDayEntry[];
  materials: Material[];
};

type InvoiceLine = {
  no: number;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: number;
  amount: number;
};

export default function InvoicePreviewStep({
  basicInfo,
  workDayEntries,
  materials,
}: Props) {
  const [docType, setDocType] = useState<DocumentType>("estimate");
  const today = new Date();
  const docNumber = `${docType === "estimate" ? "EST" : "INV"}-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-001`;

  const buildInvoiceLines = (): InvoiceLine[] => {
    const lines: InvoiceLine[] = [];
    let no = 1;

    const workerStats = new Map<string, { regular: number; overtime: number; holiday: number; travel: number }>();
    workDayEntries.forEach((entry) => {
      const s = workerStats.get(entry.worker) || { regular: 0, overtime: 0, holiday: 0, travel: 0 };
      (entry.blocks || []).forEach((b) => {
        const h = calcBlockHours(b);
        if (h <= 0 || b.kind === "break") return;
        switch (b.kind) {
          case "travel":
            s.travel += h;
            break;
          case "regular":
            s.regular += h;
            break;
          case "overtime":
            s.overtime += h;
            break;
          case "holiday":
            s.holiday += h;
            break;
        }
      });
      workerStats.set(entry.worker, s);
    });

    workerStats.forEach((s, worker) => {
      if (s.regular > 0) {
        lines.push({ no: no++, category: "作業費", description: `作業費（${worker}・時間内）`, quantity: s.regular.toFixed(1), unit: "h", unitPrice: REGULAR_RATE, amount: Math.round(s.regular * REGULAR_RATE) });
      }
      if (s.overtime > 0) {
        lines.push({ no: no++, category: "作業費", description: `作業費（${worker}・時間外）`, quantity: s.overtime.toFixed(1), unit: "h", unitPrice: REGULAR_RATE, amount: Math.round(s.overtime * REGULAR_RATE) });
      }
      if (s.holiday > 0) {
        lines.push({ no: no++, category: "作業費", description: `作業費（${worker}・休日）`, quantity: s.holiday.toFixed(1), unit: "h", unitPrice: HOLIDAY_RATE, amount: Math.round(s.holiday * HOLIDAY_RATE) });
      }
      if (s.travel > 0) {
        const rate = Math.round(REGULAR_RATE * TRAVEL_RATE);
        lines.push({ no: no++, category: "作業費", description: `移動費（${worker}）`, quantity: s.travel.toFixed(1), unit: "h", unitPrice: rate, amount: Math.round(s.travel * rate) });
      }
    });

    materials.forEach((m) => {
      if (!m.productName) return;
      lines.push({
        no: no++,
        category: "材料費",
        description: `${m.productName}${m.modelType ? ` (${m.modelType})` : ""}`,
        quantity: String(m.quantity),
        unit: "個",
        unitPrice: m.sellingPrice,
        amount: m.sellingTotal,
      });
    });

    materials.forEach((m) => {
      if (m.shippingFee > 0) {
        lines.push({
          no: no++,
          category: "送料",
          description: `送料（${m.productName}）`,
          quantity: "1",
          unit: "式",
          unitPrice: m.shippingFee,
          amount: m.shippingFee,
        });
      }
    });

    return lines;
  };

  const lines = buildInvoiceLines();
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  const docTitle = docType === "estimate" ? "見 積 書" : "請 求 書";
  const formatDate = (d: Date) =>
    `令和${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日`;

  const handlePrintPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 15px; }
  .header h1 { font-size: 28px; letter-spacing: 12px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .meta-left { font-size: 14px; }
  .meta-right { text-align: right; font-size: 13px; }
  .customer { font-size: 18px; border-bottom: 1px solid #333; display: inline-block; padding-bottom: 2px; margin-bottom: 5px; }
  .subject { font-size: 14px; margin: 10px 0 20px; }
  .total-box { background: #f5f5f5; border: 2px solid #333; padding: 15px; text-align: center; margin-bottom: 25px; }
  .total-box .label { font-size: 14px; margin-bottom: 5px; }
  .total-box .amount { font-size: 28px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th { background: #e8e8e8; border: 1px solid #999; padding: 6px 8px; text-align: center; font-weight: bold; }
  td { border: 1px solid #999; padding: 6px 8px; }
  td.num { text-align: right; }
  td.center { text-align: center; }
  .category-row { background: #f0f0f0; font-weight: bold; }
  .subtotal-section { margin-bottom: 25px; }
  .subtotal-section table { width: 300px; margin-left: auto; }
  .subtotal-section td { border: none; padding: 4px 8px; }
  .subtotal-section tr:last-child td { border-top: 2px solid #333; font-weight: bold; font-size: 15px; }
  .notes { font-size: 12px; border: 1px solid #ccc; padding: 12px; margin-bottom: 25px; background: #fafafa; }
  .notes h3 { font-size: 13px; margin-bottom: 5px; }
  .company { border-top: 1px solid #999; padding-top: 15px; font-size: 12px; line-height: 1.8; }
  .company .name { font-size: 16px; font-weight: bold; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="header"><h1>${docTitle}</h1></div>
  <div class="meta">
    <div class="meta-left">
      <div class="customer">${basicInfo.customer} 御中</div>
      <div class="subject">件名：船舶「${basicInfo.shipName}」${basicInfo.category || "修理工事"}</div>
    </div>
    <div class="meta-right">
      <div>No. ${docNumber}</div>
      <div>日付：${formatDate(today)}</div>
      ${docType === "estimate" ? `<div>有効期限：発行日より30日間</div>` : ""}
    </div>
  </div>
  <div class="total-box">
    <div class="label">合計金額（税込）</div>
    <div class="amount">¥${total.toLocaleString()}</div>
  </div>
  <table>
    <thead><tr><th style="width:35px">No.</th><th>項目</th><th style="width:55px">数量</th><th style="width:40px">単位</th><th style="width:85px">単価</th><th style="width:95px">金額</th></tr></thead>
    <tbody>
      ${lines.map((l, i) => {
        const showCategory = i === 0 || lines[i - 1].category !== l.category;
        return `${showCategory ? `<tr class="category-row"><td colspan="6">【${l.category}】</td></tr>` : ""}
          <tr><td class="center">${l.no}</td><td>${l.description}</td><td class="num">${l.quantity}</td><td class="center">${l.unit}</td><td class="num">¥${l.unitPrice.toLocaleString()}</td><td class="num">¥${l.amount.toLocaleString()}</td></tr>`;
      }).join("")}
    </tbody>
  </table>
  <div class="subtotal-section"><table>
    <tr><td>小計</td><td class="num">¥${subtotal.toLocaleString()}</td></tr>
    <tr><td>消費税（10%）</td><td class="num">¥${tax.toLocaleString()}</td></tr>
    <tr><td>合計</td><td class="num">¥${total.toLocaleString()}</td></tr>
  </table></div>
  <div class="notes"><h3>備考</h3>
    <p>・${docType === "estimate" ? "本見積の有効期限は発行日より30日間です。" : "お支払い期限：請求書発行日より翌月末日"}</p>
    <p>・材料費は実費精算となります。</p>
  </div>
  <div class="company">
    <div class="name">${COMPANY_INFO.name}</div>
    <div>${COMPANY_INFO.zipCode} ${COMPANY_INFO.address}</div>
    <div>TEL: ${COMPANY_INFO.tel} / FAX: ${COMPANY_INFO.fax}</div>
    ${docType === "invoice" ? `<div>振込先：${COMPANY_INFO.bankInfo}</div>` : ""}
  </div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handleExcelExport = () => {
    const wsData: (string | number)[][] = [
      [docTitle],
      [],
      ["書類番号", docNumber, "", "日付", formatDate(today)],
      ["顧客名", basicInfo.customer],
      ["船名", basicInfo.shipName],
      ["科目", basicInfo.category || "修理工事"],
      [],
      ["No.", "区分", "項目", "数量", "単位", "単価", "金額"],
    ];

    lines.forEach((l) => {
      wsData.push([l.no, l.category, l.description, l.quantity, l.unit, l.unitPrice, l.amount]);
    });

    wsData.push([]);
    wsData.push(["", "", "", "", "", "小計", subtotal]);
    wsData.push(["", "", "", "", "", "消費税(10%)", tax]);
    wsData.push(["", "", "", "", "", "合計", total]);

    if (materials.length > 0) {
      wsData.push([]);
      wsData.push(["【材料明細（社内用）】"]);
      wsData.push(["品名", "型式", "仕入先", "数量", "仕入単価", "仕入合計", "売値単価", "売値合計", "送料", "粗利"]);
      materials.forEach((m) => {
        if (!m.productName) return;
        const profit = m.sellingTotal - m.purchaseTotal - m.shippingFee;
        wsData.push([m.productName, m.modelType, m.supplier, m.quantity, m.purchasePrice, m.purchaseTotal, m.sellingPrice, m.sellingTotal, m.shippingFee, profit]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 5 }, { wch: 8 }, { wch: 30 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, docType === "estimate" ? "見積書" : "請求書");
    XLSX.writeFile(wb, `${docNumber}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">見積書・請求書プレビュー</h2>
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
          <p>入力内容をもとに、見積書または請求書を生成します。</p>
        </div>
      </div>

      {/* 書類タイプ切替 */}
      <div className="flex gap-2">
        <Button
          variant={docType === "estimate" ? "default" : "outline"}
          onClick={() => setDocType("estimate")}
          className="flex-1"
        >
          見積書
        </Button>
        <Button
          variant={docType === "invoice" ? "default" : "outline"}
          onClick={() => setDocType("invoice")}
          className="flex-1"
        >
          請求書
        </Button>
      </div>

      {/* プレビュー */}
      <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
        {/* ヘッダー */}
        <div className="text-center border-b-4 border-double border-gray-800 pb-3 mb-4">
          <h3 className="text-2xl font-bold tracking-[0.5em]">{docTitle}</h3>
        </div>

        {/* メタ情報 */}
        <div className="flex justify-between mb-4">
          <div>
            <div className="text-lg font-semibold border-b border-gray-800 inline-block">
              {basicInfo.customer || "（顧客名未入力）"} 御中
            </div>
            <div className="text-sm mt-2">
              件名：船舶「{basicInfo.shipName}」{basicInfo.category || "修理工事"}
            </div>
          </div>
          <div className="text-right text-sm">
            <div>No. {docNumber}</div>
            <div>日付：{formatDate(today)}</div>
            {docType === "estimate" && <div>有効期限：発行日より30日間</div>}
          </div>
        </div>

        {/* 合計金額ボックス */}
        <div className="bg-gray-100 border-2 border-gray-800 p-4 text-center mb-6">
          <div className="text-sm">合計金額（税込）</div>
          <div className="text-3xl font-bold">¥{total.toLocaleString()}</div>
        </div>

        {/* 明細テーブル */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 px-2 py-1 w-10">No.</th>
                <th className="border border-gray-400 px-2 py-1">項目</th>
                <th className="border border-gray-400 px-2 py-1 w-16">数量</th>
                <th className="border border-gray-400 px-2 py-1 w-12">単位</th>
                <th className="border border-gray-400 px-2 py-1 w-20">単価</th>
                <th className="border border-gray-400 px-2 py-1 w-24">金額</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const showCategory = i === 0 || lines[i - 1].category !== l.category;
                return (
                  <tr key={`line-${i}`}>
                    {showCategory && i > 0 && (
                      <td colSpan={6} className="h-1"></td>
                    )}
                    {showCategory ? (
                      <>
                        <td colSpan={6} className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold text-xs">
                          【{l.category}】
                        </td>
                      </>
                    ) : null}
                    {showCategory ? null : null}
                    <td className="border border-gray-400 px-2 py-1 text-center">{l.no}</td>
                    <td className="border border-gray-400 px-2 py-1">{l.description}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">{l.quantity}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{l.unit}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">¥{l.unitPrice.toLocaleString()}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">¥{l.amount.toLocaleString()}</td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-gray-400 px-2 py-4 text-center text-gray-400">
                    明細データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 小計・消費税・合計 */}
        <div className="flex justify-end mb-6">
          <div className="w-64">
            <div className="flex justify-between py-1 text-sm">
              <span>小計</span>
              <span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>消費税（10%）</span>
              <span>¥{tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 text-base font-bold border-t-2 border-gray-800 mt-1 pt-1">
              <span>合計</span>
              <span>¥{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 備考 */}
        <div className="border border-gray-300 p-3 text-xs mb-4 bg-gray-50">
          <div className="font-bold mb-1">備考</div>
          <p>・{docType === "estimate" ? "本見積の有効期限は発行日より30日間です。" : "お支払い期限：請求書発行日より翌月末日"}</p>
          <p>・材料費は実費精算となります。</p>
        </div>

        {/* 会社情報 */}
        <div className="border-t border-gray-400 pt-3 text-xs leading-relaxed">
          <div className="font-bold text-sm">{COMPANY_INFO.name}</div>
          <div>{COMPANY_INFO.zipCode} {COMPANY_INFO.address}</div>
          <div>TEL: {COMPANY_INFO.tel} / FAX: {COMPANY_INFO.fax}</div>
          {docType === "invoice" && <div>振込先：{COMPANY_INFO.bankInfo}</div>}
        </div>
      </div>

      {/* 出力ボタン */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Button onClick={handlePrintPDF} className="h-14 text-base" variant="default">
          <FileText className="w-5 h-5 mr-2" />
          PDF出力（印刷）
        </Button>
        <Button onClick={handleExcelExport} className="h-14 text-base" variant="outline">
          <FileSpreadsheet className="w-5 h-5 mr-2" />
          Excel出力
        </Button>
      </div>

      {/* 社内用粗利サマリー */}
      {materials.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg">
          <div className="font-bold text-sm mb-2">📊 社内用サマリー（帳票には含まれません）</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>工賃合計:</div>
            <div className="text-right font-semibold">
              ¥{lines.filter((l) => l.category === "作業費").reduce((s, l) => s + l.amount, 0).toLocaleString()}
            </div>
            <div>材料売値合計:</div>
            <div className="text-right font-semibold">
              ¥{materials.reduce((s, m) => s + m.sellingTotal, 0).toLocaleString()}
            </div>
            <div>材料仕入合計:</div>
            <div className="text-right text-red-600">
              ¥{materials.reduce((s, m) => s + m.purchaseTotal, 0).toLocaleString()}
            </div>
            <div>送料合計:</div>
            <div className="text-right text-red-600">
              ¥{materials.reduce((s, m) => s + m.shippingFee, 0).toLocaleString()}
            </div>
            <div className="font-bold border-t pt-1">材料粗利:</div>
            <div className="text-right font-bold text-green-600 border-t pt-1">
              ¥{(materials.reduce((s, m) => s + m.sellingTotal, 0) - materials.reduce((s, m) => s + m.purchaseTotal + m.shippingFee, 0)).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
