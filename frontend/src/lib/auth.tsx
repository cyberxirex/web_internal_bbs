"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";

export type User = {
  id: number;
  username: string;
  nickname: string;
  isAdmin: boolean;
  level: number;
  levelName: string;
  points: number;
  joinedAt: string;
  lastLogin: string | null;
  groups?: string[];
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, nickname: string, password: string, groups?: string[]) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setUser(await api<User>("/api/auth/me"));
        } catch {
          clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  // 토큰 만료(api()의 401)와 다른 탭의 로그인/로그아웃을 감지해 user 상태를 동기화
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "ctck-token") return;
      if (!e.newValue) setUser(null); // 다른 탭에서 로그아웃
      else api<User>("/api/auth/me").then(setUser).catch(() => setUser(null)); // 다른 탭에서 로그인
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/api/auth/login", { json: { username, password } });
    setToken(r.token);
    setUser(r.user);
  };
  const signup = async (username: string, nickname: string, password: string, groups: string[] = []) => {
    const r = await api<{ token: string; user: User }>("/api/auth/signup", { json: { username, nickname, password, groups } });
    setToken(r.token);
    setUser(r.user);
  };
  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    clearToken();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}
