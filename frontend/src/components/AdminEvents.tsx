"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Kind = "poll" | "comment" | "date";
type Ev = { id: number; type: Kind; title: string; desc: string; target: string; deadline: string; participants: number };
const GROUPS = ["개발팀", "디자인팀", "기획팀", "마케팅팀", "경영지원팀"];
const KIND_LABEL: Record<Kind, string> = { poll: "투표", comment: "댓글", date: "날짜" };

export default function AdminEvents() {
  const { user, loading } = useAuth();
  const [list, setList] = useState<Ev[]>([]);
  const [type, setType] = useState<Kind>("poll");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [dateCands, setDateCands] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "groups" | "custom">("all");
  const [selGroups, setSelGroups] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  // 기존 이벤트 관리(수정/삭제)
  const [editing, setEditing] = useState<Ev | null>(null);
  const [ef, setEf] = useState({ title: "", description: "", deadline: "", target: "" });
  const [editErr, setEditErr] = useState("");
  const [deleting, setDeleting] = useState<Ev | null>(null);

  const refresh = () => api<Ev[]>("/api/events").then(setList).catch(() => {});
  useEffect(() => { if (user?.isAdmin) refresh(); }, [user]);

  if (!loading && (!user || !user.isAdmin)) {
    return (
      <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
        <div><p className="text-foreground/70 mb-3">관리자(운영진)만 접근할 수 있는 페이지입니다.</p>
          <Link href="/" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">홈으로</Link></div>
      </div>
    );
  }

  const targetLabel = targetMode === "all" ? "전체" : targetMode === "groups" ? selGroups.join(", ") || "그룹 미선택" : custom.trim() || "개별 미입력";
  const reset = () => { setTitle(""); setDesc(""); setDeadline(""); setOptions(["", ""]); setDateCands(""); setTargetMode("all"); setSelGroups([]); setCustom(""); };
  const submit = async () => {
    setErr("");
    if (!title.trim()) { setErr("제목을 입력하세요."); return; }
    try {
      await api("/api/admin/events", { json: {
        type, title, description: desc, deadline, target: targetLabel,
        options: options.map((o) => o.trim()).filter(Boolean),
        candidate_dates: dateCands.split(",").map((d) => d.trim()).filter(Boolean),
      } });
      reset();
      refresh();
    } catch (e) { setErr((e as Error).message); }
  };
  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

  const openEdit = (e: Ev) => { setEditing(e); setEditErr(""); setEf({ title: e.title, description: e.desc, deadline: e.deadline, target: e.target }); };
  const saveEdit = async () => {
    if (!editing) return;
    if (!ef.title.trim()) { setEditErr("제목을 입력하세요."); return; }
    try { await api(`/api/admin/events/${editing.id}`, { method: "PUT", json: ef }); setEditing(null); refresh(); }
    catch (e) { setEditErr((e as Error).message); }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try { await api(`/api/admin/events/${deleting.id}`, { method: "DELETE" }); setDeleting(null); refresh(); }
    catch (e) { setEditErr((e as Error).message); }
  };

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="bg-card border border-border rounded-2xl px-5 lg:h-24 py-4 flex flex-col justify-center">
        <h1 className="text-lg font-extrabold">🛠️ 이벤트 관리</h1>
        <p className="text-sm text-muted mt-0.5">투표·댓글·날짜 이벤트를 만들고 관리합니다 (관리자 전용)</p>
      </div>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-sm">새 이벤트 만들기</h2>
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">유형</label>
          <div className="flex flex-wrap gap-2">
            {([["poll", "📊 투표"], ["comment", "💬 댓글 이벤트"], ["date", "📅 날짜 투표"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setType(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${type === v ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground/70 hover:border-primary"}`}>{label}</button>
            ))}
          </div>
        </div>
        <div><label className="block text-xs font-bold text-muted mb-1.5">제목</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 3분기 팀 회식 일정" className={inputCls} /></div>
        <div><label className="block text-xs font-bold text-muted mb-1.5">설명</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="이벤트 안내 문구" className={`${inputCls} resize-y`} /></div>
        <div><label className="block text-xs font-bold text-muted mb-1.5">마감일</label><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none" /></div>

        {type === "poll" && (
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">투표 선택지</label>
            <div className="space-y-2">{options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input value={o} onChange={(e) => setOptions(options.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`선택지 ${i + 1}`} className={`flex-1 ${inputCls}`} />
                <button onClick={() => options.length > 2 && setOptions(options.filter((_, k) => k !== i))} disabled={options.length <= 2} className="shrink-0 w-9 rounded-lg border border-border text-muted hover:text-pink disabled:opacity-40">−</button>
              </div>))}</div>
            <button onClick={() => setOptions([...options, ""])} className="mt-2 text-sm font-semibold text-primary hover:underline">+ 선택지 추가</button>
          </div>
        )}
        {type === "date" && (
          <div><label className="block text-xs font-bold text-muted mb-1.5">후보 날짜 (YYYY-MM-DD, 쉼표 구분)</label>
            <input value={dateCands} onChange={(e) => setDateCands(e.target.value)} placeholder="2026-07-03, 2026-07-04, 2026-07-08" className={inputCls} />
            <p className="text-[11px] text-muted mt-1.5">→ 참여자는 날짜별 시계(오전 8시~오후 8시)에서 가능 시간을 칠합니다.</p></div>
        )}

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">투표 대상</label>
          <div className="flex flex-wrap gap-2">{([["all", "전체"], ["groups", "그룹 지정"], ["custom", "개별 지정"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setTargetMode(v)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${targetMode === v ? "bg-primary-soft text-primary border-primary" : "bg-background border-border text-foreground/70 hover:border-primary"}`}>{label}</button>))}</div>
          {targetMode === "groups" && <div className="flex flex-wrap gap-2 mt-2">{GROUPS.map((g) => (
            <button key={g} onClick={() => setSelGroups((s) => (s.includes(g) ? s.filter((x) => x !== g) : [...s, g]))} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${selGroups.includes(g) ? "bg-primary text-white border-primary" : "bg-background border-border text-foreground/70 hover:border-primary"}`}>{g}</button>))}</div>}
          {targetMode === "custom" && <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="이름/사번을 쉼표로 입력" className={`${inputCls} mt-2`} />}
          <p className="text-[11px] text-muted mt-1.5">현재 대상: <span className="font-semibold text-foreground/70">{targetLabel}</span></p>
        </div>

        {err && <p className="text-sm text-pink font-semibold">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={reset} className="px-4 py-2 rounded-xl bg-card border border-border text-sm font-semibold text-foreground/70 hover:border-primary">초기화</button>
          <button onClick={submit} disabled={!title.trim()} className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40">만들기</button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        <h2 className="font-bold text-sm px-4 py-3 border-b border-border">진행 중 이벤트</h2>
        <ul className="p-1.5">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-background">
              <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary-soft text-primary">{KIND_LABEL[e.type]}</span>
              <Link href={`/events/${e.id}`} className="flex-1 truncate text-sm font-semibold hover:text-primary">{e.title}</Link>
              <span className="text-xs text-muted hidden lg:inline">대상 {e.target}</span>
              <span className="text-xs text-muted hidden sm:inline">참여 {e.participants}명</span>
              <span className="text-xs text-muted hidden sm:inline">마감 {e.deadline || "-"}</span>
              <button onClick={() => openEdit(e)} className="shrink-0 text-xs font-semibold text-primary border border-border rounded-lg px-2 py-1 hover:border-primary">수정</button>
              <button onClick={() => setDeleting(e)} className="shrink-0 text-xs font-semibold text-pink border border-border rounded-lg px-2 py-1 hover:border-pink">삭제</button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">이벤트가 없습니다.</li>}
        </ul>
      </section>

      {/* 수정 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md bg-card rounded-2xl border border-border p-6 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">{KIND_LABEL[editing.type]} 이벤트 수정</h3>
            <div><label className="block text-xs font-bold text-muted mb-1">제목</label><input value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-xs font-bold text-muted mb-1">설명</label><textarea value={ef.description} onChange={(e) => setEf({ ...ef, description: e.target.value })} rows={2} className={`${inputCls} resize-y`} /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="block text-xs font-bold text-muted mb-1">마감일</label><input value={ef.deadline} onChange={(e) => setEf({ ...ef, deadline: e.target.value })} placeholder="YYYY-MM-DD" className={inputCls} /></div>
              <div className="flex-1"><label className="block text-xs font-bold text-muted mb-1">대상</label><input value={ef.target} onChange={(e) => setEf({ ...ef, target: e.target.value })} placeholder="전체 / 개발팀 …" className={inputCls} /></div>
            </div>
            <p className="text-[11px] text-muted">선택지·후보 날짜는 투표 진행 중이라 변경할 수 없습니다.</p>
            {editErr && <p className="text-xs text-pink font-semibold">{editErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-background text-sm font-semibold text-foreground/70">취소</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 모달 */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">이벤트 삭제</h3>
            <p className="text-sm text-muted mt-2">‘{deleting.title}’ 이벤트를 삭제할까요? 투표·참여 내역도 함께 사라집니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-xl bg-background text-sm font-semibold text-foreground/70">취소</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-pink text-white text-sm font-bold">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
