"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ctck-theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "라이트 모드" : "다크 모드"}
      aria-label="테마 전환"
      className="shrink-0 w-9 h-9 grid place-items-center rounded-full hover:bg-background text-lg"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
