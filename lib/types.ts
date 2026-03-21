export type Worker = "大竹" | "豊島" | "鈴木" | "内田" | "新人";

export type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  manufacturer: string;
  receptionDate: string;
};

export type TimeRange = {
  start: string;
  end: string;
};

/** 1日の中の時間ブロック（複数追加可） */
export type TimeBlockKind = "travel" | "break" | "regular" | "overtime" | "holiday";

export type TimeBlock = {
  id: string;
  kind: TimeBlockKind;
  start: string;
  end: string;
};

export const TIME_BLOCK_LABELS: Record<TimeBlockKind, string> = {
  travel: "移動",
  break: "休憩",
  regular: "作業内（平日）",
  overtime: "作業外（平日）",
  holiday: "休日",
};

export type WorkDayEntry = {
  id: string;
  date: string;
  worker: Worker;
  location: string;
  workContent: string;
  /** 時系列で複数追加。旧データは読み込み時に migrate される */
  blocks: TimeBlock[];
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

export const WORKERS: Worker[] = ["大竹", "豊島", "鈴木", "内田", "新人"];

export type CaseStatus = "draft" | "materials_added" | "invoiced";

export type ShipCase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: CaseStatus;
  basicInfo: BasicInfo;
  selectedWorkers: Worker[];
  workDayEntries: WorkDayEntry[];
  materials: Material[];
};

export const CASES_STORAGE_KEY = "fit_ship_cases";

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
