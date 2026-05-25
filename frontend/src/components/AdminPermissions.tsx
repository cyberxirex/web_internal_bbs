"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type U = { id: number; username: string; nickname: string; isAdmin: boolean };
type B = { slug: string; name: string; anon: boolean; dept: boolean; noticerIds: number[]; memberIds: number[] };

/* 아바타 칩 — 우상단 x 오버레이로 제거 */
function Avatar({ u, onRemove, locked }: { u: U; onRemove?: () => void; locked?: boolean }) {
  return (
    <div className="relative flex flex-col items-center w-14 shrink-0">
      <div className="relative">
        <div className={`w-11 h-11 grid place-items-center rounded-full text-sm font-bold ${locked ? "bg-background text-muted" : "bg-primary-soft text-primary"}`} title={`${u.nickname} (@${u.username})`}>
          {u.nickname.slice(0, 1)}
        </div>
        {onRemove && (
          <button onClick={onRemove} title="제거" className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-pink text-white text-xs font-bold leading-none shadow-md ring-2 ring-card hover:scale-110 transition-transform">×</button>
        )}
        {locked && <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">🔒</span>}
      </div>
      <p className="mt-1 text-[10px] text-center text-foreground/70 truncate w-full">{u.nickname}</p>
    </div>
  );
}

/* 검색 + 자동완성으로 사용자 추가 */
function AddSearch({ candidates, onAdd, placeholder }: { candidates: U[]; onAdd: (u: U) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ql = q.trim().toLowerCase();
  const matches = (ql ? candidates.filter((u) => (u.nickname + " " + u.username).toLowerCase().includes(ql)) : candidates).slice(0, 8);
  return (
    <div className="relative w-52 min-w-0">
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <span className="text-muted text-sm">🔍</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      {open && (
        <ul className="absolute z-30 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted">추가할 사용자가 없습니다.</li>
          ) : (
            matches.map((u) => (
              <li key={u.id}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); onAdd(u); setQ(""); setOpen(false); }}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-background"
                >
                  <span className="w-7 h-7 grid place-items-center rounded-full bg-primary-soft text-primary text-xs font-bold shrink-0">{u.nickname.slice(0, 1)}</span>
                  <span className="text-sm font-semibold truncate">{u.nickname}</span>
                  <span className="text-xs text-muted truncate">@{u.username}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function AdminPermissions() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [boards, setBoards] = useState<B[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"notice" | "dept">("notice");
  const [newName, setNewName] = useState("");

  const refresh = () =>
    api<{ users: U[]; boards: B[] }>("/api/admin/permissions")
      .then((d) => { setUsers(d.users); setBoards(d.boards); })
      .catch((e) => setErr(e.message));
  useEffect(() => { if (user?.isAdmin) refresh(); }, [user]);

  if (!loading && (!user || !user.isAdmin)) {
    return (
      <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
        <div><p className="text-foreground/70 mb-3">관리자(운영진)만 접근할 수 있는 페이지입니다.</p>
          <Link href="/" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">홈으로</Link></div>
      </div>
    );
  }

  const flash = (m: string) => { setMsg(m); setErr(""); setTimeout(() => setMsg(""), 2500); };
  const byId = (id: number) => users.find((u) => u.id === id);
  const admins = users.filter((u) => u.isAdmin);

  const setRole = async (u: U, is_admin: boolean) => {
    setErr("");
    try { await api(`/api/admin/users/${u.id}/role`, { json: { is_admin } }); await refresh(); flash(`${u.nickname} 님을 ${is_admin ? "관리자로" : "일반 사용자로"} 변경했습니다.`); }
    catch (e) { setErr((e as Error).message); }
  };

  const setNoticers = async (b: B, ids: number[]) => {
    setErr("");
    try {
      await api(`/api/admin/boards/${b.slug}/noticers`, { method: "PUT", json: { user_ids: ids } });
      setBoards((prev) => prev.map((x) => (x.slug === b.slug ? { ...x, noticerIds: ids } : x)));
      flash(`'${b.name}' 공지 권한을 저장했습니다.`);
    } catch (e) { setErr((e as Error).message); }
  };

  const setMembers = async (b: B, ids: number[]) => {
    setErr("");
    try {
      await api(`/api/admin/boards/${b.slug}/members`, { method: "PUT", json: { user_ids: ids } });
      await refresh();  // 멤버 제외 시 공지권한도 정리되므로 새로고침
      flash(`'${b.name}' 멤버를 저장했습니다.`);
    } catch (e) { setErr((e as Error).message); }
  };

  const createDept = async () => {
    const name = newName.trim();
    if (!name) return;
    setErr("");
    try {
      await api("/api/admin/dept-boards", { json: { name } });
      setNewName("");
      await refresh();
      flash(`'${name}' 부서 게시판을 만들었습니다.`);
    } catch (e) { setErr((e as Error).message); }
  };

  const deleteDept = async (b: B) => {
    if (!confirm(`'${b.name}' 부서 게시판을 삭제할까요?\n글·댓글·멤버 정보가 모두 삭제됩니다.`)) return;
    setErr("");
    try {
      await api(`/api/admin/dept-boards/${b.slug}`, { method: "DELETE" });
      await refresh();
      flash(`'${b.name}' 부서 게시판을 삭제했습니다.`);
    } catch (e) { setErr((e as Error).message); }
  };

  const noticeBoardsList = boards.filter((b) => !b.dept);
  const deptBoardsList = boards.filter((b) => b.dept);

  return (
    <div className="min-w-0 w-full flex flex-col gap-5">
      <h1 className="text-xl font-extrabold">🔑 권한 관리</h1>
      {err && <p className="text-sm text-pink font-semibold">{err}</p>}
      {msg && <p className="text-sm text-primary font-semibold">{msg}</p>}

      {/* 관리자 관리 */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-sm">운영진(관리자)</h2>
            <p className="text-xs text-muted mt-1">관리자는 여러 명 지정할 수 있고 모든 게시판에 공지를 올릴 수 있습니다. 최소 1명은 유지됩니다.</p>
          </div>
          <AddSearch candidates={users.filter((u) => !u.isAdmin)} onAdd={(u) => setRole(u, true)} placeholder="관리자 추가" />
        </div>
        <div className="flex flex-wrap items-start gap-2 min-h-[60px]">
          {admins.length === 0 && <p className="text-xs text-muted py-3">지정된 관리자가 없습니다.</p>}
          {admins.map((u) => (
            <Avatar key={u.id} u={u} onRemove={admins.length > 1 ? () => setRole(u, false) : undefined} />
          ))}
        </div>
      </section>

      {/* 게시판 권한: 공지권한 / 부서 게시판 토글 */}
      <section className="bg-card rounded-2xl border border-border p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-sm">{tab === "notice" ? "게시판별 공지 작성 권한" : "부서 게시판 관리"}</h2>
            <p className="text-xs text-muted mt-1">
              {tab === "notice"
                ? "게시판마다 공지(상단 고정)를 올릴 수 있는 사용자를 지정합니다. 🔒 관리자는 항상 가능합니다."
                : "부서 게시판은 지정된 멤버만 접근할 수 있습니다. 신설·삭제 및 멤버/공지 권한을 관리합니다."}
            </p>
          </div>
          <div className="flex rounded-lg bg-background p-0.5 text-xs font-semibold shrink-0">
            <button onClick={() => setTab("notice")} className={`px-3 py-1.5 rounded-md ${tab === "notice" ? "bg-card text-primary shadow-sm" : "text-muted"}`}>공지권한</button>
            <button onClick={() => setTab("dept")} className={`px-3 py-1.5 rounded-md ${tab === "dept" ? "bg-card text-primary shadow-sm" : "text-muted"}`}>🏢 부서 게시판</button>
          </div>
        </div>

        {tab === "notice" ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {noticeBoardsList.map((b) => {
              const explicit = b.noticerIds.map(byId).filter((u): u is U => !!u && !u.isAdmin);
              return (
                <div key={b.slug} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{b.name}</span>
                      {b.anon && <span className="text-[10px] font-bold text-pink bg-pink-soft px-1.5 py-0.5 rounded-full">익명</span>}
                    </div>
                    <AddSearch candidates={users.filter((u) => !u.isAdmin && !b.noticerIds.includes(u.id))} onAdd={(u) => setNoticers(b, [...b.noticerIds, u.id])} placeholder="공지 권한 추가" />
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {admins.map((u) => <Avatar key={`a-${u.id}`} u={u} locked />)}
                    {explicit.map((u) => <Avatar key={u.id} u={u} onRemove={() => setNoticers(b, b.noticerIds.filter((id) => id !== u.id))} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {/* 새 부서 게시판 만들기 */}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 p-4">
              <span className="text-sm font-bold text-primary shrink-0">➕ 새 부서 게시판</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createDept(); }}
                placeholder="예) 개발팀, 디자인팀"
                className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted"
              />
              <button onClick={createDept} disabled={!newName.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 shrink-0">만들기</button>
            </div>

            {deptBoardsList.length === 0 && <p className="text-sm text-muted text-center py-6">아직 부서 게시판이 없습니다.</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              {deptBoardsList.map((b) => {
                const members = b.memberIds.map(byId).filter((u): u is U => !!u);
                const noticers = b.noticerIds.map(byId).filter((u): u is U => !!u && !u.isAdmin);
                return (
                  <div key={b.slug} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold flex items-center gap-1.5">🏢 {b.name}</span>
                      <button onClick={() => deleteDept(b)} title="부서 게시판 삭제" className="text-xs font-semibold text-pink hover:underline shrink-0">삭제</button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold text-muted">멤버 (접근 가능)</span>
                        <AddSearch candidates={users.filter((u) => !b.memberIds.includes(u.id))} onAdd={(u) => setMembers(b, [...b.memberIds, u.id])} placeholder="멤버 추가" />
                      </div>
                      <div className="flex flex-wrap items-start gap-2 min-h-[58px]">
                        {members.length === 0 && <p className="text-[11px] text-muted py-3">멤버가 없습니다.</p>}
                        {members.map((u) => <Avatar key={u.id} u={u} onRemove={() => setMembers(b, b.memberIds.filter((id) => id !== u.id))} />)}
                      </div>
                    </div>

                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold text-muted">공지 작성 권한</span>
                        <AddSearch candidates={members.filter((u) => !u.isAdmin && !b.noticerIds.includes(u.id))} onAdd={(u) => setNoticers(b, [...b.noticerIds, u.id])} placeholder="공지 권한 추가" />
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {admins.map((u) => <Avatar key={`a-${u.id}`} u={u} locked />)}
                        {noticers.map((u) => <Avatar key={u.id} u={u} onRemove={() => setNoticers(b, b.noticerIds.filter((id) => id !== u.id))} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
