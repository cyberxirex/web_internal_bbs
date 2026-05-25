"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import LeftPanel from "@/components/LeftPanel";
import ProfanityModal from "@/components/ProfanityModal";
import { api, imgUrl, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Board = { slug: string; name: string; anon: boolean };

function WriteForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState(sp.get("board") ?? "free");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pw, setPw] = useState("");
  const [pinned, setPinned] = useState(false);
  const [noticeBoards, setNoticeBoards] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [profanity, setProfanity] = useState(false);

  useEffect(() => { api<Board[]>("/api/boards").then(setBoards).catch(() => {}); }, []);
  useEffect(() => {
    if (user) api<{ noticeBoards: string[] }>("/api/me/permissions").then((d) => setNoticeBoards(d.noticeBoards)).catch(() => {});
  }, [user]);

  const isAnon = boards.find((b) => b.slug === board)?.anon;
  const canPin = noticeBoards.includes(board);
  const asNotice = canPin && pinned;  // 공지로 등록 → 익명게시판이어도 실명

  if (!loading && !user) {
    return (
      <div className="flex-1 grid place-items-center py-20 text-center">
        <div><p className="text-foreground/70 mb-3">글쓰기는 로그인 후 이용할 수 있습니다.</p>
          <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">로그인하러 가기</Link></div>
      </div>
    );
  }

  const boardName = boards.find((b) => b.slug === board)?.name ?? board;

  // 붙여넣기로 이미지 첨부 (텍스트·링크는 그대로 붙여넣기)
  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData.items).filter((it) => it.type.startsWith("image/"));
    if (imgs.length === 0) return;
    e.preventDefault();
    for (const it of imgs) {
      const f = it.getAsFile();
      if (!f) continue;
      try { const url = await uploadImage(f); setImages((prev) => [...prev, url]); }
      catch (err) { setErr((err as Error).message); }
    }
  };

  const submit = async () => {
    setErr("");
    if (!title.trim()) { setErr("제목을 입력하세요."); return; }
    if (isAnon && !asNotice && pw.length !== 4) { setErr("익명글은 4자리 삭제 비밀번호가 필요합니다."); return; }
    setBusy(true);
    try {
      const r = await api<{ id: number }>(`/api/boards/${board}/posts`, {
        json: { title, body, images, delete_password: isAnon && !asNotice ? pw : null, pinned: canPin ? pinned : false },
      });
      router.push(`/post/${r.id}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("사용할 수 없는")) setProfanity(true);
      else setErr(msg);
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 w-full space-y-4">
      <h1 className="text-xl font-extrabold flex items-center gap-2">
        글쓰기
        <span className="text-sm font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-full">{boardName}{isAnon ? (asNotice ? " · 공지(실명)" : " · 익명") : ""}</span>
      </h1>
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">내용</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onPaste={onPaste} rows={10} placeholder="내용을 입력하세요. 이미지는 복사 후 Ctrl+V로 붙여넣고, 유튜브·링크는 주소를 붙여넣으면 자동 표시됩니다." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none resize-y placeholder:text-muted" />
          <p className="text-[11px] text-muted mt-1.5">📋 이미지 붙여넣기(Ctrl+V) · 🔗 유튜브/링크 자동 미리보기</p>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((u, i) => (
                <span key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(u)} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                  <button onClick={() => setImages(images.filter((_, k) => k !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink text-white text-xs">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        {isAnon && !asNotice && (
          <div className="rounded-xl bg-pink-soft p-4">
            <p className="text-xs text-pink font-semibold mb-2">🔒 익명게시판은 작성자/IP를 기록하지 않습니다. 삭제용 4자리 숫자 비밀번호를 정해주세요. (수정 불가)</p>
            <input value={pw} onChange={(e) => setPw(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="0000" maxLength={4} className="w-28 text-center tracking-[0.4em] bg-card border border-pink/40 rounded-lg px-3 py-2 text-sm outline-none font-bold" />
          </div>
        )}
        {isAnon && asNotice && (
          <div className="rounded-xl bg-primary-soft p-4">
            <p className="text-xs text-primary font-semibold">📢 공지는 익명게시판이라도 <b>작성자 실명({user?.nickname})</b>으로 등록됩니다. 삭제 비밀번호 없이 본인/관리자가 삭제할 수 있습니다.</p>
          </div>
        )}
        {canPin && (
          <label className="flex items-center gap-2.5 rounded-xl bg-primary-soft/60 px-4 py-3 cursor-pointer select-none">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
            <span className="text-sm font-semibold text-primary">📌 공지로 등록 (게시판 맨 위에 항상 고정)</span>
          </label>
        )}
        {err && <p className="text-sm text-pink font-semibold">{err}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Link href="/" className="px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold text-foreground/70 hover:border-primary hover:text-primary">취소</Link>
        <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40">{busy ? "등록 중…" : "등록"}</button>
      </div>
      <ProfanityModal open={profanity} onClose={() => setProfanity(false)} />
    </div>
  );
}

export default function WritePage() {
  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel />
        <Suspense fallback={<div className="min-w-0 text-center text-muted py-10">불러오는 중…</div>}>
          <WriteForm />
        </Suspense>
      </div>
    </main>
  );
}
