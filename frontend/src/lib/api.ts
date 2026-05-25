// 백엔드 API 클라이언트
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "ctck-token";

export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// 업로드 이미지(/uploads/..)는 백엔드 호스트로, 그 외(/gallery/.. 등)는 프론트 public 그대로
export const imgUrl = (p?: string | null) => (p && p.startsWith("/uploads/") ? BASE + p : p || "");

type Opts = { method?: string; json?: unknown; body?: BodyInit };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body = opts.body;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || (opts.json !== undefined ? "POST" : "GET"),
    headers,
    body,
  });
  if (!res.ok) {
    // 토큰 만료/무효 → 저장된 토큰을 비우고 전역에 알림(헤더 등 UI가 로그인 상태로 남는 것 방지)
    if (res.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    let detail = `요청 실패 (${res.status})`;
    try {
      const d = await res.json();
      if (d?.detail) detail = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: fd });
  return url;
}

// "2026-05-25T09:12:00+00:00" → "10분"/"3시간"/"5월 25일" 상대표기
export function relTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간`;
  const dt = new Date(iso);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
