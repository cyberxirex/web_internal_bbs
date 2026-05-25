"use client";
import Link from "next/link";
import { useState } from "react";
import PostRow, { type PostRowData } from "./PostRow";

type Board = { slug: string; name: string };
type Banner = { text: string; sub: string } | null;

const RANGES: [string, number | null][] = [["1h", 1], ["6h", 6], ["24h", 24], ["전체", null]];
const within = (iso: string | undefined, hours: number | null) =>
  hours === null || (iso ? Date.now() - new Date(iso).getTime() <= hours * 3600_000 : false);

function Column({ title, icon, posts, sort }: { title: string; icon: string; posts: PostRowData[]; sort: "votes" | "recent" }) {
  const [range, setRange] = useState<number | null>(null); // 기본 전체
  const filtered = posts
    .filter((p) => within(p.createdAt, range))
    .sort((a, b) => (sort === "votes" ? b.votes - a.votes : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()))
    .slice(0, 8);
  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-bold text-sm flex items-center gap-1.5"><span>{icon}</span>{title}</h2>
        <div className="flex gap-1 text-[11px] font-semibold text-muted">
          {RANGES.map(([label, h]) => (
            <button key={label} onClick={() => setRange(h)} className={`px-2 py-0.5 rounded-full ${range === h ? "bg-primary-soft text-primary" : "hover:bg-background"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="p-1.5">
        {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">해당 기간의 글이 없어요.</p>}
        {filtered.map((p) => <PostRow key={p.id} post={p} />)}
      </div>
    </section>
  );
}

export default function Feed({ banner, boards, posts }: { banner: Banner; boards: Board[]; posts: PostRowData[] }) {
  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl bg-gradient-to-r from-primary-soft to-pink-soft px-6 h-24 flex flex-col items-center justify-center text-center overflow-hidden">
        <span className="absolute top-2 right-3 text-[10px] text-muted font-semibold">사내 배너</span>
        <p className="font-bold text-foreground/90">{banner?.text ?? "사내 공지/홍보 배너"}</p>
        {banner?.sub && <p className="text-xs text-foreground/60 mt-1">{banner.sub}</p>}
      </div>

      <div className="flex gap-1 text-sm font-semibold overflow-x-auto pb-1">
        <Link href="/" className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-white">전체</Link>
        {boards.map((b) => (
          <Link key={b.slug} href={`/b/${b.slug}`} className="shrink-0 px-3 py-1.5 rounded-full bg-card border border-border text-foreground/70 hover:border-primary hover:text-primary">{b.name}</Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Column title="공감글" icon="👍" posts={posts} sort="votes" />
        <Column title="모아보기" icon="🆕" posts={posts} sort="recent" />
      </div>
    </div>
  );
}
