export type Worker = "大竹" | "豊島" | "鈴木" | "内田" | "新人";
export type TimeCategory = "regular" | "overtime" | "holiday" | "travel";

export type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  completionDate: string;
};

export type TimeSlot = {
  startTime: string;
  endTime: string;
  category: TimeCategory;
};

export type WorkerTimes = {
  [key in Worker]?: TimeSlot[];
};

export type Material = {
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

export type DocumentType = "estimate" | "invoice";

export const REGULAR_RATE = 7000;
export const HOLIDAY_RATE = 8400;
export const TRAVEL_RATE = 0.8;

export const TIME_CATEGORY_LABELS: { [key in TimeCategory]: string } = {
  regular: "時間内",
  overtime: "時間外",
  holiday: "休日",
  travel: "移動",
};

export const WORKERS: Worker[] = ["大竹", "豊島", "鈴木", "内田", "新人"];

export const SUPPLIERS = ["モノタロウ", "アマゾン", "ハードストック", "JRC", "その他"];

export const COMPANY_INFO = {
  name: "株式会社エフアイティ",
  zipCode: "〒425-0000",
  address: "静岡県焼津市○○町○-○-○",
  tel: "054-XXX-XXXX",
  fax: "054-XXX-XXXX",
  bankInfo: "○○銀行 ○○支店 普通 XXXXXXX",
  representative: "豊島 ○○",
};
