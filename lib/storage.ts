import { ShipCase, CASES_STORAGE_KEY } from "./types";
import { normalizeShipCase } from "./workDayEntry";

/** ブラウザにのみ保存された旧データ（クラウド取り込み用） */
export function getCasesFromLocalStorage(): ShipCase[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CASES_STORAGE_KEY);
  const parsed: ShipCase[] = raw ? JSON.parse(raw) : [];
  return parsed.map(normalizeShipCase);
}

export function clearCasesLocalStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CASES_STORAGE_KEY);
}
