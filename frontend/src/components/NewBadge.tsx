/* 새 글 표시용 애니메이션 SVG 딱지 */
export default function NewBadge({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 14" role="img" aria-label="새 글" className={`inline-block shrink-0 ${className}`} style={{ width: 30, height: 14 }}>
      <defs>
        <linearGradient id="newg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8fb3" />
          <stop offset="100%" stopColor="#ff4d7e" />
        </linearGradient>
        <clipPath id="newclip"><rect x="0" y="0" width="30" height="14" rx="7" /></clipPath>
      </defs>
      <g clipPath="url(#newclip)">
        <rect x="0" y="0" width="30" height="14" rx="7" fill="url(#newg)">
          <animate attributeName="opacity" values="1;0.78;1" dur="1.5s" repeatCount="indefinite" />
        </rect>
        {/* 반짝이며 지나가는 빛 */}
        <rect x="-10" y="-3" width="5" height="20" fill="#fff" opacity="0.55" transform="skewX(-22)">
          <animate attributeName="x" values="-10;36" dur="1.8s" repeatCount="indefinite" />
        </rect>
      </g>
      <text x="15" y="10.4" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing="0.4" fill="#fff" fontFamily="system-ui, sans-serif">NEW</text>
    </svg>
  );
}
