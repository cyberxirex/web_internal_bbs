"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Prev = { url: string; title: string; description: string; image: string | null; domain: string };

export default function LinkPreview({ url }: { url: string }) {
  const [p, setP] = useState<Prev | null>(null);
  useEffect(() => {
    api<Prev>(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(setP)
      .catch(() => setP({ url, title: url, description: "", image: null, domain: new URL(url).hostname }));
  }, [url]);

  if (!p) return <div className="mt-4 h-20 rounded-xl border border-border bg-background animate-pulse" />;

  return (
    <a href={p.url} target="_blank" rel="noreferrer" className="mt-4 flex items-stretch gap-3 rounded-xl border border-border overflow-hidden hover:border-primary transition-colors">
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" className="w-28 sm:w-40 object-cover bg-background shrink-0" />
      )}
      <div className="min-w-0 flex-1 p-3">
        <p className="text-sm font-bold truncate">{p.title}</p>
        {p.description && <p className="text-xs text-muted mt-1 line-clamp-2">{p.description}</p>}
        <p className="text-[11px] text-muted mt-1.5 truncate">🔗 {p.domain}</p>
      </div>
    </a>
  );
}
