import Link from "next/link";
import { relTime } from "@/lib/api";

export type PostRowData = {
  id: number;
  boardSlug: string;
  board: string; // short
  color: string;
  title: string;
  author: string;
  votes: number;
  comments: number;
  views?: number;
  createdAt?: string;
};

export default function PostRow({ post }: { post: PostRowData }) {
  const isPink = post.color === "pink";
  return (
    <Link href={`/post/${post.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background transition-colors">
      <span className={`shrink-0 w-9 text-center text-xs font-bold py-1 rounded-md ${post.votes >= 50 ? "bg-pink-soft text-pink" : "bg-background text-muted"}`}>
        {post.votes}
      </span>
      <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${isPink ? "bg-pink-soft text-pink" : "bg-primary-soft text-primary"}`}>
        {post.board}
      </span>
      <span className="flex-1 truncate text-sm text-foreground/90">
        {post.title}
        {post.comments > 0 && <span className="ml-1.5 text-xs font-bold text-pink">[{post.comments}]</span>}
      </span>
      <span className="hidden sm:block shrink-0 text-xs text-muted w-16 text-right truncate">{post.author}</span>
      <span className="shrink-0 text-xs text-muted w-10 text-right">{relTime(post.createdAt)}</span>
    </Link>
  );
}
