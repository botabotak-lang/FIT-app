"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShipCase } from "@/lib/types";
import { getCaseById } from "@/lib/storage";
import CaseWizard from "@/components/CaseWizard";

export default function EditCasePage() {
  const params = useParams();
  const router = useRouter();
  const [shipCase, setShipCase] = useState<ShipCase | null | undefined>(undefined);

  useEffect(() => {
    const c = getCaseById(params.id as string);
    setShipCase(c ?? null);
  }, [params.id]);

  if (shipCase === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        読み込み中...
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
