from __future__ import annotations

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.abuse import check_signup_ip, rate_limit
from app.constants import GROUPS
from app.db import get_session
from app.models import AuthToken, User, now
from app.security import client_ip, get_current_user, hash_pw, new_token, token_expiry, verify_pw

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupIn(BaseModel):
    username: str
    nickname: str
    password: str
    groups: list[str] = []  # 소속 부서(이벤트 타게팅용). 허용된 그룹만 저장.


class LoginIn(BaseModel):
    username: str
    password: str


def user_public(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "nickname": u.nickname,
        "isAdmin": u.is_admin,
        "level": u.level,
        "levelName": u.level_name,
        "points": u.points,
        "joinedAt": u.created_at.date().isoformat(),
        "lastLogin": _kst(u.last_login).strftime("%Y-%m-%d %H:%M") if u.last_login else None,
        "groups": [g for g in (u.groups or "").split(",") if g],
    }


def _kst(dt):
    """저장된 naive UTC → KST(+9) 표시용 변환."""
    base = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return base.astimezone(timezone(timedelta(hours=9)))


@router.post("/signup")
def signup(body: SignupIn, request: Request, session: Session = Depends(get_session)):
    if len(body.username) < 3 or len(body.password) < 4:
        raise HTTPException(400, "아이디는 3자 이상, 비밀번호는 4자 이상이어야 합니다.")
    if session.exec(select(User).where(User.username == body.username)).first():
        raise HTTPException(409, "이미 사용 중인 아이디입니다.")
    ip = client_ip(request)
    flagged = check_signup_ip(session, ip)  # 다중가입 의심 시 플래그(차단 X, 운영 검토용)
    groups = ",".join(g for g in body.groups if g in GROUPS)  # 허용 목록만 저장(임의 값 차단)
    user = User(
        username=body.username,
        nickname=body.nickname or body.username,
        password_hash=hash_pw(body.password),
        groups=groups,
        reg_ip=ip,
        flagged=flagged,
        last_login=now(),
        prev_login=now(),  # 신규 가입자는 이전 방문 없음 → 처음엔 NEW 없음
    )
    session.add(user)
    session.flush()  # user.id 확보 (커밋 분리 없이 단일 트랜잭션 유지)
    token = AuthToken(token=new_token(), user_id=user.id, expires_at=token_expiry())
    session.add(token)
    session.commit()
    return {"token": token.token, "user": user_public(user), "flagged": flagged}


@router.post("/login")
def login(body: LoginIn, request: Request, session: Session = Depends(get_session)):
    rate_limit(f"login:{client_ip(request)}", limit=10, window_sec=300)
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_pw(body.password, user.password_hash):
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")
    user.prev_login = user.last_login or user.created_at  # 직전 방문 시각 보존
    user.last_login = now()
    session.add(user)
    token = AuthToken(token=new_token(), user_id=user.id, expires_at=token_expiry())
    session.add(token)
    session.commit()
    return {"token": token.token, "user": user_public(user)}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None), session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # 현재 세션 토큰만 삭제(다른 기기 세션은 유지)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        row = session.get(AuthToken, token)
        if row and row.user_id == user.id:
            session.delete(row)
            session.commit()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_public(user)
