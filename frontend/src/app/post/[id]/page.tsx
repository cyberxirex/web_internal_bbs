"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LeftPanel from "@/components/LeftPanel";
import ImageCarousel from "@/components/ImageCarousel";
import LinkPreview from "@/components/LinkPreview";
import ProfanityModal from "@/components/ProfanityModal";
import { api, imgUrl, relTime, uploadImage } from "@/lib/api";
import { extractUrls, youtubeId } from "@/lib/links";
import { useAuth } from "@/lib/auth";

type Post = {
  id: number; boardSlug: string; board: string; color: string; title: string; body: string;
  author: string; votes: number; comments: number; views: number; createdAt: string;
  images: string[]; isAnon: boolean; voted: boolean; mine: boolean; pinned: boolean;
};
type Comment = { id: number; author: string; body: string; votes: number; createdAt: string; images: string[] };

export default function PostPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const { user, loading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);  // 확대된 댓글 이미지 키(commentId-index)

  const load = useCallback(() => {
    setErr("");
    api<Post>(`/api/posts/${id}`)
      .then((p) => { setPost(p); return api<Comment[]>(`/api/posts/${id}/comments`); })
      .then(setComments)
      .catch((e) => setErr(e.message));
  }, [id]);

  useEffect(() => { if (!loading) load(); }, [load, loading, user]);

  const pin = async () => {
    if (!post) return;
    await api(`/api/admin/posts/${id}/pin`, { json: { pinned: !post.pinned } });
    load();
  };
  const vote = async () => {
    if (!post) return;
    const r = await api<{ voted: boolean; votes: number }>(`/api/posts/${id}/vote`, { method: "POST" });
    setPost({ ...post, voted: r.voted, votes: r.votes });
  };
  const onCommentPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
    if (imgs.length === 0) return;
    e.preventDefault();
    for (const it of imgs) {
      const f = it.getAsFile();
      if (f) try { const url = await uploadImage(f); setCommentImages((p) => [...p, url]); } catch {}
    }
  };
  const submitComment = async () => {
    if (!text.trim() && commentImages.length === 0) return;
    try {
      await api(`/api/posts/${id}/comments`, { json: { body: text, images: commentImages } });
      setText("");
      setCommentImages([]);
      setComments(await api<Comment[]>(`/api/posts/${id}/comments`));
    } catch (e) {
      if ((e as Error).message.includes("사용할 수 없는")) setProfanity(true);
      else alert((e as Error).message);
    }
  };
  const [profanity, setProfanity] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState("");
  const openDelete = () => { setDelPw(""); setDelErr(""); setConfirmDel(true); };
  const doDelete = async () => {
    if (!post) return;
    if (post.isAnon && delPw.length !== 4) { setDelErr("4자리 숫자 비밀번호를 입력하세요."); return; }
    try {
      await api(`/api/posts/${id}/delete`, { json: { password: post.isAnon ? delPw : null } });
      router.push(`/b/${post.boardSlug}`);
    } catch (e) { setDelErr((e as Error).message); }
  };

  const wrap = (inner: React.ReactNode) => (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel active={post?.boardSlug} />
        {inner}
      </div>
    </main>
  );

  if (err) {
    return wrap(
      <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
        <div>
          <p className="text-foreground/70 mb-3">{err.includes("로그인") ? "게시글은 로그인 후 볼 수 있습니다." : err}</p>
          {err.includes("로그인") && <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">로그인하러 가기</Link>}
        </div>
      </div>,
    );
  }
  if (!post) return wrap(<div className="min-w-0 flex-1 py-20 text-center text-muted">불러오는 중…</div>);

  return wrap(
    <div className="min-w-0 flex flex-col gap-4">
      <article className="bg-card rounded-2xl border border-border p-6">
        <div className="text-sm text-muted flex items-center gap-1.5 mb-4">
          <Link href="/" className="hover:text-primary">홈</Link><span>›</span>
          <Link href={`/b/${post.boardSlug}`} className="hover:text-primary">{post.board}</Link>
        </div>
        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${post.color === "pink" ? "bg-pink-soft text-pink" : "bg-primary-soft text-primary"}`}>{post.board}</span>
        <h1 className="text-2xl font-extrabold mt-3 leading-snug">{post.title}</h1>
        <div className="flex items-center gap-3 mt-3 text-xs text-muted">
          <span className="font-semibold text-foreground/70">{post.author}</span>
          <span>· {relTime(post.createdAt)} 전</span><span>· 조회 {post.views}</span><span>· 댓글 {comments.length}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {user?.isAdmin && (
              <button onClick={pin} className={`shrink-0 font-bold rounded-lg px-2.5 py-1 border ${post.pinned ? "text-primary border-primary bg-primary-soft" : "text-muted border-border hover:border-primary hover:text-primary"}`}>📌 {post.pinned ? "고정 해제" : "고정"}</button>
            )}
            {(post.isAnon || post.mine || user?.isAdmin) && (
              <button onClick={openDelete} className="shrink-0 font-bold text-pink border border-pink/40 rounded-lg px-2.5 py-1 hover:bg-pink-soft">🗑️ 삭제</button>
            )}
          </span>
        </div>

        {post.images.length > 0 && <ImageCarousel images={post.images.map(imgUrl)} alt={post.title} />}

        <div className="mt-6 text-[15px] leading-7 text-foreground/90 whitespace-pre-line min-h-[120px]">{post.body}</div>

        {/* 본문 링크 자동 임베드: 유튜브 → 플레이어 / 그 외 → 미리보기 카드 */}
        {extractUrls(post.body).map((u, i) => {
          const yt = youtubeId(u);
          return yt ? (
            <div key={i} className="mt-4 relative w-full aspect-video rounded-xl overflow-hidden bg-black">
              <iframe src={`https://www.youtube.com/embed/${yt}`} title="YouTube" className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <LinkPreview key={i} url={u} />
          );
        })}

        <div className="mt-8 flex flex-col items-center gap-3">
          <button onClick={vote} className={`flex flex-col items-center justify-center w-20 py-3 rounded-2xl border-2 transition-all ${post.voted ? "border-pink bg-pink-soft text-pink scale-[1.03]" : "border-border bg-card text-foreground/70 hover:border-pink hover:text-pink"}`}>
            <span className="text-xl leading-none">{post.voted ? "💖" : "🤍"}</span>
            <span className="text-lg font-extrabold mt-1">{post.votes}</span>
            <span className="text-[11px] font-semibold">공감</span>
          </button>
        </div>
      </article>

      <section className="bg-card rounded-2xl border border-border p-5 flex-1">
        <h2 className="font-bold text-sm mb-4">댓글 <span className="text-pink">{comments.length}</span></h2>
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-bold shrink-0">{c.author.slice(0, 2)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-foreground/80">{c.author}</span><span className="text-muted">{relTime(c.createdAt)} 전</span></div>
                {c.body && <p className="text-sm text-foreground/90 mt-0.5">{c.body}</p>}
                {c.images.length > 0 && (
                  <div className="flex flex-wrap items-start gap-2 mt-2">
                    {c.images.map((u, i) => {
                      const key = `${c.id}-${i}`;
                      const open = zoom === key;
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={imgUrl(u)}
                          alt=""
                          onClick={() => setZoom(open ? null : key)}
                          className={open
                            ? "w-full max-h-[26rem] object-contain rounded-lg border border-border cursor-zoom-out bg-background"
                            : "h-20 w-20 object-cover rounded-lg border border-border cursor-zoom-in hover:opacity-90"}
                        />
                      );
                    })}
                  </div>
                )}
                {extractUrls(c.body).map((u, i) => {
                  const yt = youtubeId(u);
                  return yt ? (
                    <div key={i} className="mt-2 max-w-sm relative aspect-video rounded-lg overflow-hidden bg-black">
                      <iframe src={`https://www.youtube.com/embed/${yt}`} title="YouTube" className="absolute inset-0 w-full h-full" allowFullScreen />
                    </div>
                  ) : (
                    <div key={i} className="max-w-sm"><LinkPreview url={u} /></div>
                  );
                })}
              </div>
            </li>
          ))}
          {comments.length === 0 && <p className="text-sm text-muted text-center py-4">첫 댓글을 남겨보세요!</p>}
        </ul>
        <div className="mt-5">
          <div className="flex gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onPaste={onCommentPaste} rows={2} placeholder="따뜻한 댓글을 남겨주세요 (이미지 Ctrl+V · 링크 자동)" className="flex-1 bg-background rounded-xl px-3 py-2 text-sm outline-none border border-border resize-none placeholder:text-muted" />
            <button onClick={submitComment} className="shrink-0 px-4 rounded-xl bg-primary text-white font-bold text-sm">등록</button>
          </div>
          {commentImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {commentImages.map((u, i) => (
                <span key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(u)} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                  <button onClick={() => setCommentImages(commentImages.filter((_, k) => k !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink text-white text-xs">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-between">
        <Link href={`/b/${post.boardSlug}`} className="px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold text-foreground/70 hover:border-primary hover:text-primary">← 목록</Link>
        <Link href={`/write?board=${post.boardSlug}`} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90">글쓰기</Link>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setConfirmDel(false)}>
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">글 삭제</h3>
            <p className="text-sm text-muted mt-2">이 글을 삭제할까요? 댓글도 함께 삭제됩니다.</p>
            {post.isAnon && (
              <input value={delPw} onChange={(e) => setDelPw(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0000" autoFocus
                className="mt-3 w-32 text-center tracking-[0.4em] bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none font-bold" />
            )}
            {delErr && <p className="text-xs text-pink mt-2 font-semibold">{delErr}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-4 py-2 rounded-xl bg-background text-sm font-semibold text-foreground/70 hover:text-foreground">취소</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-xl bg-pink text-white text-sm font-bold hover:opacity-90">삭제</button>
            </div>
          </div>
        </div>
      )}
      <ProfanityModal open={profanity} onClose={() => setProfanity(false)} />
    </div>,
  );
}
