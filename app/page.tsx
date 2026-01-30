"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import BasicInfoStep from "@/components/steps/BasicInfoStep";
import WorkerSelectionStep from "@/components/steps/WorkerSelectionStep";
import WorkReportStep from "@/components/steps/WorkReportStep";
import MaterialsStep from "@/components/steps/MaterialsStep";

type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  completionDate: string;
};

type Worker = "大竹" | "豊島" | "鈴木" | "内田" | "新人";

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

  const totalSteps = 4;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return basicInfo.customer && basicInfo.shipName;
      case 2:
        return selectedWorkers.length > 0;
      case 3:
        return true; // 作業報告は任意
      case 4:
        return true; // 材料持出も任意
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
          />
        );
      case 4:
        return <MaterialsStep basicInfo={basicInfo} />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "基本情報の入力";
      case 2:
        return "作業者の選択";
      case 3:
        return "作業報告書の入力";
      case 4:
        return "材料持出表の入力";
      default:
        return "";
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
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
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
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-600">
            ステップ {currentStep} / {totalSteps}: {getStepTitle()}
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
          {currentStep < totalSteps ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1"
            >
              次へ →
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => alert("保存機能は実装予定です")}
            >
              保存して完了
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
