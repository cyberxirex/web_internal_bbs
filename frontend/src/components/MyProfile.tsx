"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, relTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Stats = { posts: number; comments: number; likesGiven: number; likesReceived: number; myPosts: { id: number; board: string; color: string; title: string; createdAt: string }[] };
type Todo = { icon: string; label: string; sub: string; href: string };
type Activity = { who: string; post: string; href: string };
type Notif = { todos: Todo[]; newComments: Activity[]; newLikes: Activity[]; total: number };

export default function MyProfile() {
  const { user, logout, loading } = useAuth();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notif, setNotif] = useState<Notif | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("alerts") === "1") setAlertsOpen(true);
  }, []);
  useEffect(() => {
    if (!user) return;
    api<Stats>("/api/me/stats").then(setStats).catch(() => {});
    api<Notif>("/api/notifications").then(setNotif).catch(() => {});
  }, [user]);

  if (!loading && !user) {
    return (
      <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
        <div><p className="text-foreground/70 mb-3">로그인이 필요한 페이지입니다.</p>
          <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">로그인하러 가기</Link></div>
      </div>
    );
  }
  if (!user) return <div className="min-w-0 flex-1 py-20 text-center text-muted">불러오는 중…</div>;

  const statCards = [
    { label: "작성한 글", value: stats?.posts ?? 0, icon: "📝" },
    { label: "작성한 댓글", value: stats?.comments ?? 0, icon: "💬" },
    { label: "보낸 공감", value: stats?.likesGiven ?? 0, icon: "🤍" },
    { label: "받은 공감", value: stats?.likesReceived ?? 0, icon: "💖" },
  ];
  const todos = notif?.todos ?? [];
  const comments = notif?.newComments ?? [];
  const likes = notif?.newLikes ?? [];
  const alertTotal = notif?.total ?? 0;

  const markRead = async () => {
    await api("/api/notifications/read", { method: "POST" });
    setNotif({ todos: [], newComments: [], newLikes: [], total: 0 });
    window.dispatchEvent(new Event("ctck-notif")); // 헤더 배지 즉시 갱신
  };

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <section className="bg-card border border-border rounded-2xl p-4 lg:h-24 flex items-center gap-4">
        <span className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-pink text-white grid place-items-center text-xl font-extrabold">{user.nickname.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="text-lg font-extrabold truncate">{user.nickname}</h1>
            <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary">Lv.{user.level} {user.levelName}</span></div>
          <p className="text-xs text-muted mt-0.5 truncate">{user.points.toLocaleString()}P · 가입일 {user.joinedAt} · 최종 로그인 {user.lastLogin ?? "-"}</p>
        </div>
        <button onClick={() => logout()} className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-sm font-semibold text-foreground/70 hover:border-pink hover:text-pink">로그아웃</button>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-2xl">{s.icon}</div><div className="text-2xl font-extrabold mt-1">{s.value.toLocaleString()}</div><div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <h2 className="font-bold text-sm">🔔 알림</h2>
          {alertTotal > 0 && !alertsOpen && <span className="badge-wiggle text-[10px] font-extrabold text-white bg-pink rounded-full px-1.5 py-0.5">NEW</span>}
          <span className="text-sm font-bold text-pink">{alertTotal}</span>
          <span className="flex-1" />
          {alertsOpen && alertTotal > 0 && <button onClick={markRead} className="text-xs font-semibold text-muted hover:text-primary border border-border rounded-lg px-2 py-1">✓ 모두 읽음</button>}
          <button onClick={() => setAlertsOpen((o) => !o)} className="text-xs text-muted hover:text-foreground/80">{alertsOpen ? "접기 ▲" : "펼치기 ▼"}</button>
        </div>
        {alertsOpen && (
          <div className="border-t border-border p-2 grid md:grid-cols-3 gap-2">
            <div className="bg-background rounded-xl p-1.5">
              <p className="px-2 py-1 text-[11px] font-bold text-muted">확인할 것 · {todos.length}</p>
              <ul className="max-h-52 overflow-y-auto thin-scroll">
                {todos.map((t, i) => (
                  <li key={i}><Link href={t.href} className="block px-2 py-2 rounded-lg hover:bg-card"><span className="block text-xs font-bold text-foreground/70">{t.icon} {t.label}</span><span className="block text-sm text-foreground/90 truncate">{t.sub}</span></Link></li>
                ))}
                {todos.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted">없음 👍</li>}
              </ul>
            </div>
            <div className="bg-background rounded-xl p-1.5">
              <p className="px-2 py-1 text-[11px] font-bold text-muted">💬 새 댓글 · {comments.length}</p>
              <ul className="max-h-52 overflow-y-auto thin-scroll">
                {comments.map((c, i) => (<li key={i}><Link href={c.href} className="block px-2 py-2 rounded-lg hover:bg-card"><span className="block text-xs text-muted">{c.who}</span><span className="block text-sm text-foreground/90 truncate">{c.post}</span></Link></li>))}
                {comments.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted">없음</li>}
              </ul>
            </div>
            <div className="bg-background rounded-xl p-1.5">
              <p className="px-2 py-1 text-[11px] font-bold text-muted">💖 새 공감 · {likes.length}</p>
              <ul className="max-h-52 overflow-y-auto thin-scroll">
                {likes.map((c, i) => (<li key={i}><Link href={c.href} className="block px-2 py-2 rounded-lg hover:bg-card"><span className="block text-xs text-muted">{c.who}</span><span className="block text-sm text-foreground/90 truncate">{c.post}</span></Link></li>))}
                {likes.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted">없음</li>}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        <h2 className="font-bold text-sm px-4 py-3 border-b border-border">📌 내가 쓴 글</h2>
        <div className="p-1.5">
          {(stats?.myPosts ?? []).map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background">
              <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${p.color === "pink" ? "bg-pink-soft text-pink" : "bg-primary-soft text-primary"}`}>{p.board}</span>
              <span className="flex-1 truncate text-sm text-foreground/90">{p.title}</span>
              <span className="shrink-0 text-xs text-muted">{relTime(p.createdAt)}</span>
            </Link>
          ))}
          {(stats?.myPosts?.length ?? 0) === 0 && <p className="px-3 py-6 text-center text-sm text-muted">아직 쓴 글이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
