"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");

  // 검색창은 항상 표시. 로그인 여부는 결과 페이지(/search)에서 안내.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
      className="flex items-center gap-2 bg-background rounded-full px-3 py-1.5 border border-border min-w-0 w-80"
    >
      <button type="submit" className="text-muted text-sm shrink-0" aria-label="검색">🔍</button>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색"
        className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-muted"
      />
    </form>
  );
}
