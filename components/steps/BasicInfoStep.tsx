"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CUSTOMERS = ["東海汽船", "清水港運", "焼津漁協", "鈴与海運", "その他"];

type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  completionDate: string;
};

type Props = {
  basicInfo: BasicInfo;
  setBasicInfo: (info: BasicInfo) => void;
};

export default function BasicInfoStep({ basicInfo, setBasicInfo }: Props) {
  const updateField = (field: keyof BasicInfo, value: string) => {
    setBasicInfo({ ...basicInfo, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">基本情報を入力してください</h2>
        <p className="text-sm text-gray-600 mb-6">
          この情報は作業報告書と材料持出表の両方で使用されます
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customer">
            顧客名 <span className="text-red-500">*</span>
          </Label>
          <Select value={basicInfo.customer} onValueChange={(value) => updateField("customer", value)}>
            <SelectTrigger>
              <SelectValue placeholder="顧客を選択" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="shipName">
            船名 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="shipName"
            value={basicInfo.shipName}
            onChange={(e) => updateField("shipName", e.target.value)}
            placeholder="船名を入力"
          />
        </div>

        <div>
          <Label htmlFor="category">科目</Label>
          <Input
            id="category"
            value={basicInfo.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="科目を入力"
          />
        </div>

        <div>
          <Label htmlFor="modelName">型名</Label>
          <Input
            id="modelName"
            value={basicInfo.modelName}
            onChange={(e) => updateField("modelName", e.target.value)}
            placeholder="型名を入力"
          />
        </div>

        <div>
          <Label htmlFor="completionDate">完成月日</Label>
          <Input
            id="completionDate"
            type="date"
            value={basicInfo.completionDate}
            onChange={(e) => updateField("completionDate", e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p>💡 ヒント：顧客名と船名は必須項目です。入力後、「次へ」ボタンで進んでください。</p>
      </div>
    </div>
  );
}
