"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, X } from "lucide-react";
import { BasicInfo, Material, SUPPLIERS, UNIT_OPTIONS, WorkDayEntry } from "@/lib/types";
import { Product, getActiveProducts } from "@/lib/productMaster";
import { getActiveEmployees, Employee } from "@/lib/employeeMaster";
import { confirmReportCapacity, downloadReportWorkbook } from "@/lib/reportWorkbook";
import { DEFAULT_LABOR_RATES, getLaborRates, type LaborRates } from "@/lib/laborRates";

type Props = {
  basicInfo: BasicInfo;
  workDayEntries: WorkDayEntry[];
  materials: Material[];
  onMaterialsChange: (materials: Material[]) => void;
};

export default function MaterialsStep({ basicInfo, workDayEntries, materials, onMaterialsChange }: Props) {
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [productHistory, setProductHistory] = useState<string[]>([]);
  const [openSuggest, setOpenSuggest] = useState<string | null>(null);
  const [rates, setRates] = useState<LaborRates>(DEFAULT_LABOR_RATES);
  const [searchQuery, setSearchQuery] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const saved = localStorage.getItem("productHistory");
    if (!saved) return;
    queueMicrotask(() => {
      try {
        setProductHistory(JSON.parse(saved) as string[]);
      } catch {
        setProductHistory([]);
      }
    });
  }, []);

  useEffect(() => {
    getActiveProducts()
      .then(setMasterProducts)
      .catch(() => setMasterProducts([]));
    getActiveEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]));
    getLaborRates()
      .then(setRates)
      .catch(() => setRates(DEFAULT_LABOR_RATES));
  }, []);

  const addToHistory = (productName: string) => {
    if (!productName || productHistory.includes(productName)) return;
    const newHistory = [productName, ...productHistory].slice(0, 50);
    setProductHistory(newHistory);
    localStorage.setItem("productHistory", JSON.stringify(newHistory));
  };

  const addMaterial = () => {
    const newMaterial: Material = {
      id: Date.now().toString(),
      date: "",
      productName: "",
      modelType: "",
      isStock: false,
      supplier: "モノタロウ",
      quantity: 1,
      unit: "",
      purchasePrice: 0,
      purchaseTotal: 0,
      sellingPrice: 0,
      sellingTotal: 0,
      shippingFee: 0,
      carrier: "大竹",
    };
    onMaterialsChange([...materials, newMaterial]);
  };

  const removeMaterial = (id: string) => {
    onMaterialsChange(materials.filter((m) => m.id !== id));
  };

  const updateMaterial = (id: string, field: keyof Material, value: string | number | boolean) => {
    onMaterialsChange(
      materials.map((m) => {
        if (m.id !== id) return m;

        let updatedValue = value;
        if (["quantity", "purchasePrice", "sellingPrice", "shippingFee"].includes(field)) {
          updatedValue = value === "" ? 0 : Number(value);
        }

        const updated = { ...m, [field]: updatedValue };

        if (field === "quantity" || field === "purchasePrice" || field === "sellingPrice") {
          updated.purchaseTotal = Number(updated.quantity) * Number(updated.purchasePrice);
          updated.sellingTotal = Number(updated.quantity) * Number(updated.sellingPrice);
        }

        if (field === "productName" && typeof value === "string" && value) {
          addToHistory(value);
        }

        return updated;
      })
    );
  };

  const selectProduct = (materialId: string, product: Product) => {
    onMaterialsChange(
      materials.map((m) => {
        if (m.id !== materialId) return m;
        return {
          ...m,
          productName: product.name,
          modelType: product.modelType,
          supplier: product.supplier,
          unit: m.unit || product.unit || "",
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          purchaseTotal: m.quantity * product.purchasePrice,
          sellingTotal: m.quantity * product.sellingPrice,
        };
      })
    );
    addToHistory(product.name);
    setOpenSuggest(null);
    setSearchQuery((prev) => ({ ...prev, [materialId]: "" }));
  };

  const getSuggestions = (materialId: string) => {
    const query = searchQuery[materialId] || "";
    const masterMatches = masterProducts.filter(
      (p) => !query || p.name.includes(query) || p.modelType.includes(query)
    );
    const historyMatches = productHistory
      .filter((h) => !query || h.includes(query))
      .filter((h) => !masterMatches.some((p) => p.name === h));
    return { masterMatches, historyMatches };
  };

  const calculateTotals = () => {
    return materials.reduce(
      (acc, m) => ({
        purchaseTotal: acc.purchaseTotal + m.purchaseTotal,
        sellingTotal: acc.sellingTotal + m.sellingTotal,
        shippingFee: acc.shippingFee + m.shippingFee,
      }),
      { purchaseTotal: 0, sellingTotal: 0, shippingFee: 0 }
    );
  };

  const totals = calculateTotals();
  const activeWorkerNames = employees.map((e) => e.name);

  const handleExportMaterialsExcel = async () => {
    const payload = { basicInfo, workDayEntries, materials };
    if (!confirmReportCapacity(payload, "materials", activeWorkerNames)) return;
    await downloadReportWorkbook(payload, activeWorkerNames, "materials", rates);
  };

  return (
    <div className="space-y-6">
      <datalist id="material-unit-options">
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div>
        <h2 className="text-xl font-semibold mb-2">材料持出表</h2>
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
          <p>
            <strong>顧客：</strong>{basicInfo.customer} / <strong>船名：</strong>{basicInfo.shipName}
          </p>
        </div>
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={handleExportMaterialsExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            材料持出表をExcel出力
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {materials.map((material) => (
          <div key={material.id} className="border rounded-lg p-4 space-y-3 relative">
            <button
              onClick={() => removeMaterial(material.id)}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">日付</Label>
                <Input
                  type="date"
                  value={material.date}
                  onChange={(e) => updateMaterial(material.id, "date", e.target.value)}
                />
              </div>

              <div className="md:col-span-2 relative">
                <Label className="text-xs">品名（マスタから選択 or 手入力）</Label>
                <Input
                  value={openSuggest === material.id ? (searchQuery[material.id] ?? material.productName) : material.productName}
                  onChange={(e) => {
                    setSearchQuery((prev) => ({ ...prev, [material.id]: e.target.value }));
                    updateMaterial(material.id, "productName", e.target.value);
                    setOpenSuggest(material.id);
                  }}
                  onFocus={() => setOpenSuggest(material.id)}
                  onBlur={() => setTimeout(() => setOpenSuggest(null), 200)}
                  placeholder="商品名を入力（候補が表示されます）"
                />
                {openSuggest === material.id && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {(() => {
                      const { masterMatches, historyMatches } = getSuggestions(material.id);
                      return (
                        <>
                          {masterMatches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 font-semibold">製品マスタ</div>
                              {masterMatches.map((p) => (
                                <button
                                  key={p.name}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b"
                                  onMouseDown={() => selectProduct(material.id, p)}
                                >
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {p.modelType} | 仕入 ¥{p.purchasePrice.toLocaleString()} → 売値 ¥{p.sellingPrice.toLocaleString()}
                                  </div>
                                </button>
                              ))}
                            </>
                          )}
                          {historyMatches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 font-semibold">入力履歴</div>
                              {historyMatches.map((h) => (
                                <button
                                  key={h}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                                  onMouseDown={() => {
                                    updateMaterial(material.id, "productName", h);
                                    setOpenSuggest(null);
                                  }}
                                >
                                  {h}
                                </button>
                              ))}
                            </>
                          )}
                          {masterMatches.length === 0 && historyMatches.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400">該当なし（そのまま手入力できます）</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">型式</Label>
                <Input
                  value={material.modelType}
                  onChange={(e) => updateMaterial(material.id, "modelType", e.target.value)}
                  placeholder="型式"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`stock-${material.id}`}
                  checked={material.isStock}
                  onChange={(e) => updateMaterial(material.id, "isStock", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor={`stock-${material.id}`} className="text-xs">在庫</Label>
              </div>

              <div>
                <Label className="text-xs">仕入先</Label>
                <select
                  value={material.supplier}
                  onChange={(e) => updateMaterial(material.id, "supplier", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  {SUPPLIERS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">数量</Label>
                <Input
                  type="number"
                  value={material.quantity || ""}
                  onChange={(e) => updateMaterial(material.id, "quantity", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
              </div>

              <div>
                <Label className="text-xs">単位</Label>
                <Input
                  list="material-unit-options"
                  value={material.unit ?? ""}
                  onChange={(e) => updateMaterial(material.id, "unit", e.target.value)}
                  placeholder="本・個・式 など"
                />
              </div>

              <div>
                <Label className="text-xs">仕入単価</Label>
                <Input
                  type="number"
                  value={material.purchasePrice || ""}
                  onChange={(e) => updateMaterial(material.id, "purchasePrice", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
              </div>

              <div>
                <Label className="text-xs">仕入合計</Label>
                <Input type="number" value={material.purchaseTotal} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label className="text-xs">売値単価</Label>
                <Input
                  type="number"
                  value={material.sellingPrice || ""}
                  onChange={(e) => updateMaterial(material.id, "sellingPrice", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
              </div>

              <div>
                <Label className="text-xs">売値合計</Label>
                <Input type="number" value={material.sellingTotal} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label className="text-xs">送料</Label>
                <Input
                  type="number"
                  value={material.shippingFee || ""}
                  onChange={(e) => updateMaterial(material.id, "shippingFee", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  min="0"
                />
              </div>
            </div>
          </div>
        ))}

        {materials.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            下の「+ 材料追加」から材料を追加してください
          </div>
        )}

        <div className="flex justify-start pt-1">
          <Button type="button" onClick={addMaterial} className="w-full sm:w-auto">
            + 材料追加
          </Button>
        </div>
      </div>

      {materials.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>仕入合計:</span>
            <span className="font-semibold">¥{totals.purchaseTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>売値合計:</span>
            <span className="font-semibold">¥{totals.sellingTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>送料合計:</span>
            <span className="font-semibold">¥{totals.shippingFee.toLocaleString()}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-lg font-bold">
            <span>粗利:</span>
            <span className="text-green-600">
              ¥{(totals.sellingTotal - totals.purchaseTotal - totals.shippingFee).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p>💡 ヒント：品名欄をタップすると製品マスタから選択できます。単価は自動入力され、手動で変更も可能です。</p>
      </div>
    </div>
  );
}
