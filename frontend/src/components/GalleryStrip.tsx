import Link from "next/link";
import Image from "next/image";
import { imgUrl, relTime } from "@/lib/api";

export type GalleryItem = { id: number; title: string; author: string; image: string | null; imageCount: number; votes: number; comments: number; createdAt: string };

export default function GalleryStrip({ items, blurred = false }: { items: GalleryItem[]; blurred?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm flex items-center gap-1.5">📷 갤러리</h2>
        <Link href="/b/gallery" className="text-xs font-semibold text-muted hover:text-primary">더보기 ›</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((p) => (
          <Link key={p.id} href={blurred ? "/login" : `/post/${p.id}`} className="group relative block aspect-[4/3] rounded-xl overflow-hidden bg-background">
            {p.image && (
              <Image src={imgUrl(p.image)} alt={blurred ? "" : p.title} fill sizes="(max-width: 640px) 50vw, 220px" className={`object-cover transition-transform ${blurred ? "blur-lg scale-110" : "group-hover:scale-105"}`} unoptimized />
            )}
            {p.imageCount > 1 && <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px] font-semibold">📷 {p.imageCount}</span>}
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/25 to-transparent p-2">
              <p className="text-white text-xs font-bold truncate">{p.title}</p>
              {blurred ? (
                <p className="text-white/70 text-[10px] truncate">{p.author} · 🔒 로그인 후 보기</p>
              ) : (
                <p className="text-white/85 text-[10px] truncate">{p.author} · 💖 {p.votes} · 💬 {p.comments} · {relTime(p.createdAt)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
