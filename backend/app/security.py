"""비밀번호 해시 · 토큰 · 인증 의존성."""
from __future__ import annotations

import secrets

import bcrypt
from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from app.db import get_session
from app.models import AuthToken, Board, BoardMember, BoardNoticer, User


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def client_ip(request: Request) -> str:
    # 사내망 내부 배포 가정: 프록시 있으면 X-Forwarded-For 첫 IP 사용
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = authorization.split(" ", 1)[1].strip()
    row = session.get(AuthToken, token)
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
    row = session.get(AuthToken, token)
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
