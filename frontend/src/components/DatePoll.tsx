"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventData } from "@/app/events/[id]/page";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const MEDALS = ["🥇", "🥈", "🥉"];
const ROMAN: [string, number][] = [["XII", 0], ["III", 90], ["VI", 180], ["IX", 270]];
const isoFmt = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const clockAngle = (h: number) => (h % 12) * 30;
const r2 = (n: number) => Math.round(n * 100) / 100;
const EX = 0.62;
const sq = (r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), EX);
  return [r2(50 + r * f(Math.cos(rad))), r2(50 + r * f(Math.sin(rad)))] as const;
};
function seg(rO: number, rI: number, d0: number, d1: number) {
  const N = 5, out: string[] = [], inn: string[] = [];
  for (let k = 0; k <= N; k++) { const t = d0 + ((d1 - d0) * k) / N; out.push(sq(rO, t).join(" ")); }
  for (let k = N; k >= 0; k--) { const t = d0 + ((d1 - d0) * k) / N; inn.push(sq(rI, t).join(" ")); }
  return "M " + [...out, ...inn].join(" L ") + " Z";
}

export default function DatePoll({ event, reload }: { event: EventData; reload: () => void }) {
  const { user } = useAuth();
  const dates = event.dates ?? [];
  const myName = user ? user.nickname : null;

  // 내 기여를 뺀 base(다른 사람들만)
  const base = useMemo(() => {
    const map = new Map<string, { count: number; names: string[] }>();
    const mineKeys = new Set((event.mine ?? []).map((m) => `${m.date}-${m.hour}`));
    (event.cells ?? []).forEach((c) => {
      let names = c.names.slice();
      let count = c.count;
      if (mineKeys.has(`${c.date}-${c.hour}`)) {
        if (myName) { const k = names.indexOf(myName); if (k >= 0) names.splice(k, 1); }
        count = Math.max(0, count - 1);
      }
      map.set(`${c.date}|${c.hour}`, { count, names });
    });
    return map;
  }, [event.cells, event.mine, myName]);

  const [mine, setMine] = useState<Set<string>>(new Set());
  useEffect(() => { setMine(new Set((event.mine ?? []).map((m) => `${m.date}-${m.hour}`))); }, [event.mine]);
  const [hover, setHover] = useState<{ d: string; h: number } | null>(null);
  const [selected, setSelected] = useState<{ d: string; h: number } | null>(null);
  const painting = useRef(false);
  const paintAdd = useRef(true);
  useEffect(() => { const up = () => (painting.current = false); window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  const key = (d: string, h: number) => `${d}-${h}`;
  const baseAt = (d: string, h: number) => base.get(`${d}|${h}`) ?? { count: 0, names: [] };
  const namesAt = (d: string, h: number) => {
    const b = baseAt(d, h);
    return mine.has(key(d, h)) && myName ? [`${myName} (나)`, ...b.names] : b.names;
  };
  const countAt = (d: string, h: number) => baseAt(d, h).count + (mine.has(key(d, h)) ? 1 : 0);

  let max = 1;
  for (const d of dates) for (const h of HOURS) max = Math.max(max, countAt(d, h));
  const ranked: { d: string; h: number; c: number }[] = [];
  for (const d of dates) for (const h of HOURS) { const c = countAt(d, h); if (c > 0) ranked.push({ d, h, c }); }
  ranked.sort((a, b) => b.c - a.c);
  const top = ranked.slice(0, 5);
  const medal = new Map<string, string>();
  MEDALS.forEach((m, i) => { if (top[i]) medal.set(key(top[i].d, top[i].h), m); });
  const panelCell = hover ?? selected ?? (top[0] ? { d: top[0].d, h: top[0].h } : null);
  const panelNames = panelCell ? namesAt(panelCell.d, panelCell.h) : [];

  const months = useMemo(() => {
    const set = new Set(dates.map((d) => d.slice(0, 7)));
    return [...set].sort().slice(0, 3).map((ym) => ({ y: +ym.slice(0, 4), m: +ym.slice(5, 7) - 1 }));
  }, [dates]);

  const apply = (d: string, h: number, add: boolean) => {
    setMine((s) => { const n = new Set(s); const k = key(d, h); if (add) n.add(k); else n.delete(k); return n; });
    api(`/api/events/${event.id}/availability`, { json: { date: d, hour: h, on: add } }).catch(() => {
      // 서버 저장 실패 → 낙관적 표시 롤백(거짓 표시 방지)
      setMine((s) => { const n = new Set(s); const k = key(d, h); if (add) n.delete(k); else n.add(k); return n; });
    });
  };
  const down = (d: string, h: number) => { setSelected({ d, h }); if (!user) return; paintAdd.current = !mine.has(key(d, h)); painting.current = true; apply(d, h, paintAdd.current); };
  const enter = (d: string, h: number) => { setHover({ d, h }); if (user && painting.current) apply(d, h, paintAdd.current); };
  const fmt = (d: string, h: number) => `${+d.slice(5, 7)}/${+d.slice(8, 10)} ${h}시`;

  const ClockDay = ({ d, day }: { d: string; day: number }) => (
    <svg viewBox="0 0 100 100" className="w-full max-w-[96px] mx-auto block select-none">
      <defs>
        {HOURS.map((h) => {
          const a = clockAngle(h); const [ox, oy] = sq(47, a); const [ix, iy] = sq(31, a);
          return (
            <linearGradient key={h} id={`g-${d}-${h}`} gradientUnits="userSpaceOnUse" x1={ox} y1={oy} x2={ix} y2={iy}>
              <stop offset="0" stopColor="#6c5ce7" stopOpacity="1" /><stop offset="0.4" stopColor="#6c5ce7" stopOpacity="0.45" />
              <stop offset="0.75" stopColor="#6c5ce7" stopOpacity="0.08" /><stop offset="1" stopColor="#6c5ce7" stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>
      {HOURS.map((h) => {
        const a = clockAngle(h); const c = countAt(d, h);
        const isMine = mine.has(key(d, h)); const isHover = hover?.d === d && hover?.h === h;
        return (
          <path key={h} d={seg(47, 31, a - 14, a + 14)} onMouseDown={() => down(d, h)} onMouseEnter={() => enter(d, h)} className="cursor-pointer"
            fill={c ? `url(#g-${d}-${h})` : "var(--background)"} fillOpacity={c ? Math.min(1, 0.3 + 0.7 * (c / max)) : undefined}
            stroke={isHover ? "var(--pink)" : isMine ? "var(--primary)" : "var(--border)"} strokeWidth={isHover ? 2.5 : isMine ? 2 : 0.6}>
            <title>{`${fmt(d, h)} · ${c}명`}</title>
          </path>
        );
      })}
      {ROMAN.map(([label, a]) => { const [x, y] = sq(39, a); return <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-foreground/55 pointer-events-none" fontSize="9" fontWeight="700">{label}</text>; })}
      {HOURS.map((h) => { const md = medal.get(key(d, h)); if (!md) return null; const [x, y] = sq(39, clockAngle(h)); return <text key={`m${h}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="11" className="pointer-events-none">{md}</text>; })}
      <text x="50" y="53" textAnchor="middle" className="fill-foreground pointer-events-none" fontSize="15" fontWeight="800">{day}</text>
    </svg>
  );

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary">📅 날짜 투표</span>
          {event.target && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-background text-muted">대상 · {event.target}</span>}
        </div>
        <h1 className="text-2xl font-extrabold mt-3">{event.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted"><span>마감 {event.deadline}</span><span>· 참여 {event.participants}명</span><span>· 내가 칠한 시간 {mine.size}</span></div>
        {event.body && <p className="mt-4 text-[15px] leading-7 text-foreground/90">{event.body}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 bg-background rounded-xl p-3 text-[11px] text-foreground/70">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" width="62" height="62" className="shrink-0">
              {HOURS.map((h) => { const a = clockAngle(h); return <path key={h} d={seg(47, 31, a - 14, a + 14)} fill="#ece9fb" stroke="var(--border)" strokeWidth="0.6" />; })}
              {[16, 17, 18, 19].map((h, i) => { const a = clockAngle(h); return <path key={`d${h}`} d={seg(47, 31, a - 14, a + 14)} fill="rgb(255,87,140)" className="demo-paint" style={{ animationDelay: `${i * 0.25}s` }} />; })}
              {ROMAN.map(([l, a]) => { const [x, y] = sq(39, a); return <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" className="fill-foreground/50">{l}</text>; })}
              <g><path d="M0 0 L0 17 L4.2 13 L7 18.6 L9.6 17.4 L6.8 11.9 L12 11.9 Z" fill="#fff" stroke="#1f2330" strokeWidth="1" strokeLinejoin="round" />
                <animateMotion dur="3s" repeatCount="indefinite" calcMode="linear" keyTimes="0;0.08;0.16;0.25;1" keyPoints="0;0.33;0.66;1;1" path={"M " + [16, 17, 18, 19].map((h) => sq(40, clockAngle(h)).join(" ")).join(" L ")} /></g>
            </svg>
            <span>🖱️ 시계 위에 가능한 시간을 칠해요</span>
          </div>
          <div className="flex items-center gap-2"><span>적음</span>
            <svg width="96" height="12" className="shrink-0"><defs><linearGradient id="legend-heat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="rgb(205,196,255)" /><stop offset="0.5" stopColor="rgb(108,92,231)" /><stop offset="1" stopColor="rgb(255,87,140)" /></linearGradient></defs><rect width="96" height="12" rx="6" fill="url(#legend-heat)" /></svg>
            <span>많음 = 가능 인원</span></div>
          <div className="flex items-center gap-1.5"><span className="grid place-items-center w-5 h-5 rounded-full bg-card border border-foreground/20 text-[11px]">🥇</span><span>가장 많이 겹치는 시간</span></div>
        </div>

        <div className="mt-3 space-y-6">
          {months.map(({ y, m }) => {
            const firstDow = new Date(y, m, 1).getDay();
            const days = new Date(y, m + 1, 0).getDate();
            const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
            while (cells.length % 7 !== 0) cells.push(null);
            // 후보 날짜가 있는 주만 남기고 빈 주는 제거 (월 넘김 시 길이 압축)
            const weeks: (number | null)[][] = [];
            for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
            const shown = weeks.filter((wk) => wk.some((day) => day !== null && dates.includes(isoFmt(y, m, day)))).flat();
            if (shown.length === 0) return null;
            return (
              <div key={`${y}-${m}`}>
                <h3 className="font-bold text-sm mb-2">{y}년 {m + 1}월</h3>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w, i) => <div key={w} className={`text-center text-[11px] font-bold pb-1 ${i === 0 ? "text-pink" : i === 6 ? "text-primary" : "text-muted"}`}>{w}</div>)}
                  {shown.map((day, i) => {
                    if (day === null) return <div key={i} />;
                    const d = isoFmt(y, m, day); const isCand = dates.includes(d);
                    return <div key={i} className={`min-h-[60px] rounded-lg border p-1 grid place-items-center ${isCand ? "border-border bg-card" : "border-transparent"}`}>
                      {isCand ? <ClockDay d={d} day={day} /> : <span className="text-[11px] font-bold text-muted/40 self-start justify-self-start">{day}</span>}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!user && <div className="mt-4 rounded-xl bg-background p-3 text-center text-sm text-foreground/70">집계를 보고 있어요. 가능 시간을 표시하려면 <Link href="/login" className="text-primary font-semibold">로그인</Link></div>}
      </section>

      <div className="grid md:grid-cols-2 gap-4" onMouseLeave={() => setHover(null)}>
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <h2 className="font-bold text-sm px-4 py-3 border-b border-border">🔥 가능 인원 많은 시간 TOP 5</h2>
          <ol className="p-1.5">
            {top.map((r, i) => { const on = panelCell?.d === r.d && panelCell?.h === r.h; return (
              <li key={`${r.d}-${r.h}`}><button onClick={() => setSelected({ d: r.d, h: r.h })} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-background ${on ? "bg-background" : ""}`}>
                <span className="shrink-0 w-6 text-center font-extrabold text-sm">{i < 3 ? MEDALS[i] : <span className="text-muted">{i + 1}</span>}</span>
                <span className="flex-1 text-sm font-semibold">{fmt(r.d, r.h)}</span><span className="shrink-0 text-xs font-bold text-pink">{r.c}명</span></button></li>); })}
            {top.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">아직 선택된 시간이 없습니다.</li>}
          </ol>
        </section>
        <section className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-bold text-sm mb-2">🙋 가능자{panelCell && <span className="text-muted font-medium"> · {fmt(panelCell.d, panelCell.h)} ({panelNames.length}명)</span>}</h2>
          {panelNames.length === 0 ? <p className="text-sm text-muted py-4 text-center">가능자가 없습니다.</p> : (
            <div className="flex flex-wrap gap-1.5">{panelNames.map((name, i) => <span key={i} className={`text-xs font-semibold px-2 py-1 rounded-full ${name.endsWith("(나)") ? "bg-primary text-white" : "bg-background text-foreground/70"}`}>{name}</span>)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
