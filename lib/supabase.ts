import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const url = SUPABASE_URL;
const key = SUPABASE_ANON_KEY;

/**
 * Vercel のビルドや env 未設定時でも、モジュール評価で落ちないようダミーを渡す。
 * 実データへのアクセスは isSupabaseConfigured() が true のときだけ行うこと。
 */
const buildTimeUrl = url || "http://127.0.0.1:54321";
const buildTimeKey =
  key ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const supabase: SupabaseClient = createClient(buildTimeUrl, buildTimeKey);
