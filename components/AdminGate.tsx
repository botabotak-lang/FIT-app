"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

/**
 * マスタ編集画面の簡易パスワード保護。
 * NEXT_PUBLIC_ADMIN_PASSWORD が未設定・空なら素通しする。
 *
 * 注意：ビルド時に埋め込まれる値との照合なので、あくまで
 * 「社内の誤操作を防ぐ」レベルの保護。機密データの防御にはならない。
 */
const ADMIN_PASSWORD = (process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "").trim();
const SESSION_FLAG_KEY = "fit_admin_ok";

type GateStatus = "checking" | "locked" | "unlocked";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  // パスワード未設定なら常に unlocked（SSR とクライアントで同じ初期値になる）
  const [status, setStatus] = useState<GateStatus>(
    ADMIN_PASSWORD ? "checking" : "unlocked"
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ADMIN_PASSWORD) return;
    // effect 内の同期 setState を避ける（他画面と同じ書き方）
    queueMicrotask(() => {
      try {
        setStatus(
          sessionStorage.getItem(SESSION_FLAG_KEY) === "1" ? "unlocked" : "locked"
        );
      } catch {
        setStatus("locked");
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input !== ADMIN_PASSWORD) {
      setError("パスワードが違います");
      return;
    }
    try {
      sessionStorage.setItem(SESSION_FLAG_KEY, "1");
    } catch {
      // sessionStorage が使えない環境でも、このタブでは通す
    }
    setError(null);
    setInput("");
    setStatus("unlocked");
  };

  if (status === "unlocked") return <>{children}</>;

  if (status === "checking") {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center text-gray-400">
        読み込み中…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4"
      >
        <div className="flex items-center gap-2 text-gray-900">
          <Lock className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-bold">管理画面のパスワード</h1>
        </div>
        <p className="text-sm text-gray-500">
          マスタの編集にはパスワードが必要です。同じタブの間は再入力不要です。
        </p>

        <div>
          <Label className="text-sm font-medium" htmlFor="admin-password">
            パスワード
          </Label>
          <Input
            id="admin-password"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="current-password"
            className="mt-1"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={!input}>
          開く
        </Button>

        <Link
          href="/"
          className="block text-center text-sm text-gray-500 hover:text-gray-800 underline"
        >
          一覧に戻る
        </Link>
      </form>
    </main>
  );
}
