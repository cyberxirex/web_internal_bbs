const URL_RE = /(https?:\/\/[^\s<]+)/g;

export function extractUrls(text: string): string[] {
  const found = (text.match(URL_RE) || []).map((u) => u.replace(/[).,!?]+$/, ""));
  return Array.from(new Set(found));
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
