/** 作業者名（社員マスタと一致させる。旧データは任意文字列のまま） */
export type Worker = string;

export type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  manufacturer: string;
  receptionDate: string;
  /** 完成日（"YYYY-MM-DD" または ""）。材料持出表 AX1「完成月日」に出力する。旧データは "" */
  completionDate: string;
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
  /** 複数作業者対応。旧データは読み込み時に worker(string) → workers([]) へ migrate される */
  workers: Worker[];
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
  /** 単位（本・個・袋 等。旧データは ""） */
  unit: string;
  purchasePrice: number;
  purchaseTotal: number;
  sellingPrice: number;
  sellingTotal: number;
  shippingFee: number;
  carrier: string;
};

export type DocumentType = "estimate" | "invoice";

/** 工賃単価は app_settings（lib/laborRates.ts）で管理する */

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

/** 単位の入力候補（自由入力も可） */
export const UNIT_OPTIONS = ["本", "個", "袋", "m", "台", "式", "セット", "巻", "箱"];

export const COMPANY_INFO = {
  name: "株式会社エフアイティ",
  zipCode: "〒425-0000",
  address: "静岡県焼津市○○町○-○-○",
  tel: "054-XXX-XXXX",
  fax: "054-XXX-XXXX",
  bankInfo: "○○銀行 ○○支店 普通 XXXXXXX",
  representative: "豊島 ○○",
};
