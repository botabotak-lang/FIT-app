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

/**
 * 仕入先の入力候補（自由入力も可）。
 * 原本「材料持出表」の仕入先リストに合わせた既定値。ここに無い仕入先も
 * そのまま保存できる（一括取込は whitelist で潰さない）。
 */
export const SUPPLIERS = [
  "モノタロウ",
  "アマゾン",
  "ハードストック",
  "JRC",
  "神田エレクトロニクス",
  "大野電子",
  "緑星社",
  "三菱電機特機システム㈱",
  "エンチョー",
  "RS",
  "マルツ",
  "エディオン",
  "K'sデンキ",
  "カーマ",
];

/**
 * 仕入先の表記ゆれ正規化テーブル（正式名 → その表記ゆれ）。
 * 大文字小文字・全角半角・半角カナ・空白の差は `supplierKey()` が吸収するので、
 * ここには「別の綴り」だけを書けばよい。
 */
const SUPPLIER_ALIASES: Record<string, string[]> = {
  モノタロウ: ["MonotaRO", "モノタロー"],
  アマゾン: ["Amazon", "ｱﾏｿﾞﾝ"],
  ハードストック: ["ﾊｰﾄﾞｽﾄｯｸ", "ハートストック"],
  JRC: ["ＪＲＣ"],
};

/** 仕入先名の最大長。既定リストに無い値をそのまま保存するときの安全弁 */
const SUPPLIER_MAX_LENGTH = 100;

/**
 * 比較用のキー。NFKC で全角英数→半角・半角カナ→全角カナ（濁点も合成）に揃え、
 * 空白を除去して小文字化する。表示や保存には使わない。
 */
function supplierKey(value: string): string {
  return value.normalize("NFKC").replace(/[\s　]/g, "").toLowerCase();
}

const SUPPLIER_CANONICAL_BY_KEY: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const name of SUPPLIERS) map.set(supplierKey(name), name);
  for (const [canonical, aliases] of Object.entries(SUPPLIER_ALIASES)) {
    for (const alias of aliases) map.set(supplierKey(alias), canonical);
  }
  return map;
})();

/**
 * 仕入先の表記を正規化する。既定リスト・別名に一致すれば正式名に寄せ、
 * 一致しなければ trim しただけの文字列をそのまま返す（取込で切り捨てない）。
 */
export function normalizeSupplier(raw: unknown): string {
  const cleaned = String(raw ?? "")
    // 改行・制御文字はセルの都合で紛れ込むだけなので空白に潰す
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  if (!cleaned) return "";
  const canonical = SUPPLIER_CANONICAL_BY_KEY.get(supplierKey(cleaned));
  if (canonical) return canonical;
  // 既定リストに無い仕入先もそのまま保存するが、異常に長い値は切り詰める
  return cleaned.slice(0, SUPPLIER_MAX_LENGTH);
}

/** 既定リスト＋登録済みデータの仕入先を、重複なしで候補リストにまとめる */
export function buildSupplierOptions(extra: Iterable<string> = []): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const raw of [...SUPPLIERS, ...extra]) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push(value);
  }
  return options;
}

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
