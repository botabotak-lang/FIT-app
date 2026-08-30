/**
 * 文字列の部分一致検索の共通ロジック。
 * 材料入力の品名ピッカーと製品マスタ画面の検索窓で同じ挙動にするため、
 * 正規化と一致判定はこのファイルだけに置く。
 */

/**
 * 検索用のキー。NFKC で全角英数→半角・半角カナ→全角カナに揃え、
 * 空白を除去して小文字化する。表示や保存には使わない。
 */
export function searchKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

/**
 * 入力文字列をスペース区切りの検索語に分解して正規化する。
 * 例: "大阪魂 M6" → ["大阪魂", "m6"]
 */
export function searchTerms(query: unknown): string[] {
  return String(query ?? "")
    .split(/[\s　]+/)
    .map(searchKey)
    .filter(Boolean);
}

/**
 * 与えた項目のいずれかに検索語が含まれるかを、語ごとに AND で判定する。
 * 語が0個（＝検索していない）ときは常に true。
 */
export function matchesAllTerms(
  fields: readonly (string | null | undefined)[],
  terms: readonly string[]
): boolean {
  if (terms.length === 0) return true;
  const keys = fields.map(searchKey).filter(Boolean);
  if (keys.length === 0) return false;
  return terms.every((term) => keys.some((key) => key.includes(term)));
}
