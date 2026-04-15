"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Worker } from "@/lib/types";
import { getActiveEmployees, Employee } from "@/lib/employeeMaster";

type Props = {
  selectedWorkers: Worker[];
  setSelectedWorkers: (workers: Worker[]) => void;
};

export default function WorkerSelectionStep({ selectedWorkers, setSelectedWorkers }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    getActiveEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  const activeNames = employees.map((e) => e.name);

  const toggleWorker = (worker: Worker) => {
    if (selectedWorkers.includes(worker)) {
      setSelectedWorkers(selectedWorkers.filter((w) => w !== worker));
    } else {
      setSelectedWorkers([...selectedWorkers, worker]);
    }
  };

  const legacySelected = selectedWorkers.filter((w) => !activeNames.includes(w));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">作業者を選択してください</h2>
        <p className="text-sm text-gray-600 mb-6">
          作業に参加した作業者を選択してください（複数選択可）
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {employees.map((emp) => (
          <Button
            key={emp.id}
            type="button"
            onClick={() => toggleWorker(emp.name)}
            variant={selectedWorkers.includes(emp.name) ? "default" : "outline"}
            size="lg"
            className="min-w-[100px]"
          >
            {emp.name}
          </Button>
        ))}
        {legacySelected.map((name) => (
          <Button
            key={`legacy-${name}`}
            type="button"
            onClick={() => toggleWorker(name)}
            variant={selectedWorkers.includes(name) ? "default" : "outline"}
            size="lg"
            className="min-w-[100px] border-amber-300"
          >
            {name}
            <span className="text-xs font-normal ml-1 opacity-80">（マスタ外）</span>
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
          <p className="text-sm text-yellow-800">作業者を1名以上選択してください</p>
        </div>
      )}
    </div>
  );
}
