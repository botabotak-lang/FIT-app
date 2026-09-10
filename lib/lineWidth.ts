/**
 * 作業内容の「1行の長さ」を全角文字数に換算して判定するための純関数群。
 *
 * 背景：Excel出力は「入力欄の改行1つ＝報告書の1行・自動折返しなし」の仕様のため、
 * 1行が全角約50文字を超えると印刷時に右端が切れる。入力中に気づけるよう、
 * ここで幅を計算して超過行を返す。UIに依存しないのでそのまま単体テストできる。
 */

/** 1行あたりの上限（全角換算の文字数） */
export const DEFAULT_LINE_LIMIT = 50;

/**
 * 1文字の幅を全角換算で返す。
 * - ASCII（U+0020〜U+007E など U+0000〜U+007F）… 0.5
 * - 半角カナ（U+FF61〜U+FF9F）… 0.5
 * - それ以外（全角かな・漢字・全角記号・絵文字など）… 1
 *
 * 絵文字などサロゲートペアで表される文字は、呼び出し側が [...line] で
 * コードポイント単位に分解するため、1文字＝1としてカウントされる。
 */
function charWidth(char: string): number {
  const code = char.codePointAt(0);
  if (code === undefined) return 0;
  if (code <= 0x7f) return 0.5; // ASCII（制御文字を含む）
  if (code >= 0xff61 && code <= 0xff9f) return 0.5; // 半角カナ
  return 1;
}

/**
 * 1行分の文字列の幅を全角換算で返す。
 * サロゲートペア（絵文字など）を1文字として数えるため [...line] で走査する。
 * 改行を含む文字列を渡した場合、改行自体は幅0として扱う。
 */
export function zenkakuWidth(line: string): number {
  if (!line) return 0;
  let width = 0;
  for (const char of [...line]) {
    if (char === "\n" || char === "\r") continue;
    width += charWidth(char);
  }
  return width;
}

/**
 * 複数行テキストのうち、幅が limit を超えている行を返す。
 *
 * @param text  入力欄の値（改行区切り）。null/undefined でも例外を投げない。
 * @param limit 全角換算の上限。既定 50。
 * @returns 超過行の配列。index は 0 始まりの行番号（表示時は +1 して「◯行目」にする）。
 */
export function overLimitLines(
  text: string,
  limit: number = DEFAULT_LINE_LIMIT
): { index: number; width: number }[] {
  const source = typeof text === "string" ? text : String(text ?? "");
  if (!source) return [];
  const result: { index: number; width: number }[] = [];
  const lines = source.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const width = zenkakuWidth(lines[i]);
    if (width > limit) result.push({ index: i, width });
  }
  return result;
}

/**
 * 超過行の警告文を組み立てる。超過が無いときは null。
 * - 1行：「⚠ 3行目が全角50文字を超えています（現在52文字）。Enterで改行してください」
 * - 2行：「⚠ 1行目・3行目が全角50文字を超えています。Enterで改行してください」
 * - 3行以上：「⚠ 1行目 ほか2行が全角50文字を超えています。Enterで改行してください」
 */
export function overLimitMessage(
  over: readonly { index: number; width: number }[],
  limit: number = DEFAULT_LINE_LIMIT
): string | null {
  if (over.length === 0) return null;
  const suffix = `が全角${limit}文字を超えています`;
  if (over.length === 1) {
    const { index, width } = over[0];
    return `⚠ ${index + 1}行目${suffix}（現在${Math.round(width)}文字）。Enterで改行してください`;
  }
  if (over.length === 2) {
    const labels = over.map((o) => `${o.index + 1}行目`).join("・");
    return `⚠ ${labels}${suffix}。Enterで改行してください`;
  }
  return `⚠ ${over[0].index + 1}行目 ほか${over.length - 1}行${suffix}。Enterで改行してください`;
}
