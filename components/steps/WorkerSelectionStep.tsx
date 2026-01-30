"use client";

import { Button } from "@/components/ui/button";

type Worker = "大竹" | "豊島" | "鈴木" | "内田" | "新人";

const WORKERS: Worker[] = ["大竹", "豊島", "鈴木", "内田", "新人"];

type Props = {
  selectedWorkers: Worker[];
  setSelectedWorkers: (workers: Worker[]) => void;
};

export default function WorkerSelectionStep({ selectedWorkers, setSelectedWorkers }: Props) {
  const toggleWorker = (worker: Worker) => {
    if (selectedWorkers.includes(worker)) {
      setSelectedWorkers(selectedWorkers.filter((w) => w !== worker));
    } else {
      setSelectedWorkers([...selectedWorkers, worker]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">作業者を選択してください</h2>
        <p className="text-sm text-gray-600 mb-6">
          作業に参加した作業者を選択してください（複数選択可）
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {WORKERS.map((worker) => (
          <Button
            key={worker}
            onClick={() => toggleWorker(worker)}
            variant={selectedWorkers.includes(worker) ? "default" : "outline"}
            size="lg"
            className="min-w-[100px]"
          >
            {worker}
          </Button>
        ))}
      </div>

      {selectedWorkers.length > 0 && (
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800 font-semibold">
            選択中：{selectedWorkers.join("、")} （{selectedWorkers.length}名）
          </p>
        </div>
      )}

      {selectedWorkers.length === 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ 作業者を1名以上選択してください
          </p>
        </div>
      )}
    </div>
  );
}
