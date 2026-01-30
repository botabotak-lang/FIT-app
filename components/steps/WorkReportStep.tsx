"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

type Worker = "大竹" | "豊島" | "鈴木" | "内田" | "新人";
type TimeCategory = "regular" | "overtime" | "holiday" | "travel";

type TimeSlot = {
  startTime: string;
  endTime: string;
  category: TimeCategory;
};

type WorkerTime = {
  [key in Worker]: TimeSlot[];
};

type BasicInfo = {
  customer: string;
  shipName: string;
  category: string;
  modelName: string;
  completionDate: string;
};

const REGULAR_RATE = 7000;
const HOLIDAY_RATE = 8400;
const TRAVEL_RATE = 0.8;

const TIME_CATEGORY_LABELS: { [key in TimeCategory]: string } = {
  regular: "時間内",
  overtime: "時間外",
  holiday: "休日",
  travel: "移動",
};

type Props = {
  basicInfo: BasicInfo;
  selectedWorkers: Worker[];
};

export default function WorkReportStep({ basicInfo, selectedWorkers }: Props) {
  const [workerTimes, setWorkerTimes] = useState<WorkerTime>(() => {
    const initial: Partial<WorkerTime> = {};
    selectedWorkers.forEach((worker) => {
      initial[worker] = [{ startTime: "", endTime: "", category: "regular" }];
    });
    return initial as WorkerTime;
  });

  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  const calculateWorkerStats = (worker: Worker) => {
    const slots = workerTimes[worker] || [];
    let travelHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    slots.forEach((slot) => {
      const hours = calculateHours(slot.startTime, slot.endTime);
      switch (slot.category) {
        case "travel":
          travelHours += hours;
          break;
        case "overtime":
          overtimeHours += hours;
          break;
        case "holiday":
          holidayHours += hours;
          break;
        case "regular":
        default:
          regularHours += hours;
          break;
      }
    });

    const travelCost = travelHours * REGULAR_RATE * TRAVEL_RATE;
    const regularCost = regularHours * REGULAR_RATE;
    const overtimeCost = overtimeHours * REGULAR_RATE;
    const holidayCost = holidayHours * HOLIDAY_RATE;
    const totalCost = travelCost + regularCost + overtimeCost + holidayCost;

    return {
      travelHours: travelHours.toFixed(2),
      regularHours: regularHours.toFixed(2),
      overtimeHours: overtimeHours.toFixed(2),
      holidayHours: holidayHours.toFixed(2),
      totalCost: Math.round(totalCost),
    };
  };

  const calculateTotal = () => {
    return selectedWorkers.reduce((acc, worker) => {
      const stats = calculateWorkerStats(worker);
      return acc + stats.totalCost;
    }, 0);
  };

  const addTimeSlot = (worker: Worker) => {
    setWorkerTimes((prev) => ({
      ...prev,
      [worker]: [...(prev[worker] || []), { startTime: "", endTime: "", category: "regular" }],
    }));
  };

  const removeTimeSlot = (worker: Worker, index: number) => {
    setWorkerTimes((prev) => ({
      ...prev,
      [worker]: (prev[worker] || []).filter((_, i) => i !== index),
    }));
  };

  const updateTimeSlot = (worker: Worker, index: number, field: keyof TimeSlot, value: any) => {
    setWorkerTimes((prev) => ({
      ...prev,
      [worker]: (prev[worker] || []).map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">作業報告書</h2>
        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
          <p>
            <strong>顧客：</strong>{basicInfo.customer} / <strong>船名：</strong>{basicInfo.shipName}
          </p>
        </div>
      </div>

      {selectedWorkers.map((worker) => (
        <div key={worker} className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">{worker}</h3>
            <Button size="sm" onClick={() => addTimeSlot(worker)}>
              + 時間追加
            </Button>
          </div>

          {(workerTimes[worker] || []).map((slot, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded relative">
              {(workerTimes[worker]?.length || 0) > 1 && (
                <button
                  onClick={() => removeTimeSlot(worker, index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <div>
                <Label className="text-xs">開始時刻</Label>
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateTimeSlot(worker, index, "startTime", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">終了時刻</Label>
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateTimeSlot(worker, index, "endTime", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">時間区分</Label>
                <Select
                  value={slot.category}
                  onValueChange={(value) => updateTimeSlot(worker, index, "category", value as TimeCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIME_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
            {(() => {
              const stats = calculateWorkerStats(worker);
              return (
                <>
                  <div className="flex justify-between">
                    <span>移動: {stats.travelHours}h</span>
                    <span>時間内: {stats.regularHours}h</span>
                    <span>時間外: {stats.overtimeHours}h</span>
                    <span>休日: {stats.holidayHours}h</span>
                  </div>
                  <div className="font-semibold text-right">合計: ¥{stats.totalCost.toLocaleString()}</div>
                </>
              );
            })()}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="text-2xl font-bold text-center">総合計: ¥{calculateTotal().toLocaleString()}</div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
        <p>💡 ヒント：作業時間の入力は任意です。入力せずに「次へ」で材料持出表に進むこともできます。</p>
      </div>
    </div>
  );
}
