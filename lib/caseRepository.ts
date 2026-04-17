import { supabase } from "./supabase";
import type { ShipCase } from "./types";
import { normalizeShipCase } from "./workDayEntry";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return Boolean(url.trim() && key.trim());
}

type ShipCaseRow = {
  id: string;
  payload: ShipCase;
  updated_at: string;
};

function rowToShipCase(row: ShipCaseRow): ShipCase {
  const p = row.payload as ShipCase;
  return normalizeShipCase({
    ...p,
    id: row.id,
  });
}

export async function listCases(): Promise<ShipCase[]> {
  const { data, error } = await supabase
    .from("ship_cases")
    .select("id, payload, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`案件一覧の取得に失敗しました: ${error.message}`);
  return (data as ShipCaseRow[]).map(rowToShipCase);
}

export async function getCaseById(id: string): Promise<ShipCase | null> {
  const { data, error } = await supabase
    .from("ship_cases")
    .select("id, payload, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`案件の取得に失敗しました: ${error.message}`);
  if (!data) return null;
  return rowToShipCase(data as ShipCaseRow);
}

export async function upsertCase(c: ShipCase): Promise<void> {
  const normalized = normalizeShipCase(c);
  const updatedAt = normalized.updatedAt;
  const { error } = await supabase.from("ship_cases").upsert(
    {
      id: normalized.id,
      payload: normalized,
      updated_at: updatedAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`案件の保存に失敗しました: ${error.message}`);
}

export async function deleteShipCase(id: string): Promise<void> {
  const { error } = await supabase.from("ship_cases").delete().eq("id", id);
  if (error) throw new Error(`案件の削除に失敗しました: ${error.message}`);
}
