import { useEffect } from "react";

/**
 * 탭이 다시 포커스/가시 상태가 될 때 fn을 호출해 데이터를 재조회한다.
 * SWR/React Query 없이 동시 사용자 간 stale 데이터 신선도를 보강하는 경량 수단.
 */
export function useFocusRefetch(fn: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") fn();
    };
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", handler);
    };
  }, [fn]);
}
