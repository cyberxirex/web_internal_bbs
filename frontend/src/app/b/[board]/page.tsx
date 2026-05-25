"use client";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeftPanel from "@/components/LeftPanel";
import NewBadge from "@/components/NewBadge";
import { api, imgUrl, relTime } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Board = { slug: string; name: string; anon: boolean; desc: string; color: string };
type Row = { id: number; board: string; color: string; title: string; author: string; votes: number; comments: number; views: number; createdAt: string; image: string | null; imageCount: number; isNew?: boolean };

export default function BoardPage() {
  const slug = useParams().board as string;
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Row[]>([]);
  const [pinned, setPinned] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const isGallery = slug === "gallery";

  useEffect(() => {
    setErr("");
    setPage(1);
    // 갤러리는 공개(비로그인도 열람, 블러). 그 외 게시판은 로그인 필요.
    const ep = isGallery ? "/api/gallery" : `/api/boards/${slug}/posts`;
    api<{ board: Board; posts: Row[]; pinned?: Row[] }>(ep)
      .then((d) => { setBoard(d.board); setPosts(d.posts); setPinned(d.pinned || []); })
      .catch((e) => setErr(e.message));
  }, [slug, isGallery]);

  const blurred = isGallery && !user;
  const PER = isGallery ? 9 : 15, MAX_PAGES = 6;
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(posts.length / PER)));
  const visible = posts.slice((page - 1) * PER, page * PER);

  const pager = totalPages > 1 && (
    <div className="flex justify-center gap-1 text-sm">
      <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="w-8 h-8 rounded-lg font-semibold bg-card border border-border text-foreground/70 hover:border-primary hover:text-primary disabled:opacity-40">‹</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 rounded-lg font-semibold ${n === page ? "bg-primary text-white" : "bg-card border border-border text-foreground/70 hover:border-primary hover:text-primary"}`}>{n}</button>
      ))}
      <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="w-8 h-8 rounded-lg font-semibold bg-card border border-border text-foreground/70 hover:border-primary hover:text-primary disabled:opacity-40">›</button>
    </div>
  );

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel active={slug} />
        <div className="min-w-0 flex flex-col gap-4">
          {err.includes("로그인") ? (
            <div className="flex-1 grid place-items-center py-20 text-center">
              <div>
                <p className="text-foreground/70 mb-3">게시판은 로그인 후 볼 수 있습니다.</p>
                <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">로그인하러 가기</Link>
              </div>
            </div>
          ) : err.includes("권한") ? (
            <div className="flex-1 grid place-items-center py-20 text-center">
              <div>
                <p className="text-foreground/70 mb-3">🔒 {err}</p>
                <Link href="/" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">홈으로</Link>
              </div>
            </div>
          ) : (
          <>
          <div className="bg-card rounded-2xl border border-border p-5 lg:h-24 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold flex items-center gap-2">
                {board?.name ?? slug}
                {board?.anon && <span className="text-[11px] font-bold text-pink bg-pink-soft px-2 py-0.5 rounded-full">익명</span>}
              </h1>
              <p className="text-sm text-muted mt-1">{board?.desc}</p>
            </div>
            <Link href={`/write?board=${slug}`} className="shrink-0 px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90">✏️ 글쓰기</Link>
          </div>

          {board?.anon && (
            <div className="rounded-xl bg-pink-soft text-pink text-xs px-4 py-2.5 font-medium">
              🔒 익명게시판입니다. 작성자와 IP를 기록하지 않으며, 글 삭제는 작성 시 정한 4자리 비밀번호로만 가능합니다. (수정 불가)
            </div>
          )}

          {err && !err.includes("로그인") && <p className="text-sm text-pink px-1">{err}</p>}

          {isGallery ? (
            <section className="flex-1 flex flex-col">
              {posts.length === 0 ? (
                <p className="bg-card rounded-2xl border border-border px-4 py-16 text-center text-sm text-muted">아직 사진이 없습니다.</p>
              ) : (
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 content-between">
                  {visible.map((p) => (
                    <Link key={p.id} href={blurred ? "/login" : `/post/${p.id}`} className="group relative block aspect-[4/3] rounded-2xl border border-border overflow-hidden bg-background">
                      {p.image && <Image src={imgUrl(p.image)} alt={blurred ? "" : p.title} fill sizes="(max-width: 640px) 50vw, 300px" className={`object-cover transition-transform ${blurred ? "blur-lg scale-110" : "group-hover:scale-105"}`} unoptimized />}
                      {p.imageCount > 1 && <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[11px] font-semibold">📷 {p.imageCount}</span>}
                      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3">
                        <p className="text-white text-sm font-bold truncate">{p.title}</p>
                        {blurred ? (
                          <p className="text-white/70 text-[11px] truncate">{p.author} · 🔒 로그인 후 보기</p>
                        ) : (
                          <p className="text-white/85 text-[11px] truncate">{p.author} · 💖 {p.votes} · 💬 {p.comments} · {relTime(p.createdAt)}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {pager && <div className="pt-4">{pager}</div>}
                </>
              )}
            </section>
          ) : (
            <>
            <section className="bg-card rounded-2xl border border-border overflow-hidden flex-1">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 border-b border-border text-xs font-bold text-muted">
                <span className="w-10 text-center">추천</span><span className="flex-1">제목</span><span className="w-20 text-right">작성자</span><span className="w-14 text-right">조회</span><span className="w-12 text-right">시간</span>
              </div>
              {pinned.map((p) => (
                <Link key={`pin-${p.id}`} href={`/post/${p.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-primary-soft/40 hover:bg-primary-soft transition-colors">
                  <span className="shrink-0 text-[11px] font-bold text-primary">📌 공지</span>
                  <span className="flex-1 truncate text-sm font-semibold text-foreground/90">{p.title}{p.comments > 0 && <span className="ml-1.5 text-xs font-bold text-pink">[{p.comments}]</span>}{p.isNew && <NewBadge className="ml-1.5 align-middle" />}</span>
                  <span className="hidden sm:block w-20 text-right text-xs text-muted truncate">{p.author}</span>
                  <span className="hidden sm:block w-14 text-right text-xs text-muted">{p.views}</span>
                  <span className="w-12 text-right text-xs text-muted">{relTime(p.createdAt)}</span>
                </Link>
              ))}
              {posts.length === 0 && pinned.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">아직 글이 없습니다. 첫 글을 남겨보세요!</p>}
              {visible.map((p) => (
                <Link key={p.id} href={`/post/${p.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0 hover:bg-background transition-colors">
                  <span className={`w-10 text-center text-xs font-bold py-1 rounded-md ${p.votes >= 50 ? "bg-pink-soft text-pink" : "bg-background text-muted"}`}>{p.votes}</span>
                  <span className="flex-1 truncate text-sm text-foreground/90">{p.title}{p.comments > 0 && <span className="ml-1.5 text-xs font-bold text-pink">[{p.comments}]</span>}{p.isNew && <NewBadge className="ml-1.5 align-middle" />}</span>
                  <span className="hidden sm:block w-20 text-right text-xs text-muted truncate">{p.author}</span>
                  <span className="hidden sm:block w-14 text-right text-xs text-muted">{p.views}</span>
                  <span className="w-12 text-right text-xs text-muted">{relTime(p.createdAt)}</span>
                </Link>
              ))}
            </section>
            {pager}
            </>
          )}
          </>
          )}
        </div>
      </div>
    </main>
  );
}
