"""시간 변환 단일 출처. SQLite는 naive UTC로 저장 → 직렬화/표시 시 일관 변환."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def aware_utc(dt: datetime | None) -> datetime | None:
    """naive(=UTC 저장값)면 tzinfo를 UTC로 부여."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso_utc(dt: datetime | None) -> str | None:
    """tz suffix 포함 ISO 직렬화(프론트 new Date()가 로컬로 오해석하는 것 방지)."""
    aware = aware_utc(dt)
    return aware.isoformat() if aware else None


def to_kst(dt: datetime | None) -> datetime | None:
    """표시용 KST(+9) 변환."""
    aware = aware_utc(dt)
    return aware.astimezone(KST) if aware else None
