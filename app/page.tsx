"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import BasicInfoStep from "@/components/steps/BasicInfoStep";
import WorkerSelectionStep from "@/components/steps/WorkerSelectionStep";
import WorkReportStep from "@/components/steps/WorkReportStep";
import MaterialsStep from "@/components/steps/MaterialsStep";
import InvoicePreviewStep from "@/components/steps/InvoicePreviewStep";
import { BasicInfo, Worker, WorkerTimes, Material, TimeCategory } from "@/lib/types";

const TOTAL_STEPS = 5;

const STEP_TITLES = [
  "基本情報の入力",
  "作業者の選択",
  "作業報告書の入力",
  "材料持出表の入力",
  "見積書・請求書の確認",
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    customer: "",
    shipName: "",
    category: "",
    modelName: "",
    completionDate: "",
  });
  const [selectedWorkers, setSelectedWorkers] = useState<Worker[]>([]);
  const [workerTimes, setWorkerTimes] = useState<WorkerTimes>({});
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    selectedWorkers.forEach((worker) => {
      if (!workerTimes[worker] || workerTimes[worker]!.length === 0) {
        setWorkerTimes((prev) => ({
          ...prev,
          [worker]: [{ startTime: "", endTime: "", category: "regular" as TimeCategory }],
        }));
      }
    });
  }, [selectedWorkers]);

  const canProceed = () => {
    switch (currentStep) {
      case 1: return basicInfo.customer && basicInfo.shipName;
      case 2: return selectedWorkers.length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep basicInfo={basicInfo} setBasicInfo={setBasicInfo} />;
      case 2:
        return (
          <WorkerSelectionStep
            selectedWorkers={selectedWorkers}
            setSelectedWorkers={setSelectedWorkers}
          />
        );
      case 3:
        return (
          <WorkReportStep
            basicInfo={basicInfo}
            selectedWorkers={selectedWorkers}
            workerTimes={workerTimes}
            onWorkerTimesChange={setWorkerTimes}
          />
        );
      case 4:
        return (
          <MaterialsStep
            basicInfo={basicInfo}
            materials={materials}
            onMaterialsChange={setMaterials}
          />
        );
      case 5:
        return (
          <InvoicePreviewStep
            basicInfo={basicInfo}
            selectedWorkers={selectedWorkers}
            workerTimes={workerTimes}
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
          船舶修理作業報告システム
        </h1>

        {/* ステップインジケーター */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-sm md:text-base
                    ${
                      step === currentStep
                        ? "bg-blue-600 text-white"
                        : step < currentStep
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                    }
                  `}
                >
                  {step < currentStep ? "✓" : step}
                </div>
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

        {/* ナビゲーションボタン */}
        <div className="flex gap-4">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            variant="outline"
            className="flex-1"
          >
            ← 戻る
          </Button>
          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1"
            >
              次へ →
            </Button>
          ) : (
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => alert("データの保存機能はPhase 2で実装予定です")}
            >
              保存して完了
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
