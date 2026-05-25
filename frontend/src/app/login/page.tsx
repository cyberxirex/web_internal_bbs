"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm bg-card rounded-2xl border border-border p-7">
        <h1 className="text-xl font-extrabold text-center">로그인</h1>
        <p className="text-xs text-muted text-center mt-1">CTCK BBS · 사내망 전용</p>

        <div className="mt-6 space-y-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />
          {err && <p className="text-xs text-pink font-semibold">{err}</p>}
          <button disabled={busy} className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-50">
            {busy ? "로그인 중…" : "로그인"}
          </button>
          <p className="text-[11px] text-muted text-center">데모 계정: admin / admin</p>
        </div>

        <div className="mt-4 flex justify-center gap-3 text-xs text-muted">
          <Link href="/signup" className="hover:text-primary font-semibold">회원가입</Link>
        </div>
      </form>
    </main>
  );
}
