"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  completionDate: string;
};

type Material = {
  id: string;
  date: string;
  productName: string;
  modelType: string;
  isStock: boolean;
  supplier: string;
  quantity: number;
  purchasePrice: number;
  purchaseTotal: number;
  sellingPrice: number;
  sellingTotal: number;
  shippingFee: number;
  carrier: string;
};

const SUPPLIERS = ["モノタロウ", "アマゾン", "ハートストック", "JRC", "その他"];

type Props = {
  basicInfo: BasicInfo;
};

export default function MaterialsStep({ basicInfo }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productHistory, setProductHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("productHistory");
    if (saved) {
      setProductHistory(JSON.parse(saved));
    }
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
      purchasePrice: 0,
      purchaseTotal: 0,
      sellingPrice: 0,
      sellingTotal: 0,
      shippingFee: 0,
      carrier: "大竹",
    };
    setMaterials([...materials, newMaterial]);
  };

  const removeMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  const updateMaterial = (id: string, field: keyof Material, value: any) => {
    setMaterials(
      materials.map((m) => {
        if (m.id !== id) return m;

        const updated = { ...m, [field]: value };

        if (field === "quantity" || field === "purchasePrice") {
          updated.purchaseTotal = updated.quantity * updated.purchasePrice;
        }
        if (field === "quantity" || field === "sellingPrice") {
          updated.sellingTotal = updated.quantity * updated.sellingPrice;
        }

        if (field === "productName" && value) {
          addToHistory(value);
        }

        return updated;
      })
    );
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">材料持出表</h2>
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
          <p>
            <strong>顧客：</strong>{basicInfo.customer} / <strong>船名：</strong>{basicInfo.shipName}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Button onClick={addMaterial}>+ 材料追加</Button>
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

              <div className="md:col-span-2">
                <Label className="text-xs">品名（履歴から選択可能）</Label>
                <Input
                  value={material.productName}
                  onChange={(e) => updateMaterial(material.id, "productName", e.target.value)}
                  placeholder="商品名を入力"
                />
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
                <Label htmlFor={`stock-${material.id}`} className="text-xs">
                  在庫
                </Label>
              </div>

              <div>
                <Label className="text-xs">仕入先</Label>
                <select
                  value={material.supplier}
                  onChange={(e) => updateMaterial(material.id, "supplier", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  {SUPPLIERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">数量</Label>
                <Input
                  type="number"
                  value={material.quantity}
                  onChange={(e) => updateMaterial(material.id, "quantity", Number(e.target.value))}
                  min="0"
                />
              </div>

              <div>
                <Label className="text-xs">仕入単価</Label>
                <Input
                  type="number"
                  value={material.purchasePrice}
                  onChange={(e) => updateMaterial(material.id, "purchasePrice", Number(e.target.value))}
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
                  value={material.sellingPrice}
                  onChange={(e) => updateMaterial(material.id, "sellingPrice", Number(e.target.value))}
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
                  value={material.shippingFee}
                  onChange={(e) => updateMaterial(material.id, "shippingFee", Number(e.target.value))}
                  min="0"
                />
              </div>
            </div>
          </div>
        ))}

        {materials.length === 0 && (
          <div className="text-center py-8 text-gray-500">「+ 材料追加」ボタンで材料を追加してください</div>
        )}
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
        <p>💡 ヒント：材料の入力も任意です。入力が完了したら「保存して完了」ボタンで終了してください。</p>
      </div>
    </div>
  );
}
