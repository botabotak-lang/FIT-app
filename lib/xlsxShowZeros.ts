import * as XLSX from "xlsx";

/**
 * 出力ファイルで「ゼロ値を表示しない」（sheetView showZeros="0"）を有効にする。
 *
 * テンプレートには showZeros="0" が入っているが、ExcelJS 4.4 は sheetView のこの属性を
 * 読みも書きもしない（lib/xlsx/xform/sheet/sheet-view-xform.js）。そのため
 * worksheet.views に showZeros: false を設定しても出力ファイルからは消えてしまい、
 * 0:00・¥0・0 が印字される。
 *
 * 対処として、ExcelJS が書き出した xlsx（ZIP）を開き直し、各ワークシートXMLの
 * <sheetView> に showZeros="0" を付け直す。ZIP の読み書きは既存依存（SheetJS）の
 * CFB を使う（新規依存なし・ブラウザでも動作）。
 */

/** xl/worksheets/sheet1.xml など（_rels 配下は対象外） */
const SHEET_XML_PATH = /^xl\/worksheets\/sheet\d+\.xml$/;

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy;
  }
  return new Uint8Array(data);
}

export function disableShowZeros(workbookData: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = toUint8Array(workbookData);
  const cfb = XLSX.CFB.read(bytes, { type: "array" });
  const root: string = cfb.FullPaths[0];
  let patched = 0;
  cfb.FullPaths.forEach((fullPath: string, index: number) => {
    const entry = cfb.FileIndex[index];
    if (!entry || !entry.content) return;
    if (!SHEET_XML_PATH.test(fullPath.slice(root.length))) return;
    const xml = new TextDecoder().decode(toUint8Array(entry.content));
    // 既に showZeros が入っているファイルは触らない
    if (!xml.includes("<sheetView ") || xml.includes("showZeros=")) return;
    const encoded = new TextEncoder().encode(
      xml.replace(/<sheetView /g, '<sheetView showZeros="0" ')
    );
    entry.content = encoded;
    entry.size = encoded.length;
    patched += 1;
  });
  if (patched === 0) return bytes;
  return XLSX.CFB.write(cfb, {
    fileType: "zip",
    type: "array",
    compression: true,
  }) as Uint8Array<ArrayBuffer>;
}
