"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw !== pw2) {
      setErr("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await signup(username, nickname, pw);
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
        <h1 className="text-xl font-extrabold text-center">회원가입</h1>
        <p className="text-xs text-muted text-center mt-1">간단한 정보만 입력하면 가입 완료</p>

        <div className="mt-6 space-y-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디 (3자 이상)" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임 (게시판에 표시)" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호 (4자 이상)" type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />
          <input value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호 확인" type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted" />

          <div className="rounded-xl bg-background p-3 text-[11px] text-muted leading-relaxed">
            ⚠️ 사내 시스템 보호를 위해 가입·작성 시 접속 IP가 확인되며, 동일 IP 다중 가입·도배는 자동 제한될 수 있습니다.
          </div>
          {err && <p className="text-xs text-pink font-semibold">{err}</p>}
          <button disabled={busy} className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-50">
            {busy ? "가입 중…" : "가입하기"}
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-muted">
          이미 계정이 있으신가요? <Link href="/login" className="hover:text-primary font-semibold">로그인</Link>
        </div>
      </form>
    </main>
  );
}
