"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, ToggleLeft, ToggleRight, Building2 } from "lucide-react";
import {
  Customer,
  CustomerInput,
  getAllCustomers,
  createCustomer,
  updateCustomer,
  toggleCustomerActive,
} from "@/lib/customerMaster";
import CustomerFormDialog from "@/components/customers/CustomerFormDialog";

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; customer: Customer };

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await getAllCustomers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSubmit = async (input: CustomerInput) => {
    if (dialog.mode === "edit") {
      await updateCustomer(dialog.customer.id, input);
    } else {
      await createCustomer(input);
    }
    setDialog({ mode: "closed" });
    await fetchCustomers();
  };

  const handleToggle = async (c: Customer) => {
    const label = c.isActive ? "無効にします" : "有効にします";
    if (!confirm(`「${c.name}」を${label}か？`)) return;
    setTogglingId(c.id);
    try {
      await toggleCustomerActive(c.id, !c.isActive);
      await fetchCustomers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setTogglingId(null);
    }
  };

  const active = customers.filter((c) => c.isActive);
  const inactive = customers.filter((c) => !c.isActive);

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
          <h1 className="text-xl font-bold text-gray-900 flex-1">顧客マスタ</h1>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {loading && <div className="text-center py-16 text-gray-400">読み込み中…</div>}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm mb-4">
            {error}
            <button type="button" className="ml-2 underline" onClick={fetchCustomers}>
              再読み込み
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              有効 {active.length}件 / 全{customers.length}件
            </p>
            {customers.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="mb-4">顧客が登録されていません</p>
                <Button onClick={() => setDialog({ mode: "add" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  最初の顧客を追加
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <CustomerList
                  items={active}
                  togglingId={togglingId}
                  onEdit={(c) => setDialog({ mode: "edit", customer: c })}
                  onToggle={handleToggle}
                />
                {inactive.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">
                      無効（新規案件の選択肢に出ません）
                    </p>
                    <CustomerList
                      items={inactive}
                      togglingId={togglingId}
                      onEdit={(c) => setDialog({ mode: "edit", customer: c })}
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
        <CustomerFormDialog
          customer={dialog.mode === "edit" ? dialog.customer : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ mode: "closed" })}
        />
      )}
    </main>
  );
}

function CustomerList({
  items,
  togglingId,
  onEdit,
  onToggle,
  muted,
}: {
  items: Customer[];
  togglingId: string | null;
  onEdit: (c: Customer) => void;
  onToggle: (c: Customer) => void;
  muted?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div
          key={c.id}
          className={`bg-white rounded-xl shadow-sm p-4 flex items-start justify-between gap-3 ${
            muted ? "opacity-50" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{c.name}</p>
            {(c.address || c.phone) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {c.address}
                {c.address && c.phone ? " / " : ""}
                {c.phone}
              </p>
            )}
            {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="編集"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggle(c)}
              disabled={togglingId === c.id}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              aria-label={c.isActive ? "無効にする" : "有効にする"}
            >
              {c.isActive ? (
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
