"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventData } from "@/app/events/[id]/page";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function CommentEvent({ event, reload }: { event: EventData; reload: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [liking, setLiking] = useState(false);
  const entries = [...(event.entries ?? [])].sort((a, b) => b.likes - a.likes);

  const submit = async () => {
    if (!text.trim() || busy) return;  // 진행 중 연타 → 중복 등록 방지
    setBusy(true);
    try {
      await api(`/api/events/${event.id}/entries`, { json: { text } });
      setText("");
      reload();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(false); }
  };
  const like = async (entryId: number) => {
    if (!user || liking) return;
    setLiking(true);
    try { await api(`/api/events/entries/${entryId}/like`, { method: "POST" }); reload(); }
    catch (e) { alert((e as Error).message); }
    finally { setLiking(false); }
  };

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-pink-soft text-pink">💬 댓글 이벤트</span>
          {event.target && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-background text-muted">대상 · {event.target}</span>}
        </div>
        <h1 className="text-2xl font-extrabold mt-3">{event.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted"><span>마감 {event.deadline}</span><span>· 참여 {event.participants}명</span><span>· 좋아요 순 베스트 3</span></div>
        {event.body && <p className="mt-4 text-[15px] leading-7 text-foreground/90">{event.body}</p>}
        <div className="mt-5 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} disabled={!user} placeholder={user ? "맛집을 추천해 주세요" : "로그인 후 참여할 수 있어요"} className="flex-1 bg-background rounded-xl px-3 py-2 text-sm outline-none border border-border placeholder:text-muted disabled:opacity-60" />
          {user ? <button onClick={submit} disabled={busy} className="shrink-0 px-4 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-60">{busy ? "등록 중…" : "참여"}</button>
            : <Link href="/login" className="shrink-0 grid place-items-center px-4 rounded-xl bg-primary text-white font-bold text-sm">로그인</Link>}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        <h2 className="font-bold text-sm px-4 py-3 border-b border-border">🏆 추천 랭킹</h2>
        <ul className="p-1.5">
          {entries.map((e, i) => (
            <li key={e.id} className={`flex items-start gap-3 px-3 py-3 rounded-lg ${i < 3 ? "bg-pink-soft/40" : ""}`}>
              <span className="shrink-0 w-7 text-center font-extrabold text-sm">{i < 3 ? MEDALS[i] : i + 1}</span>
              <div className="min-w-0 flex-1"><p className="text-sm text-foreground/90">{e.text}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted"><span>{e.author}</span>{i < 3 && <span className="text-pink font-bold">베스트</span>}</div></div>
              <button onClick={() => like(e.id)} disabled={!user || liking} className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${e.liked ? "text-pink bg-pink-soft" : "text-muted hover:text-pink"} disabled:opacity-50`}>{e.liked ? "💖" : "🤍"} {e.likes}</button>
            </li>
          ))}
          {entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">첫 추천을 남겨보세요!</li>}
        </ul>
      </section>
    </div>
  );
}
