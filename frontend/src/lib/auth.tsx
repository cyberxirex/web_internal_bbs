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
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, nickname: string, password: string) => Promise<void>;
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

  const login = async (username: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/api/auth/login", { json: { username, password } });
    setToken(r.token);
    setUser(r.user);
  };
  const signup = async (username: string, nickname: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/api/auth/signup", { json: { username, nickname, password } });
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
