"use client";
import { useEffect, useState } from "react";
import LeftPanel from "@/components/LeftPanel";
import Feed from "@/components/Feed";
import WeeklyBest from "@/components/WeeklyBest";
import GalleryStrip, { type GalleryItem } from "@/components/GalleryStrip";
import type { PostRowData } from "@/components/PostRow";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Feed = { posts: PostRowData[]; weeklyBest: PostRowData[] };

export default function Home() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<Feed>({ posts: [], weeklyBest: [] });
  const [banner, setBanner] = useState<{ text: string; sub: string } | null>(null);
  const [boards, setBoards] = useState<{ slug: string; name: string }[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    api<Feed>("/api/feed").then(setFeed).catch(() => {});
    api<{ text: string; sub: string } | null>("/api/banner").then(setBanner).catch(() => {});
    api<{ slug: string; name: string }[]>("/api/boards").then(setBoards).catch(() => {});
    api<{ posts: GalleryItem[] }>("/api/gallery")
      .then((d) => setGallery((d.posts || []).filter((p) => p.image).slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel />
        <div className="min-w-0 flex flex-col gap-4">
          <Feed banner={banner} boards={boards} posts={feed.posts} />
          <WeeklyBest posts={feed.posts} />
          <GalleryStrip items={gallery} blurred={!user} />
        </div>
      </div>
    </main>
  );
}
