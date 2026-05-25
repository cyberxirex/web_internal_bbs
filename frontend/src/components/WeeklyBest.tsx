"use client";
import Link from "next/link";
import { useState } from "react";
import type { PostRowData } from "./PostRow";

type Metric = "votes" | "views" | "comments";
const METRICS: [Metric, string, string][] = [["votes", "공감", "💖"], ["views", "조회", "👁"], ["comments", "댓글", "💬"]];
const PER = 5;
const MAX = 15;

export default function WeeklyBest({ posts }: { posts: PostRowData[] }) {
  const [metric, setMetric] = useState<Metric>("votes");
  const [page, setPage] = useState(1);
  const icon = METRICS.find((m) => m[0] === metric)![2];

  const ranked = [...posts].sort((a, b) => ((b[metric] as number) ?? 0) - ((a[metric] as number) ?? 0)).slice(0, MAX);
  const totalPages = Math.max(1, Math.ceil(ranked.length / PER));
  const cur = Math.min(page, totalPages);
  const pageItems = ranked.slice((cur - 1) * PER, cur * PER);

  const setMetricReset = (m: Metric) => { setMetric(m); setPage(1); };

  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <h2 className="font-bold text-sm flex items-center gap-1.5 shrink-0">🔥 이번 주 인기글</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 text-[11px] font-semibold text-muted">
            {METRICS.map(([key, label]) => (
              <button key={key} onClick={() => setMetricReset(key)} className={`px-2 py-0.5 rounded-full ${metric === key ? "bg-primary-soft text-primary" : "hover:bg-background"}`}>{label}</button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-0.5 text-[11px] text-muted border-l border-border pl-2">
              <button disabled={cur === 1} onClick={() => setPage(cur - 1)} className="px-1.5 py-0.5 rounded font-bold hover:bg-background disabled:opacity-40">‹</button>
              <span className="font-semibold tabular-nums">{cur}/{totalPages}</span>
              <button disabled={cur === totalPages} onClick={() => setPage(cur + 1)} className="px-1.5 py-0.5 rounded font-bold hover:bg-background disabled:opacity-40">›</button>
            </div>
          )}
        </div>
      </div>
      <ol className="p-1.5">
        {pageItems.map((p, i) => {
          const rank = (cur - 1) * PER + i;
          return (
            <li key={p.id}>
              <Link href={`/post/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-background transition-colors">
                <span className={`shrink-0 w-6 text-center font-extrabold text-sm ${rank < 3 ? "text-pink" : "text-muted"}`}>{rank + 1}</span>
                <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${p.color === "pink" ? "bg-pink-soft text-pink" : "bg-primary-soft text-primary"}`}>{p.board}</span>
                <span className="flex-1 truncate text-sm text-foreground/90">{p.title}</span>
                <span className="shrink-0 text-xs font-bold text-pink">{icon} {(p[metric] as number) ?? 0}</span>
              </Link>
            </li>
          );
        })}
        {ranked.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">글이 없습니다.</li>}
      </ol>
    </section>
  );
}
