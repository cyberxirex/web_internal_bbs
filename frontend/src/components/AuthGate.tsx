"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

// 로그인 시 children 표시, 비로그인 시 안내 (그리드 가운데 컬럼 자리 채움)
export default function AuthGate({
  children,
  message = "로그인 후 이용할 수 있습니다.",
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const { user } = useAuth();
  if (user) return <>{children}</>;
  return (
    <div className="min-w-0 flex-1 grid place-items-center py-20 text-center">
      <div>
        <p className="text-foreground/70 mb-3">{message}</p>
        <Link href="/login" className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm">
          로그인하러 가기
        </Link>
      </div>
    </div>
  );
}
