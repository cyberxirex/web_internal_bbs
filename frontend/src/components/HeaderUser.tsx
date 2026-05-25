"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Notif = { total: number; todos: unknown[]; newComments: unknown[]; newLikes: unknown[] };

export default function HeaderUser() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState<Notif | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 메뉴 바깥(다른 화면 어디든) 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const refresh = useCallback(() => {
    if (user) api<Notif>("/api/notifications").then(setNotif).catch(() => {});
  }, [user]);

  useEffect(() => {
    refresh();
    const h = () => refresh(); // "모두 읽음" 등에서 발생 → 배지 즉시 갱신
    window.addEventListener("ctck-notif", h);
    return () => window.removeEventListener("ctck-notif", h);
  }, [refresh]);

  if (!user) return null;
  const summary = [
    { icon: "🔔", label: "확인할 것", n: notif?.todos.length ?? 0 },
    { icon: "💬", label: "새 댓글", n: notif?.newComments.length ?? 0 },
    { icon: "💖", label: "새 공감", n: notif?.newLikes.length ?? 0 },
  ];
  const total = notif?.total ?? 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-label="사용자 메뉴" aria-expanded={open} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-background">
        <span className="relative w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-pink text-white grid place-items-center text-xs font-bold">
          {user.nickname.slice(0, 1)}
          {total > 0 && (
            <span className="badge-wiggle absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-pink text-white text-[10px] font-extrabold border-2 border-card shadow-sm">
              {total}
            </span>
          )}
        </span>
        <span className="hidden md:block text-sm font-bold whitespace-nowrap">{user.nickname}</span>
      </button>

      {open && (
        <>
          <div className="absolute right-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl p-1.5">
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-sm font-bold truncate">{user.nickname}</p>
              <p className="text-xs text-muted whitespace-nowrap">Lv.{user.level} {user.levelName} · {user.points.toLocaleString()}P</p>
            </div>

            {total > 0 && (
              <div className="mb-1 pb-1 border-b border-border">
                {summary.map((s) => (
                  <Link key={s.label} href="/me?alerts=1" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background">
                    <span className="shrink-0">{s.icon}</span>
                    <span className="flex-1 text-sm text-foreground/80">{s.label}</span>
                    <span className={`shrink-0 text-xs font-bold ${s.n > 0 ? "text-pink" : "text-muted"}`}>{s.n}</span>
                  </Link>
                ))}
              </div>
            )}

            <Link href="/me" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-background whitespace-nowrap">마이페이지</Link>
            {user.isAdmin && (
              <Link href="/admin/events" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-background whitespace-nowrap">🛠️ 이벤트 관리</Link>
            )}
            {user.isAdmin && (
              <Link href="/admin/permissions" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-foreground/80 hover:bg-background whitespace-nowrap">🔑 권한 관리</Link>
            )}
            <button onClick={() => { logout(); setOpen(false); }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-pink hover:bg-background whitespace-nowrap">로그아웃</button>
          </div>
        </>
      )}
    </div>
  );
}
