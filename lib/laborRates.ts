import { supabase } from "./supabase";

/** 工賃単価。移動費は regular × travelFactor（円/h） */
export type LaborRates = {
  regular: number;
  holiday: number;
  travelFactor: number;
};

/** app_settings が未適用・未設定のときに使う既定値（原本Excelの数式と同じ） */
export const DEFAULT_LABOR_RATES: LaborRates = {
  regular: 7000,
  holiday: 8400,
  travelFactor: 0.8,
};

const SETTINGS_TABLE = "app_settings";
const LABOR_RATES_KEY = "labor_rates";

let cached: LaborRates | null = null;

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function normalizeLaborRates(value: unknown): LaborRates {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    regular: toPositiveNumber(v.regular, DEFAULT_LABOR_RATES.regular),
    holiday: toPositiveNumber(v.holiday, DEFAULT_LABOR_RATES.holiday),
    travelFactor: toPositiveNumber(v.travelFactor, DEFAULT_LABOR_RATES.travelFactor),
  };
}

/** 移動費の時間単価（円/h・原本の 5,600 円 = 7,000 × 0.8 に相当） */
export function travelHourlyRate(rates: LaborRates): number {
  return Math.round(rates.regular * rates.travelFactor);
}

/**
 * 工賃単価を取得。テーブル未作成・行なし・エラーのいずれでも既定値を返す
 * （DB未適用でも画面が壊れないようにする）。成功時のみキャッシュする。
 */
export async function getLaborRates(): Promise<LaborRates> {
  if (cached) return cached;
  try {
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .select("value")
      .eq("key", LABOR_RATES_KEY)
      .maybeSingle();

    if (error) {
      console.warn("工賃単価を取得できないため既定値を使います:", error.message);
      return DEFAULT_LABOR_RATES;
    }
    if (!data) return DEFAULT_LABOR_RATES;

    cached = normalizeLaborRates((data as { value: unknown }).value);
    return cached;
  } catch (e) {
    console.warn("工賃単価を取得できないため既定値を使います:", e);
    return DEFAULT_LABOR_RATES;
  }
}

/** 工賃単価を保存し、キャッシュを更新する */
export async function saveLaborRates(rates: LaborRates): Promise<LaborRates> {
  const next = normalizeLaborRates(rates);
  const { error } = await supabase.from(SETTINGS_TABLE).upsert(
    {
      key: LABOR_RATES_KEY,
      value: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(`工賃単価の保存に失敗しました: ${error.message}`);
  cached = next;
  return next;
}

/** テスト・再読み込み用 */
export function clearLaborRatesCache(): void {
  cached = null;
}
