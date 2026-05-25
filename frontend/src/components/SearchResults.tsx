"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, relTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Row = { id: number; board: string; color: string; boardSlug: string; title: string; snippet: string; author: string; votes: number; comments: number; createdAt: string };

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark className="bg-pink-soft text-pink rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

export default function SearchResults({ q }: { q: string }) {
  const { user, loading } = useAuth();
  const query = q.trim();
  const [results, setResults] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!query) { setResults([]); return; }
    setErr("");
    api<{ results: Row[] }>(`/api/search?q=${encodeURIComponent(query)}`).then((d) => setResults(d.results)).catch((e) => setErr(e.message));
  }, [query, loading, user]);

  if (err.includes("로그인")) {
    return (
      <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
        <div><p className="text-foreground/70 mb-3">검색은 로그인 후 이용할 수 있습니다.</p>
          <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">로그인하러 가기</Link></div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="bg-card border border-border rounded-2xl px-5 lg:h-24 py-4 flex flex-col justify-center">
        <h1 className="text-lg font-extrabold">{query ? <>‘<span className="text-primary">{query}</span>’ 검색 결과</> : "검색"}</h1>
        <p className="text-sm text-muted mt-0.5">{query ? `총 ${results.length}건` : "검색어를 입력하세요"}</p>
      </div>
      <section className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        {!query || results.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted">{query ? `‘${query}’에 대한 검색 결과가 없습니다.` : "상단 검색창에 검색어를 입력해 보세요."}</p>
        ) : (
          <ul className="p-1.5">
            {results.map((p) => (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} className="block px-3 py-3 rounded-lg hover:bg-background border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${p.color === "pink" ? "bg-pink-soft text-pink" : "bg-primary-soft text-primary"}`}>{p.board}</span>
                    <span className="flex-1 truncate text-sm font-semibold">{highlight(p.title, query)}</span>
                    <span className="shrink-0 text-xs text-muted">{relTime(p.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted mt-1 line-clamp-1">{highlight(p.snippet, query)}</p>
                  <div className="text-[11px] text-muted mt-1">{p.author} · 💖 {p.votes} · 💬 {p.comments}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
