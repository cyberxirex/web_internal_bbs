from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.abuse import check_signup_ip, rate_limit
from app.db import get_session
from app.models import AuthToken, User, now
from app.security import client_ip, get_current_user, hash_pw, new_token, verify_pw

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupIn(BaseModel):
    username: str
    nickname: str
    password: str


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
        "lastLogin": u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else None,
    }


@router.post("/signup")
def signup(body: SignupIn, request: Request, session: Session = Depends(get_session)):
    if len(body.username) < 3 or len(body.password) < 4:
        raise HTTPException(400, "아이디는 3자 이상, 비밀번호는 4자 이상이어야 합니다.")
    if session.exec(select(User).where(User.username == body.username)).first():
        raise HTTPException(409, "이미 사용 중인 아이디입니다.")
    ip = client_ip(request)
    flagged = check_signup_ip(session, ip)  # 다중가입 의심 시 플래그(차단 X, 운영 검토용)
    user = User(
        username=body.username,
        nickname=body.nickname or body.username,
        password_hash=hash_pw(body.password),
        reg_ip=ip,
        flagged=flagged,
        last_login=now(),
        prev_login=now(),  # 신규 가입자는 이전 방문 없음 → 처음엔 NEW 없음
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = AuthToken(token=new_token(), user_id=user.id)
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
    token = AuthToken(token=new_token(), user_id=user.id)
    session.add(token)
    session.commit()
    return {"token": token.token, "user": user_public(user)}


@router.post("/logout")
def logout(authorization: str | None = None, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # 현재 토큰 삭제
    for t in session.exec(select(AuthToken).where(AuthToken.user_id == user.id)).all():
        session.delete(t)
    session.commit()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_public(user)
