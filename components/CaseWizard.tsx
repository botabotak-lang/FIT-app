"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import BasicInfoStep from "@/components/steps/BasicInfoStep";
import WorkReportStep from "@/components/steps/WorkReportStep";
import MaterialsStep from "@/components/steps/MaterialsStep";
import InvoicePreviewStep from "@/components/steps/InvoicePreviewStep";
import {
  BasicInfo,
  WorkDayEntry,
  Material,
  ShipCase,
  CaseStatus,
} from "@/lib/types";
import { upsertCase, isSupabaseConfigured } from "@/lib/caseRepository";
import { ArrowLeft, Save } from "lucide-react";

const TOTAL_STEPS = 4;
const STEP_TITLES = [
  "基本情報の入力",
  "作業報告書の入力",
  "材料持出表の入力",
  "見積書・請求書の確認",
];

type Props = {
  initialCase?: ShipCase;
};

export default function CaseWizard({ initialCase }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(
    initialCase?.basicInfo ?? {
      customer: "",
      shipName: "",
      category: "",
      modelName: "",
      manufacturer: "",
      receptionDate: "",
      completionDate: "",
    }
  );
  const [workDayEntries, setWorkDayEntries] = useState<WorkDayEntry[]>(
    initialCase?.workDayEntries ?? []
  );
  const [materials, setMaterials] = useState<Material[]>(
    initialCase?.materials ?? []
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 新規案件の ID / 作成日時はマウント時に1度だけ決定する。
  // （レンダーごとに再生成すると、保存のたびに別IDの案件が作られてしまう＝二重保存バグ）
  const caseIdRef = useRef<string>(
    initialCase?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const createdAtRef = useRef<string>(
    initialCase?.createdAt ?? new Date().toISOString()
  );
  const caseId = caseIdRef.current;
  const createdAt = createdAtRef.current;

  const getCurrentStatus = (): CaseStatus => {
    if (materials.length > 0) return "materials_added";
    return "draft";
  };

  const buildCase = (status?: CaseStatus): ShipCase => ({
    id: caseId,
    createdAt,
    updatedAt: new Date().toISOString(),
    status: status ?? getCurrentStatus(),
    basicInfo,
    selectedWorkers: initialCase?.selectedWorkers ?? [],
    workDayEntries,
    materials,
  });

  const handleSave = async (exit = false) => {
    if (!isSupabaseConfigured()) {
      setSaveError(
        "Supabase が未設定です。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
      );
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await upsertCase(buildCase());
      if (exit) {
        router.push("/");
      } else {
        setSaveMessage("保存しました");
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInvoiced = async () => {
    if (!isSupabaseConfigured()) {
      setSaveError(
        "Supabase が未設定です。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
      );
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await upsertCase(buildCase("invoiced"));
      router.push("/");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return !!(basicInfo.customer && basicInfo.shipName);
    return true;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep basicInfo={basicInfo} setBasicInfo={setBasicInfo} />;
      case 2:
        return (
          <WorkReportStep
            basicInfo={basicInfo}
            selectedWorkers={[]}
            workDayEntries={workDayEntries}
            onWorkDayEntriesChange={setWorkDayEntries}
          />
        );
      case 3:
        return (
          <MaterialsStep
            basicInfo={basicInfo}
            workDayEntries={workDayEntries}
            materials={materials}
            onMaterialsChange={setMaterials}
          />
        );
      case 4:
        return (
          <InvoicePreviewStep
            basicInfo={basicInfo}
            workDayEntries={workDayEntries}
            materials={materials}
          />
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => void handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="保存して一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">
            {basicInfo.shipName || (initialCase ? "案件編集" : "新規作業報告")}
          </h1>
          {saveMessage && (
            <span className="text-sm text-green-600 font-medium">{saveMessage}</span>
          )}
          {saveError && (
            <span className="text-sm text-red-600 font-medium max-w-[200px] truncate" title={saveError}>
              {saveError}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave(false)}
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>

        {/* ステップインジケーター（タップでジャンプ可能） */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-sm md:text-base transition-colors ${
                    step === currentStep
                      ? "bg-blue-600 text-white"
                      : step < currentStep
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {step < currentStep ? "✓" : step}
                </button>
                {step < TOTAL_STEPS && (
                  <div
                    className={`flex-1 h-1 mx-1 md:mx-2 ${
                      step < currentStep ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-600">
            ステップ {currentStep} / {TOTAL_STEPS}: {STEP_TITLES[currentStep - 1]}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {renderStep()}
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-4">
          <Button
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 1}
            variant="outline"
            className="flex-1"
          >
            ← 戻る
          </Button>
          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1"
            >
              次へ →
            </Button>
          ) : (
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={saving}
              onClick={() => void handleMarkInvoiced()}
            >
              ✅ 請求完了にして終了
            </Button>
          )}
        </div>

        {/* 途中保存ボタン（step 3以降） */}
        {currentStep >= 3 && (
          <div className="mt-3">
            <Button
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave(true)}
            >
              💾 保存して一覧に戻る
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
