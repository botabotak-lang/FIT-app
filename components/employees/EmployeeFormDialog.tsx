"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Employee, EmployeeInput } from "@/lib/employeeMaster";

type Props = {
  employee?: Employee;
  onSubmit: (input: EmployeeInput) => Promise<void>;
  onCancel: () => void;
};

const EMPTY: EmployeeInput = {
  name: "",
  sortOrder: 0,
  notes: "",
};

export default function EmployeeFormDialog({ employee, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        sortOrder: employee.sortOrder,
        notes: employee.notes,
      });
    } else {
      setForm(EMPTY);
    }
  }, [employee]);

  const set = (field: keyof EmployeeInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("氏名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <h2 className="text-lg font-bold">{employee ? "社員を編集" : "社員を追加"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              氏名<span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="mt-1"
              placeholder="例：山田"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">表示順（小さいほど上）</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">備考（社内用）</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm min-h-[4rem]"
              placeholder="任意"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
              キャンセル
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "保存中…" : employee ? "更新する" : "登録する"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
