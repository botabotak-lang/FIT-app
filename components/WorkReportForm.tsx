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
  category: TimeCategory; // 時間区分（排他選択）
};

type WorkerTime = {
  [key in Worker]: TimeSlot[];
};

const WORKERS: Worker[] = ["大竹", "豊島", "鈴木", "内田", "新人"];
const CUSTOMERS = ["東海汽船", "清水港運", "焼津漁協", "鈴与海運", "その他"];
const REGULAR_RATE = 7000; // 平日単価
const HOLIDAY_RATE = 8400; // 休日単価
const TRAVEL_RATE = 0.8; // 移動費係数

const TIME_CATEGORY_LABELS: { [key in TimeCategory]: string } = {
  regular: "時間内",
  overtime: "時間外",
  holiday: "休日",
  travel: "移動",
};

export default function WorkReportForm() {
  const [shipName, setShipName] = useState("");
  const [customer, setCustomer] = useState("");
  const [category, setCategory] = useState("");
  const [modelName, setModelName] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  
  // 選択された作業者
  const [selectedWorkers, setSelectedWorkers] = useState<Worker[]>([]);
  
  const [workerTimes, setWorkerTimes] = useState<WorkerTime>(() => {
    const initial: Partial<WorkerTime> = {};
    WORKERS.forEach(worker => {
      initial[worker] = [{ startTime: "", endTime: "", category: "regular" }];
    });
    return initial as WorkerTime;
  });

  // 作業者の選択/解除
  const toggleWorker = (worker: Worker) => {
    if (selectedWorkers.includes(worker)) {
      setSelectedWorkers(selectedWorkers.filter(w => w !== worker));
    } else {
      setSelectedWorkers([...selectedWorkers, worker]);
    }
  };

  // 時間計算関数
  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  // 作業者ごとの集計
  const calculateWorkerStats = (worker: Worker) => {
    const slots = workerTimes[worker];
    let travelHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    slots.forEach(slot => {
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

  // 全体集計
  const calculateTotal = () => {
    return selectedWorkers.reduce((acc, worker) => {
      const stats = calculateWorkerStats(worker);
      return acc + stats.totalCost;
    }, 0);
  };

  // タイムスロット追加
  const addTimeSlot = (worker: Worker) => {
    setWorkerTimes(prev => ({
      ...prev,
      [worker]: [...prev[worker], { startTime: "", endTime: "", category: "regular" }]
    }));
  };

  // タイムスロット削除
  const removeTimeSlot = (worker: Worker, index: number) => {
    setWorkerTimes(prev => ({
      ...prev,
      [worker]: prev[worker].filter((_, i) => i !== index)
    }));
  };

  // タイムスロット更新
  const updateTimeSlot = (worker: Worker, index: number, field: keyof TimeSlot, value: any) => {
    setWorkerTimes(prev => ({
      ...prev,
      [worker]: prev[worker].map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* ヘッダー情報 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customer">顧客名</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="顧客を選択" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMERS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="shipName">船名</Label>
            <Input
              id="shipName"
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
              placeholder="船名を入力"
            />
          </div>
          <div>
            <Label htmlFor="category">科目</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="科目を入力"
            />
          </div>
          <div>
            <Label htmlFor="modelName">型名</Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="型名を入力"
            />
          </div>
          <div>
            <Label htmlFor="completionDate">完成月日</Label>
            <Input
              id="completionDate"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 作業者選択 */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold border-b pb-2">作業者選択</h2>
        <div className="flex flex-wrap gap-2">
          {WORKERS.map(worker => (
            <Button
              key={worker}
              onClick={() => toggleWorker(worker)}
              variant={selectedWorkers.includes(worker) ? "default" : "outline"}
              size="sm"
            >
              {worker}
            </Button>
          ))}
        </div>
        {selectedWorkers.length === 0 && (
          <p className="text-sm text-gray-500">作業者を選択してください</p>
        )}
      </div>

      {/* 作業者別時間入力（選択された作業者のみ表示） */}
      {selectedWorkers.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">作業時間入力</h2>
          {selectedWorkers.map(worker => (
            <div key={worker} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">{worker}</h3>
                <Button size="sm" onClick={() => addTimeSlot(worker)}>
                  + 時間追加
                </Button>
              </div>
              
              {workerTimes[worker].map((slot, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 p-3 rounded relative">
                  {/* 削除ボタン */}
                  {workerTimes[worker].length > 1 && (
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
              
              {/* 作業者ごとの集計 */}
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
                      <div className="font-semibold text-right">
                        合計: ¥{stats.totalCost.toLocaleString()}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 総合計 */}
      {selectedWorkers.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-center">
            総合計: ¥{calculateTotal().toLocaleString()}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => alert("保存機能は実装予定です")}>
          保存
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => alert("PDF出力機能は実装予定です")}>
          PDF出力
        </Button>
      </div>
    </div>
  );
}
