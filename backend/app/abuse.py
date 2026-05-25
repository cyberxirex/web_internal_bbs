"""어뷰징 방지: 레이트리밋 · 다중가입 탐지 · 비속어 필터.

서버가 사내망 내부에 있어 각 PC의 사설 IP를 직접 수신한다는 전제(= NAT 단일 IP 문제 없음).
레이트리밋은 동접 20 규모라 인메모리로 충분(단일 프로세스). 다중 프로세스 시 Redis로 대체.
"""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException
from sqlmodel import Session, func, select

from app.models import User

# ── 레이트리밋 (인메모리) ─────────────────────────────────
_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(key: str, limit: int, window_sec: float) -> None:
    """key 기준 window_sec 동안 limit회 초과 시 429."""
    now = time.time()
    bucket = [t for t in _hits[key] if now - t < window_sec]
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="너무 자주 시도하고 있어요. 잠시 후 다시 시도해 주세요.")
    bucket.append(now)
    _hits[key] = bucket


def min_interval(key: str, seconds: float) -> None:
    """연속 작성 최소 간격(도배 방지)."""
    now = time.time()
    last = _hits.get(f"interval:{key}", [0])[-1]
    if now - last < seconds:
        raise HTTPException(status_code=429, detail=f"도배 방지: {int(seconds)}초 후 다시 작성할 수 있어요.")
    _hits[f"interval:{key}"] = [now]


# ── 다중가입 / 부정가입 탐지 ──────────────────────────────
SIGNUP_PER_IP_PER_DAY = 3
MULTI_ACCOUNT_FLAG = 2  # 동일 IP 계정 수가 이 값 이상이면 플래그


def check_signup_ip(session: Session, ip: str) -> bool:
    """가입 시 동일 IP 계정 수 확인 → (플래그 여부) 반환. 과도하면 차단."""
    rate_limit(f"signup:{ip}", SIGNUP_PER_IP_PER_DAY, 24 * 3600)
    count = session.exec(select(func.count()).select_from(User).where(User.reg_ip == ip)).one()
    return count + 1 >= MULTI_ACCOUNT_FLAG


# ── 비속어 필터 (교체 가능한 인터페이스 — 추후 LLM 연동) ──
BANNED_WORDS = ["시발", "씨발", "병신", "ㅂㅅ", "ㅅㅂ", "개새", "좆", "지랄", "fuck", "shit"]


def filter_profanity(text: str) -> tuple[str, bool]:
    """(마스킹된 텍스트, 검출여부). 검출 시 해당 부분을 *** 로 치환."""
    masked = text
    hit = False
    low = text.lower()
    for w in BANNED_WORDS:
        idx = low.find(w.lower())
        while idx != -1:
            hit = True
            masked = masked[:idx] + ("*" * len(w)) + masked[idx + len(w):]
            low = masked.lower()
            idx = low.find(w.lower(), idx + len(w))
    return masked, hit


# 추후: def filter_with_llm(text) -> ... 로 교체/병행
PROFANITY_FILTER = filter_profanity
