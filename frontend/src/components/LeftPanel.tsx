"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AccountCard from "./AccountCard";
import NewBadge from "./NewBadge";

const GROUPS = [
  { group: "소통", slugs: ["free", "qna", "anon"] },
  { group: "정보", slugs: ["news", "tips"] },
  { group: "생활", slugs: ["gallery", "market"] },
];

type Board = { slug: string; name: string; tag: string; color: string; anon: boolean; dept: boolean; hasNew?: boolean };
type Notice = { id: number; title: string; time: string };
type Ev = { id: number; title: string; desc: string; pct: number };

export default function LeftPanel({ active }: { active?: string }) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [deptOpen, setDeptOpen] = useState(false);
  const [evPage, setEvPage] = useState(1);
  const showOnExpand = "max-lg:hidden max-lg:group-hover:block lg:block";

  const EV_PER = 4;
  const evTotal = Math.max(1, Math.ceil(events.length / EV_PER));
  const evCur = Math.min(evPage, evTotal);
  const evShown = events.slice((evCur - 1) * EV_PER, evCur * EV_PER);

  // 한 줄 렌더(일반/부서 공통)
  const renderRow = (b: Board) => {
    const isActive = active === b.slug;
    return (
      <Link
        key={b.slug}
        href={`/b/${b.slug}`}
        title={b.name}
        className={`flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive ? "bg-primary-soft text-primary font-semibold" : "text-foreground/80 hover:bg-primary-soft hover:text-primary"
        }`}
      >
        <span className={`shrink-0 w-6 h-6 grid place-items-center rounded-md text-[11px] font-bold ${b.anon ? "bg-pink-soft text-pink" : b.dept ? "bg-primary-soft text-primary" : "bg-background text-muted"}`}>{b.dept ? "🏢" : b.tag}</span>
        <span className={`flex-1 truncate ${showOnExpand}`}>{b.name}</span>
        {b.anon && <span className={`text-[10px] text-pink font-bold ${showOnExpand}`}>익명</span>}
        {b.hasNew && <NewBadge className={showOnExpand} />}
      </Link>
    );
  };

  useEffect(() => {
    api<Board[]>("/api/boards").then((bs) => setBoards(Object.fromEntries(bs.map((b) => [b.slug, b])))).catch(() => {});
    api<Notice[]>("/api/notices").then(setNotices).catch(() => {});
  }, []);

  useEffect(() => {
    // 진행 중 소식(이벤트)은 로그인 시에만
    if (user) api<Ev[]>("/api/events").then(setEvents).catch(() => {});
    else setEvents([]);
  }, [user]);

  return (
    <aside className="group relative z-30 flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:contents max-lg:absolute max-lg:left-0 max-lg:top-0 max-lg:w-14 max-lg:group-hover:w-64 transition-[width] duration-200 ease-out">
        <AccountCard />

        <nav className="bg-card border border-border rounded-2xl overflow-hidden p-2">
          {(() => {
            // 부서·동호회(전용 게시판) — 서버가 내 멤버십 기준으로만 내려줌
            const depts = Object.values(boards).filter((b) => b.dept);
            const multi = depts.length >= 2;
            // 펼칠 때 패널 높이를 유지하기 위해 숨길 항목 우선순위(소통 → 정보 → 생활)
            const hideOrder = ["free", "qna", "anon", "news", "tips", "gallery", "market"];
            const hidden = new Set(multi && deptOpen ? hideOrder.slice(0, depts.length) : []);
            return GROUPS.map((g) => {
              const isComm = g.group === "소통";
              const visible = g.slugs.filter((s) => !hidden.has(s) && boards[s]);
              if (visible.length === 0 && !(isComm && depts.length > 0)) return null;
              return (
                <div key={g.group} className="mb-1 last:mb-0">
                  <p className={`px-3 pt-2 pb-1 text-[11px] font-bold text-muted tracking-wide ${showOnExpand}`}>{g.group}</p>
                  {visible.map((s) => renderRow(boards[s]))}
                  {isComm && depts.length === 1 && renderRow(depts[0])}
                  {isComm && multi && (
                    <>
                      <button
                        onClick={() => setDeptOpen((v) => !v)}
                        title="내 부서·동호회"
                        className="flex items-center gap-2 w-full px-2 lg:px-3 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-primary-soft hover:text-primary"
                      >
                        <span className="shrink-0 w-6 h-6 grid place-items-center rounded-md text-[11px] bg-primary-soft text-primary">🏢</span>
                        <span className={`flex-1 truncate text-left ${showOnExpand}`}>내 부서·동호회</span>
                        <span className={`text-[10px] font-bold text-primary ${showOnExpand}`}>{depts.length}</span>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                          className={`w-4 h-4 text-primary transition-transform duration-300 ${deptOpen ? "rotate-180" : "chev-bounce"} ${showOnExpand}`}>
                          <path d="M3.5 6l4.5 4.5L12.5 6" />
                        </svg>
                      </button>
                      {deptOpen && depts.map(renderRow)}
                    </>
                  )}
                </div>
              );
            });
          })()}
          <div className="mb-1">
            <p className={`px-3 pt-2 pb-1 text-[11px] font-bold text-muted tracking-wide ${showOnExpand}`}>운영</p>
            {[{ t: "공지사항", i: "📢" }, { t: "건의/제안", i: "💡" }, { t: "신고/문의", i: "🚨" }].map((m) => (
              <span key={m.t} title={m.t} className="flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-primary-soft hover:text-primary cursor-pointer">
                <span className="shrink-0 w-6 h-6 grid place-items-center text-sm">{m.i}</span>
                <span className={`flex-1 truncate ${showOnExpand}`}>{m.t}</span>
              </span>
            ))}
          </div>
        </nav>
      </div>

      <section className="hidden lg:block bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5">📌 공지사항</h3>
        <ul className="space-y-1.5">
          {notices.map((n) => (
            <li key={n.id}>
              <a href="#" className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary">
                <span className="flex-1 truncate">{n.title}</span>
                <span className="text-xs text-muted shrink-0">{n.time}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${user ? "hidden lg:flex" : "hidden"} flex-col flex-1 bg-card border border-border rounded-2xl p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm flex items-center gap-1.5">🎈 진행 중 소식</h3>
          {evTotal > 1 && (
            <div className="flex items-center gap-0.5 text-[11px] text-muted">
              <button onClick={() => setEvPage(Math.max(1, evCur - 1))} disabled={evCur === 1} className="px-1.5 py-0.5 rounded font-bold hover:bg-background disabled:opacity-40">‹</button>
              <span className="font-semibold tabular-nums">{evCur}/{evTotal}</span>
              <button onClick={() => setEvPage(Math.min(evTotal, evCur + 1))} disabled={evCur === evTotal} className="px-1.5 py-0.5 rounded font-bold hover:bg-background disabled:opacity-40">›</button>
            </div>
          )}
        </div>
        <ul className="space-y-3">
          {evShown.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="block group/ev">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold group-hover/ev:text-primary">{e.title}</span>
                  <span className="text-xs text-muted">{e.desc}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-background overflow-hidden">
                  <div className="h-full rounded-full bg-pink" style={{ width: `${e.pct}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
