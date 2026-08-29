"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, ToggleLeft, ToggleRight, Users } from "lucide-react";
import {
  Employee,
  EmployeeInput,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeActive,
} from "@/lib/employeeMaster";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import AdminGate from "@/components/AdminGate";

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; employee: Employee };

export default function EmployeesPage() {
  return (
    <AdminGate>
      <EmployeesPageInner />
    </AdminGate>
  );
}

function EmployeesPageInner() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEmployees(await getAllEmployees());
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSubmit = async (input: EmployeeInput) => {
    if (dialog.mode === "edit") {
      await updateEmployee(dialog.employee.id, input);
    } else {
      await createEmployee(input);
    }
    setDialog({ mode: "closed" });
    await fetchEmployees();
  };

  const handleToggle = async (e: Employee) => {
    const label = e.isActive ? "無効にします" : "有効にします";
    if (!confirm(`「${e.name}」を${label}か？`)) return;
    setTogglingId(e.id);
    try {
      await toggleEmployeeActive(e.id, !e.isActive);
      await fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setTogglingId(null);
    }
  };

  const active = employees.filter((e) => e.isActive);
  const inactive = employees.filter((e) => !e.isActive);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="一覧に戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">社員マスタ</h1>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {loading && <div className="text-center py-16 text-gray-400">読み込み中…</div>}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm mb-4">
            {error}
            <button type="button" className="ml-2 underline" onClick={fetchEmployees}>
              再読み込み
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              有効 {active.length}件 / 全{employees.length}件
            </p>
            {employees.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-4">社員が登録されていません</p>
                <Button onClick={() => setDialog({ mode: "add" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初の社員を追加
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <EmployeeList
                  items={active}
                  togglingId={togglingId}
                  onEdit={(e) => setDialog({ mode: "edit", employee: e })}
                  onToggle={handleToggle}
                />
                {inactive.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">
                      無効（作業者の選択肢に出ません）
                    </p>
                    <EmployeeList
                      items={inactive}
                      togglingId={togglingId}
                      onEdit={(e) => setDialog({ mode: "edit", employee: e })}
                      onToggle={handleToggle}
                      muted
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {dialog.mode !== "closed" && (
        <EmployeeFormDialog
          employee={dialog.mode === "edit" ? dialog.employee : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ mode: "closed" })}
        />
      )}
    </main>
  );
}

function EmployeeList({
  items,
  togglingId,
  onEdit,
  onToggle,
  muted,
}: {
  items: Employee[];
  togglingId: string | null;
  onEdit: (e: Employee) => void;
  onToggle: (e: Employee) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div
          key={e.id}
          className={`bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 ${
            muted ? "opacity-50" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{e.name}</p>
            {e.notes && <p className="text-xs text-gray-400 mt-1">{e.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(e)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="編集"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggle(e)}
              disabled={togglingId === e.id}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              aria-label={e.isActive ? "無効にする" : "有効にする"}
            >
              {e.isActive ? (
                <ToggleRight className="w-5 h-5 text-green-500" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
