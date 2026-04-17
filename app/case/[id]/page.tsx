"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShipCase } from "@/lib/types";
import { getCaseById, isSupabaseConfigured } from "@/lib/caseRepository";
import CaseWizard from "@/components/CaseWizard";

export default function EditCasePage() {
  const params = useParams();
  const router = useRouter();
  const [shipCase, setShipCase] = useState<ShipCase | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = params.id as string;

    async function load() {
      if (!isSupabaseConfigured()) {
        setError(
          "Supabase が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
        );
        setShipCase(null);
        return;
      }
      setError(null);
      try {
        const c = await getCaseById(id);
        if (!cancelled) setShipCase(c ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "読み込みに失敗しました");
          setShipCase(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (shipCase === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-red-700 text-sm max-w-md">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="text-blue-600 underline text-sm"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  if (shipCase === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>案件が見つかりません</p>
        <button
          onClick={() => router.push("/")}
          className="text-blue-600 underline text-sm"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  return <CaseWizard initialCase={shipCase} />;
}
