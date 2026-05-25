// 움직이는 SVG 로고 — 채팅 버블 + 통통 튀는 타이핑 점 (BBS/소통 분위기)
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo-float inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="ctck-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--pink)" />
          </linearGradient>
        </defs>
        {/* 라운드 사각 배경 */}
        <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ctck-g)" />
        {/* 말풍선 */}
        <path
          d="M11 13.5c0-1.4 1.1-2.5 2.5-2.5h13c1.4 0 2.5 1.1 2.5 2.5v8c0 1.4-1.1 2.5-2.5 2.5H19l-4.2 3.8c-.6.5-1.5.1-1.5-.7V24h-.3c-1 0-1.7-.8-1.7-1.7z"
          fill="#fff"
        />
        {/* 타이핑 점 3개 (순차 바운스) */}
        <circle className="logo-dot" cx="16.5" cy="18" r="1.7" fill="var(--primary)" style={{ animationDelay: "0ms" }} />
        <circle className="logo-dot" cx="20" cy="18" r="1.7" fill="var(--primary)" style={{ animationDelay: "150ms" }} />
        <circle className="logo-dot" cx="23.5" cy="18" r="1.7" fill="var(--primary)" style={{ animationDelay: "300ms" }} />
      </svg>
    </span>
  );
}
