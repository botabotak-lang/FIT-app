"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import {
  BasicInfo,
  Worker,
  TimeSlot,
  TimeCategory,
  WorkerTimes,
  REGULAR_RATE,
  HOLIDAY_RATE,
  TRAVEL_RATE,
  TIME_CATEGORY_LABELS,
} from "@/lib/types";

type Props = {
  basicInfo: BasicInfo;
  selectedWorkers: Worker[];
  workerTimes: WorkerTimes;
  onWorkerTimesChange: (times: WorkerTimes) => void;
};

export default function WorkReportStep({ basicInfo, selectedWorkers, workerTimes, onWorkerTimesChange }: Props) {
  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    return (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
  };

  const calculateWorkerStats = (worker: Worker) => {
    const slots = workerTimes[worker] || [];
    let travelHours = 0, regularHours = 0, overtimeHours = 0, holidayHours = 0;

    slots.forEach((slot) => {
      const hours = calculateHours(slot.startTime, slot.endTime);
      switch (slot.category) {
        case "travel": travelHours += hours; break;
        case "overtime": overtimeHours += hours; break;
        case "holiday": holidayHours += hours; break;
        default: regularHours += hours; break;
      }
    });

    return {
      travelHours, regularHours, overtimeHours, holidayHours,
      travelCost: Math.round(travelHours * REGULAR_RATE * TRAVEL_RATE),
      regularCost: Math.round(regularHours * REGULAR_RATE),
      overtimeCost: Math.round(overtimeHours * REGULAR_RATE),
      holidayCost: Math.round(holidayHours * HOLIDAY_RATE),
      totalCost: Math.round(
        travelHours * REGULAR_RATE * TRAVEL_RATE +
        regularHours * REGULAR_RATE +
        overtimeHours * REGULAR_RATE +
        holidayHours * HOLIDAY_RATE
      ),
    };
  };

  const calculateTotal = () => {
    return selectedWorkers.reduce((acc, w) => acc + calculateWorkerStats(w).totalCost, 0);
  };

  const addTimeSlot = (worker: Worker) => {
    onWorkerTimesChange({
      ...workerTimes,
      [worker]: [...(workerTimes[worker] || []), { startTime: "", endTime: "", category: "regular" as TimeCategory }],
    });
  };

  const removeTimeSlot = (worker: Worker, index: number) => {
    onWorkerTimesChange({
      ...workerTimes,
      [worker]: (workerTimes[worker] || []).filter((_, i) => i !== index),
    });
  };

  const updateTimeSlot = (worker: Worker, index: number, field: keyof TimeSlot, value: string) => {
    onWorkerTimesChange({
      ...workerTimes,
      [worker]: (workerTimes[worker] || []).map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    });
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
                  onValueChange={(value) => updateTimeSlot(worker, index, "category", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIME_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
            {(() => {
              const s = calculateWorkerStats(worker);
              return (
                <>
                  <div className="flex justify-between">
                    <span>移動: {s.travelHours.toFixed(1)}h</span>
                    <span>時間内: {s.regularHours.toFixed(1)}h</span>
                    <span>時間外: {s.overtimeHours.toFixed(1)}h</span>
                    <span>休日: {s.holidayHours.toFixed(1)}h</span>
                  </div>
                  <div className="font-semibold text-right">合計: ¥{s.totalCost.toLocaleString()}</div>
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
