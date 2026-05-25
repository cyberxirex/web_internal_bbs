"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LeftPanel from "@/components/LeftPanel";
import PollEvent from "@/components/PollEvent";
import CommentEvent from "@/components/CommentEvent";
import DatePoll from "@/components/DatePoll";
import { api } from "@/lib/api";
import { useFocusRefetch } from "@/lib/useFocusRefetch";

export type EventData = {
  id: number; type: "poll" | "comment" | "date"; title: string; desc?: string; body?: string;
  deadline: string; target: string; participants: number;
  options?: { id: number; label: string; votes: number }[]; abstain?: number; myVote?: number | "abstain" | null;
  entries?: { id: number; author: string; text: string; likes: number; liked: boolean }[];
  dates?: string[]; cells?: { date: string; hour: number; count: number; names: string[] }[]; mine?: { date: string; hour: number }[];
};

export default function EventPage() {
  const id = useParams().id as string;
  const [ev, setEv] = useState<EventData | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { api<EventData>(`/api/events/${id}`).then(setEv).catch((e) => setErr(e.message)); }, [id]);
  useEffect(load, [load]);
  useFocusRefetch(load);  // 다른 참여자의 투표/좋아요/가능시간을 탭 복귀 시 반영

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel />
        {err ? (
          <div className="min-w-0 flex-1 py-20 text-center text-muted">{err}</div>
        ) : !ev ? (
          <div className="min-w-0 flex-1 py-20 text-center text-muted">불러오는 중…</div>
        ) : ev.type === "poll" ? (
          <PollEvent event={ev} reload={load} />
        ) : ev.type === "date" ? (
          <DatePoll event={ev} />
        ) : (
          <CommentEvent event={ev} reload={load} />
        )}
      </div>
    </main>
  );
}
