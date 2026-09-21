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

/**
 * 顧客名 → その顧客の工賃単価。null は「個別設定なし＝全体設定を使う」。
 * 全体設定キャッシュ（cached）とは別物なので、全体設定を保存したときは
 * こちらも必ずクリアする（全体設定にぶら下がっている顧客が古い値を返すため）。
 */
const cachedByCustomer = new Map<string, LaborRates | null>();

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
  // 個別設定なしの顧客は全体設定を写している。古い値が残らないよう捨てる
  cachedByCustomer.clear();
  return next;
}

/**
 * customers.labor_rates を1件だけ読む。
 * 返り値：LaborRates=個別設定あり ／ null=個別設定なし ／ undefined=取得できず（列未適用・通信エラー等）
 */
async function fetchCustomerLaborRates(
  name: string
): Promise<LaborRates | null | undefined> {
  try {
    // 同名の顧客が複数あっても落ちないよう limit(1)。maybeSingle は使わない
    const { data, error } = await supabase
      .from("customers")
      .select("labor_rates")
      .eq("name", name)
      .limit(1);

    // labor_rates 列が未適用のDB（Phase E の SQL 未実行）でもここで止まらない
    if (error) {
      console.warn("顧客別の工賃単価を取得できないため全体設定を使います:", error.message);
      return undefined;
    }
    const row = (data ?? [])[0] as { labor_rates?: unknown } | undefined;
    // 顧客が見つからない（手入力の請求先など）＝個別設定なし
    if (!row) return null;
    const value = row.labor_rates;
    return value == null ? null : normalizeLaborRates(value);
  } catch (e) {
    console.warn("顧客別の工賃単価を取得できないため全体設定を使います:", e);
    return undefined;
  }
}

/**
 * 請求先ごとの工賃単価を取得する。個別設定が無ければ全体設定にフォールバックする。
 * 顧客名が空、顧客が見つからない、列が未適用、いずれの場合も従来どおり全体設定で動く。
 */
export async function getLaborRatesForCustomer(
  customerName: string
): Promise<LaborRates> {
  const key = (customerName ?? "").trim();
  if (!key) return getLaborRates();

  if (!cachedByCustomer.has(key)) {
    const own = await fetchCustomerLaborRates(key);
    // 取得できなかったときはキャッシュしない（次回あらためて取りにいく）
    if (own !== undefined) cachedByCustomer.set(key, own);
  }
  return cachedByCustomer.get(key) ?? (await getLaborRates());
}

/** 顧客マスタを更新したとき用（顧客名の変更もあるので全件捨てる） */
export function clearCustomerLaborRatesCache(): void {
  cachedByCustomer.clear();
}

/** テスト・再読み込み用 */
export function clearLaborRatesCache(): void {
  cached = null;
  cachedByCustomer.clear();
}
