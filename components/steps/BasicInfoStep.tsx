"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BasicInfo } from "@/lib/types";
import {
  getActiveCustomers,
  Customer,
  CUSTOMER_OTHER_NAME,
} from "@/lib/customerMaster";

/** マスタに無い顧客名を直接入力するモード */
const MANUAL_VALUE = "__manual__";

type Props = {
  basicInfo: BasicInfo;
  setBasicInfo: (info: BasicInfo) => void;
};

export default function BasicInfoStep({ basicInfo, setBasicInfo }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  /** 「その他」を選んだ直後は true（正式名入力欄を出す） */
  const [pickedOther, setPickedOther] = useState(false);

  useEffect(() => {
    getActiveCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  const names = useMemo(() => customers.map((c) => c.name), [customers]);
  const hasOtherRow = names.includes(CUSTOMER_OTHER_NAME);

  const selectValue = useMemo(() => {
    const c = basicInfo.customer;
    if (!c) {
      if (pickedOther && hasOtherRow) return CUSTOMER_OTHER_NAME;
      return "";
    }
    if (names.includes(c)) return c;
    return MANUAL_VALUE;
  }, [basicInfo.customer, names, pickedOther, hasOtherRow]);

  const showFreeNameInput =
    selectValue === MANUAL_VALUE ||
    (hasOtherRow && pickedOther && basicInfo.customer === "") ||
    (hasOtherRow && selectValue === CUSTOMER_OTHER_NAME && basicInfo.customer === "");

  const updateField = (field: keyof BasicInfo, value: string) => {
    setBasicInfo({ ...basicInfo, [field]: value });
  };

  const handleCustomerSelect = (value: string) => {
    if (value === MANUAL_VALUE) {
      updateField("customer", "");
      setPickedOther(false);
      return;
    }
    if (value === CUSTOMER_OTHER_NAME) {
      updateField("customer", "");
      setPickedOther(true);
      return;
    }
    setPickedOther(false);
    updateField("customer", value);
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
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="customer">
            顧客名 <span className="text-red-500">*</span>
          </Label>
          <Select value={selectValue || undefined} onValueChange={handleCustomerSelect}>
            <SelectTrigger id="customer">
              <SelectValue placeholder="顧客を選択" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
              {basicInfo.customer && !names.includes(basicInfo.customer) && (
                <SelectItem value={MANUAL_VALUE}>手入力（マスタ未登録）</SelectItem>
              )}
            </SelectContent>
          </Select>
          {showFreeNameInput && (
            <div>
              <Label className="text-xs text-gray-600">
                {pickedOther || selectValue === CUSTOMER_OTHER_NAME
                  ? "正式な顧客名を入力してください（帳票に印字されます）"
                  : "顧客名を入力してください"}
              </Label>
              <Input
                value={basicInfo.customer}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField("customer", v);
                  if (pickedOther && v) setPickedOther(false);
                }}
                placeholder="例：○○海運株式会社"
                className="mt-1"
              />
            </div>
          )}
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
          <Label htmlFor="manufacturer">製造者</Label>
          <Input
            id="manufacturer"
            value={basicInfo.manufacturer}
            onChange={(e) => updateField("manufacturer", e.target.value)}
            placeholder="例：古野電気、JRC"
          />
        </div>

        <div>
          <Label htmlFor="receptionDate">受付日</Label>
          <Input
            id="receptionDate"
            type="date"
            value={basicInfo.receptionDate}
            onChange={(e) => updateField("receptionDate", e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p>
          ヒント：顧客名と船名は必須です。「その他」の場合は、続けて正式名称を入力してください。マスタ未登録の場合は一覧から「手入力」を選びます。
        </p>
      </div>
    </div>
  );
}
