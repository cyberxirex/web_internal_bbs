"""비밀번호 해시 · 토큰 · 인증 의존성."""
from __future__ import annotations

import ipaddress
import os
import secrets
from datetime import timedelta

import bcrypt
from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from app.db import get_session
from app.models import AuthToken, Board, BoardMember, BoardNoticer, User, now

# 토큰 유효기간(일). 환경변수로 조정 가능.
TOKEN_TTL_DAYS = int(os.getenv("TOKEN_TTL_DAYS", "7"))


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_expiry():
    return now() + timedelta(days=TOKEN_TTL_DAYS)


def _resolve_token(session: Session, token: str) -> AuthToken | None:
    """토큰 조회 + 만료 검사. 만료된 토큰은 삭제하고 None 반환."""
    row = session.get(AuthToken, token)
    if not row:
        return None
    if row.expires_at is not None:
        # SQLite는 naive로 저장됨 → aware 비교 위해 UTC로 보정
        exp = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=now().tzinfo)
        if exp < now():
            session.delete(row)
            session.commit()
            return None
    return row


# 신뢰할 수 있는 역프록시 뒤에 있을 때만 X-Forwarded-For를 신뢰(TRUST_PROXY=1).
# 기본값은 미신뢰: 클라이언트가 헤더를 위조해 레이트리밋/다중가입 탐지를 우회하는 것을 막는다.
TRUST_PROXY = os.getenv("TRUST_PROXY", "0").lower() in ("1", "true", "yes")


def _fallback_ip(request: Request) -> str:
    return request.client.host if request.client else "0.0.0.0"


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        # 신뢰 프록시가 추가한 가장 오른쪽 값이 실제 직전 홉. 유효 IP일 때만 사용(위조/쓰레기값 방어).
        xff = request.headers.get("x-forwarded-for")
        if xff:
            candidate = xff.split(",")[-1].strip()
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                pass
    return _fallback_ip(request)


def target_matches(user: User | None, target: str | None) -> bool:
    """이벤트/알림 대상(target) 매칭 — 단일 출처.
    그룹 또는 username(유니크)만 매칭. nickname은 중복 가능하므로 사칭 우회를 막기 위해 매칭하지 않는다."""
    t = (target or "").strip()
    if t in ("", "전체"):
        return True
    if user is None:
        return False
    tokens = {x.strip() for x in t.split(",") if x.strip()}
    groups = {g.strip() for g in (user.groups or "").split(",") if g.strip()}
    return bool(tokens & groups) or user.username in tokens


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = authorization.split(" ", 1)[1].strip()
    row = _resolve_token(session, token)
    if not row:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해 주세요.")
    user = session.get(User, row.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    row = _resolve_token(session, token)
    if not row:
        return None
    return session.get(User, row.user_id)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다.")
    return user


def can_post_notice(session: Session, user: User, board_id: int) -> bool:
    """관리자이거나 해당 게시판 공지 권한자면 공지(고정) 작성 가능."""
    if user.is_admin:
        return True
    return session.exec(
        select(BoardNoticer).where(BoardNoticer.board_id == board_id, BoardNoticer.user_id == user.id)
    ).first() is not None


def is_board_member(session: Session, user_id: int, board_id: int) -> bool:
    return session.exec(
        select(BoardMember).where(BoardMember.board_id == board_id, BoardMember.user_id == user_id)
    ).first() is not None


def can_access_board(session: Session, user: User | None, board: Board) -> bool:
    """부서 게시판은 멤버(또는 관리자)만 접근 가능. 일반 게시판은 누구나."""
    if not board.is_dept:
        return True
    if user is None:
        return False
    if user.is_admin:
        return True
    return is_board_member(session, user.id, board.id)


def require_board_access(session: Session, user: User | None, board: Board) -> None:
    if not can_access_board(session, user, board):
        raise HTTPException(status_code=403, detail="이 부서 게시판에 접근할 권한이 없습니다.")
