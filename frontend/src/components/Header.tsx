import Link from "next/link";
import Logo from "./Logo";
import HeaderUser from "./HeaderUser";
import SearchBox from "./SearchBox";
import ThemeToggle from "./ThemeToggle";

const topMenu = [
  { label: "모아보기", href: "/" },
  { label: "자유게시판", href: "/b/free" },
  { label: "질문답변", href: "/b/qna" },
  { label: "사내 소식", href: "/b/news" },
  { label: "익명", href: "/b/anon" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 bg-card/90 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-[1280px] px-4 h-14 flex items-center gap-3 lg:gap-5">
        {/* 로고 — lg에선 좌측 패널 폭(260px)을 차지해 메뉴가 가운데 컬럼 시작점에서 시작 */}
        <Link href="/" className="flex items-center gap-2 shrink-0 lg:w-[260px] whitespace-nowrap">
          <Logo size={32} />
          <span className="font-extrabold text-lg tracking-tight">CTCK <span className="text-primary">BBS</span></span>
        </Link>

        {/* 글로벌 메뉴 (가운데 컬럼 시작점에서 시작, 줄바꿈 금지) */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-foreground/70 shrink-0">
          {topMenu.map((m) => (
            <Link key={m.label} href={m.href} className="px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-primary-soft hover:text-primary transition-colors">
              {m.label}
            </Link>
          ))}
        </nav>

        {/* 우측 정렬용 여백 */}
        <div className="flex-1" />

        {/* 검색 (항상 표시, 오른쪽 정렬 · 공간에 맞춰 동적 축소: 최대 320px) */}
        <SearchBox />

        {/* 다크모드 토글 */}
        <ThemeToggle />

        {/* 로그인 시 아바타 */}
        <HeaderUser />
      </div>
    </header>
  );
}
