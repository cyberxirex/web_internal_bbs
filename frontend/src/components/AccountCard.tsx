"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

// 왼쪽 글쓰기 카드 + 로그인/가입(로그아웃 시) 또는 프로필(로그인 시)
export default function AccountCard() {
  const { user, logout } = useAuth();
  const showOnExpand = "max-lg:hidden max-lg:group-hover:flex lg:flex"; // 전체 표시
  const railOnly = "lg:hidden group-hover:hidden"; // 접힌 레일에서만

  return (
    // 모든 페이지에서 동일한 높이(lg:h-24=96px) → 오른쪽 배너/게시판 제목 카드와 정렬
    <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2 justify-center overflow-hidden max-lg:group-hover:shadow-2xl lg:h-24">
      {user ? (
        <>
          {/* 프로필 — 전체 한 줄 (넓은 화면 & 호버) */}
          <div className={`items-center gap-1 ${showOnExpand}`}>
            <Link href="/me" className="flex items-center gap-2 flex-1 min-w-0 p-1 rounded-lg hover:bg-background">
              <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-pink text-white grid place-items-center text-xs font-bold">
                {user.nickname.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block text-sm font-bold truncate">{user.nickname}</span>
                <span className="block text-[11px] text-muted truncate">Lv.{user.level} · {user.points.toLocaleString()}P</span>
              </span>
            </Link>
            <button onClick={logout} title="로그아웃" aria-label="로그아웃" className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-pink hover:bg-background">
              ⏻
            </button>
          </div>
          {/* 프로필 — 아이콘 (접힌 레일) */}
          <Link
            href="/me"
            title={user.nickname}
            className={`grid ${railOnly} place-items-center w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-primary to-pink text-white text-xs font-bold`}
          >
            {user.nickname.slice(0, 1)}
          </Link>
        </>
      ) : (
        <>
          {/* 로그인/가입 — 전체 (넓은 화면 & 호버) */}
          <div className={`gap-2 ${showOnExpand}`}>
            <Link href="/login" className="flex-1 text-center py-2 rounded-xl bg-background text-foreground/70 font-semibold text-sm hover:text-primary whitespace-nowrap">
              로그인
            </Link>
            <Link href="/signup" className="flex-1 text-center py-2 rounded-xl bg-primary-soft text-primary font-semibold text-sm hover:opacity-90 whitespace-nowrap">
              가입
            </Link>
          </div>
          {/* 로그인/가입 — 아이콘 (접힌 레일) */}
          <div className={`flex-col gap-1.5 ${railOnly} flex`}>
            <Link href="/login" title="로그인" className="grid place-items-center py-1.5 rounded-lg bg-background text-foreground/70 hover:text-primary">🔑</Link>
            <Link href="/signup" title="가입" className="grid place-items-center py-1.5 rounded-lg bg-primary-soft text-primary hover:opacity-90">➕</Link>
          </div>
        </>
      )}
    </div>
  );
}
