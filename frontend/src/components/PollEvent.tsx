"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EventData } from "@/app/events/[id]/page";

export default function PollEvent({ event, reload }: { event: EventData; reload: () => void }) {
  const { user } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const options = event.options ?? [];
  const abstain = event.abstain ?? 0;
  const total = options.reduce((s, o) => s + o.votes, 0) + abstain;
  const voted = event.myVote !== null && event.myVote !== undefined;
  const maxVotes = Math.max(...options.map((o) => o.votes), 0);

  const pick = async (optionId: number | null) => {
    if (!user || voted || busy) return;  // 첫 투표 직후 reload 전 연타 차단
    setBusy(true);
    setErr("");
    try { await api(`/api/events/${event.id}/vote`, { json: { option_id: optionId } }); reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary">📊 투표</span>
          {event.target && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-background text-muted">대상 · {event.target}</span>}
        </div>
        <h1 className="text-2xl font-extrabold mt-3">{event.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted">
          <span>마감 {event.deadline}</span><span>· 참여 {total.toLocaleString()}명</span>{!voted && <span>· 아직 미투표</span>}
        </div>
        {event.body && <p className="mt-4 text-[15px] leading-7 text-foreground/90">{event.body}</p>}

        <div className="mt-5 space-y-3">
          {options.map((o) => {
            const pct = total ? Math.round((o.votes / total) * 100) : 0;
            const mine = event.myVote === o.id;
            const leading = o.votes === maxVotes && maxVotes > 0;
            return (
              <button key={o.id} onClick={() => pick(o.id)} disabled={!user || voted || busy}
                className={`relative w-full overflow-hidden rounded-xl border-2 text-left px-4 py-4 transition-colors ${mine ? "border-primary" : "border-border"} ${user && !voted ? "hover:border-primary cursor-pointer" : "cursor-default"}`}>
                <span className={`absolute inset-y-0 left-0 transition-all ${mine ? "bg-primary-soft" : "bg-background"}`} style={{ width: `${pct}%` }} />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm flex items-center gap-1.5">{o.label}{leading && <span className="text-[10px] text-pink font-bold">선두</span>}{mine && <span className="text-[10px] text-primary font-bold">내 선택</span>}</span>
                  <span className="text-xs text-muted font-semibold shrink-0">{o.votes.toLocaleString()}명 · {pct}%</span>
                </span>
              </button>
            );
          })}
          <button onClick={() => pick(null)} disabled={!user || voted || busy}
            className={`w-full rounded-xl border-2 border-dashed text-left px-4 py-3 flex items-center justify-between ${event.myVote === "abstain" ? "border-pink text-pink" : "border-border text-muted"} ${user && !voted ? "hover:border-pink cursor-pointer" : "cursor-default"}`}>
            <span className="text-sm font-semibold flex items-center gap-1.5">기권 · 참여 안 함{event.myVote === "abstain" && <span className="text-[10px] font-bold">내 선택</span>}</span>
            <span className="text-xs font-semibold shrink-0">{abstain.toLocaleString()}명</span>
          </button>
        </div>

        {err && <p className="mt-3 text-sm text-pink text-center">{err}</p>}
        {!user ? (
          <div className="mt-4 rounded-xl bg-background p-3 text-center text-sm text-foreground/70">현재 결과를 보고 있어요. 투표하려면 <Link href="/login" className="text-primary font-semibold">로그인</Link></div>
        ) : voted ? (
          <p className="mt-4 text-center text-sm text-primary font-semibold">투표 완료! 🎉</p>
        ) : (
          <p className="mt-4 text-center text-xs text-muted">항목을 선택하면 바로 투표됩니다 (1인 1표)</p>
        )}
      </section>
    </div>
  );
}
