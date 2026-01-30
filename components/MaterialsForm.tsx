"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
const CUSTOMERS = ["東海汽船", "清水港運", "焼津漁協", "鈴与海運", "その他"];

export default function MaterialsForm() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customer, setCustomer] = useState("");
  const [shipName, setShipName] = useState("");
  const [category, setCategory] = useState("");
  const [modelName, setModelName] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  
  // LocalStorageから商品名履歴を取得
  const [productHistory, setProductHistory] = useState<string[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem("productHistory");
    if (saved) {
      setProductHistory(JSON.parse(saved));
    }
  }, []);

  // 商品名履歴を保存
  const addToHistory = (productName: string) => {
    if (!productName || productHistory.includes(productName)) return;
    const newHistory = [productName, ...productHistory].slice(0, 50); // 最大50件
    setProductHistory(newHistory);
    localStorage.setItem("productHistory", JSON.stringify(newHistory));
  };

  // 材料行を追加
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

  // 材料行を削除
  const removeMaterial = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  // 材料データ更新
  const updateMaterial = (id: string, field: keyof Material, value: any) => {
    setMaterials(materials.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // 自動計算
      if (field === "quantity" || field === "purchasePrice") {
        updated.purchaseTotal = updated.quantity * updated.purchasePrice;
      }
      if (field === "quantity" || field === "sellingPrice") {
        updated.sellingTotal = updated.quantity * updated.sellingPrice;
      }
      
      // 商品名が確定したら履歴に追加
      if (field === "productName" && value) {
        addToHistory(value);
      }
      
      return updated;
    }));
  };

  // 合計計算
  const calculateTotals = () => {
    return materials.reduce((acc, m) => ({
      purchaseTotal: acc.purchaseTotal + m.purchaseTotal,
      sellingTotal: acc.sellingTotal + m.sellingTotal,
      shippingFee: acc.shippingFee + m.shippingFee,
    }), { purchaseTotal: 0, sellingTotal: 0, shippingFee: 0 });
  };

  const totals = calculateTotals();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* ヘッダー情報 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customer">顧客名</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="顧客を選択" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMERS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="shipName">船名</Label>
            <Input
              id="shipName"
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
              placeholder="船名を入力"
            />
          </div>
          <div>
            <Label htmlFor="category">科目</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="科目を入力"
            />
          </div>
          <div>
            <Label htmlFor="modelName">型名</Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="型名を入力"
            />
          </div>
          <div>
            <Label htmlFor="completionDate">完成月日</Label>
            <Input
              id="completionDate"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 材料一覧 */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold border-b pb-2">材料持出表</h2>
          <Button onClick={addMaterial}>+ 材料追加</Button>
        </div>

        <div className="space-y-4">
          {materials.map((material) => (
            <div key={material.id} className="border rounded-lg p-4 space-y-3 relative">
              {/* 削除ボタン */}
              <button
                onClick={() => removeMaterial(material.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 日付 */}
                <div>
                  <Label className="text-xs">日付</Label>
                  <Input
                    type="date"
                    value={material.date}
                    onChange={(e) => updateMaterial(material.id, "date", e.target.value)}
                  />
                </div>

                {/* 商品名（履歴学習型Combobox） */}
                <div className="md:col-span-2">
                  <Label className="text-xs">品名（履歴から選択可能）</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {material.productName || "商品を選択または入力..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput 
                          placeholder="商品名を検索..." 
                          onValueChange={(value) => updateMaterial(material.id, "productName", value)}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2 text-sm text-gray-500">
                              入力して新規追加
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="履歴">
                            {productHistory.map((product) => (
                              <CommandItem
                                key={product}
                                value={product}
                                onSelect={(value) => {
                                  updateMaterial(material.id, "productName", value);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    material.productName === product ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {product}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {/* 直接入力用のフォールバック */}
                  <Input
                    className="mt-2"
                    value={material.productName}
                    onChange={(e) => updateMaterial(material.id, "productName", e.target.value)}
                    placeholder="または直接入力"
                  />
                </div>

                {/* 型式 */}
                <div>
                  <Label className="text-xs">型式</Label>
                  <Input
                    value={material.modelType}
                    onChange={(e) => updateMaterial(material.id, "modelType", e.target.value)}
                    placeholder="型式"
                  />
                </div>

                {/* 在庫/仕入先 */}
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
                    {SUPPLIERS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 数量・単価 */}
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
                  <Input
                    type="number"
                    value={material.purchaseTotal}
                    readOnly
                    className="bg-gray-50"
                  />
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
                  <Input
                    type="number"
                    value={material.sellingTotal}
                    readOnly
                    className="bg-gray-50"
                  />
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
            <div className="text-center py-8 text-gray-500">
              「+ 材料追加」ボタンで材料を追加してください
            </div>
          )}
        </div>
      </div>

      {/* 合計 */}
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

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => alert("保存機能は実装予定です")}>
          保存
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => alert("PDF出力機能は実装予定です")}>
          PDF出力
        </Button>
      </div>
    </div>
  );
}
