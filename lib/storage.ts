import { ShipCase, CASES_STORAGE_KEY } from "./types";
import { normalizeShipCase } from "./workDayEntry";

export function getCases(): ShipCase[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CASES_STORAGE_KEY);
  const parsed: ShipCase[] = raw ? JSON.parse(raw) : [];
  return parsed.map(normalizeShipCase);
}

export function getCaseById(id: string): ShipCase | undefined {
  return getCases().find((c) => c.id === id);
}

export function saveCase(c: ShipCase): void {
  const cases = getCases().filter((x) => x.id !== c.id);
  localStorage.setItem(
    CASES_STORAGE_KEY,
    JSON.stringify([...cases, { ...c, updatedAt: new Date().toISOString() }])
  );
}

export function deleteCase(id: string): void {
  const cases = getCases().filter((c) => c.id !== id);
  localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
}

export function getExistingShipNames(): string[] {
  const cases = getCases();
  const names = [...new Set(cases.map((c) => c.basicInfo.shipName).filter(Boolean))];
  return names.sort();
}
