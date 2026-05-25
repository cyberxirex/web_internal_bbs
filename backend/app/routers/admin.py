from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import (Banner, Board, BoardMember, BoardNoticer, Comment,
                        DateAvailability, Event, EventEntry, EventEntryLike,
                        EventOption, EventVote, Post, User, now)
from app.security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── 관리자 / 권한 관리 ────────────────────────────────────
@router.get("/permissions")
def get_permissions(session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    """관리자·게시판별 공지 권한 설정 화면용 통합 데이터."""
    users = session.exec(select(User).order_by(User.id)).all()
    boards = session.exec(select(Board).order_by(Board.sort)).all()
    notice_by: dict[int, list[int]] = {}
    for n in session.exec(select(BoardNoticer)).all():
        notice_by.setdefault(n.board_id, []).append(n.user_id)
    member_by: dict[int, list[int]] = {}
    for m in session.exec(select(BoardMember)).all():
        member_by.setdefault(m.board_id, []).append(m.user_id)
    return {
        "users": [{"id": u.id, "username": u.username, "nickname": u.nickname, "isAdmin": u.is_admin} for u in users],
        "boards": [{"slug": b.slug, "name": b.name, "anon": b.is_anon, "dept": b.is_dept,
                    "noticerIds": notice_by.get(b.id, []), "memberIds": member_by.get(b.id, [])} for b in boards],
    }


class RoleIn(BaseModel):
    is_admin: bool


@router.post("/users/{user_id}/role")
def set_role(user_id: int, body: RoleIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    u = session.get(User, user_id)
    if not u:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if not body.is_admin and u.is_admin:
        # 마지막 관리자 강등 방지
        admin_count = len(session.exec(select(User).where(User.is_admin == True)).all())  # noqa: E712
        if admin_count <= 1:
            raise HTTPException(400, "최소 한 명의 관리자는 유지해야 합니다.")
    u.is_admin = body.is_admin
    session.add(u)
    session.commit()
    return {"ok": True, "isAdmin": u.is_admin}


class NoticersIn(BaseModel):
    user_ids: list[int] = []


@router.put("/boards/{slug}/noticers")
def set_noticers(slug: str, body: NoticersIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    b = session.exec(select(Board).where(Board.slug == slug)).first()
    if not b:
        raise HTTPException(404, "게시판을 찾을 수 없습니다.")
    for n in session.exec(select(BoardNoticer).where(BoardNoticer.board_id == b.id)).all():
        session.delete(n)
    valid_ids = {u.id for u in session.exec(select(User).where(User.id.in_(body.user_ids))).all()} if body.user_ids else set()
    for uid in valid_ids:
        session.add(BoardNoticer(board_id=b.id, user_id=uid))
    session.commit()
    return {"ok": True, "noticerIds": sorted(valid_ids)}


@router.put("/boards/{slug}/members")
def set_members(slug: str, body: NoticersIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    b = session.exec(select(Board).where(Board.slug == slug)).first()
    if not b:
        raise HTTPException(404, "게시판을 찾을 수 없습니다.")
    if not b.is_dept:
        raise HTTPException(400, "부서 게시판만 멤버를 지정할 수 있습니다.")
    for m in session.exec(select(BoardMember).where(BoardMember.board_id == b.id)).all():
        session.delete(m)
    valid_ids = {u.id for u in session.exec(select(User).where(User.id.in_(body.user_ids))).all()} if body.user_ids else set()
    for uid in valid_ids:
        session.add(BoardMember(board_id=b.id, user_id=uid))
    # 멤버에서 빠진 사용자는 공지 권한도 정리
    for n in session.exec(select(BoardNoticer).where(BoardNoticer.board_id == b.id)).all():
        if n.user_id not in valid_ids:
            session.delete(n)
    session.commit()
    return {"ok": True, "memberIds": sorted(valid_ids)}


# ── 부서 게시판 신설 / 삭제 (운영진) ──────────────────────
class DeptBoardIn(BaseModel):
    name: str
    member_ids: list[int] = []
    noticer_ids: list[int] = []


@router.post("/dept-boards")
def create_dept_board(body: DeptBoardIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "게시판 이름을 입력하세요.")
    # 고유 슬러그 생성: dept1, dept2 ...
    existing = {b.slug for b in session.exec(select(Board)).all()}
    n = 1
    while f"dept{n}" in existing:
        n += 1
    slug = f"dept{n}"
    max_sort = max([b.sort for b in session.exec(select(Board)).all()] + [0])
    b = Board(slug=slug, name=name, short=name[:8], tag="부", color="primary",
              is_anon=False, is_dept=True, description=f"{name} 부서 전용 게시판", sort=max_sort + 1)
    session.add(b)
    session.commit()
    session.refresh(b)
    members = {u.id for u in session.exec(select(User).where(User.id.in_(body.member_ids))).all()} if body.member_ids else set()
    for uid in members:
        session.add(BoardMember(board_id=b.id, user_id=uid))
    for uid in body.noticer_ids:
        if uid in members:  # 공지 권한자는 멤버 중에서만
            session.add(BoardNoticer(board_id=b.id, user_id=uid))
    session.commit()
    return {"ok": True, "slug": slug}


@router.delete("/dept-boards/{slug}")
def delete_dept_board(slug: str, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    b = session.exec(select(Board).where(Board.slug == slug)).first()
    if not b:
        raise HTTPException(404, "게시판을 찾을 수 없습니다.")
    if not b.is_dept:
        raise HTTPException(400, "부서 게시판만 삭제할 수 있습니다.")
    # 글/댓글/멤버/공지권한 정리
    posts = session.exec(select(Post).where(Post.board_id == b.id)).all()
    for p in posts:
        for c in session.exec(select(Comment).where(Comment.post_id == p.id)).all():
            session.delete(c)
        session.delete(p)
    for m in session.exec(select(BoardMember).where(BoardMember.board_id == b.id)).all():
        session.delete(m)
    for nt in session.exec(select(BoardNoticer).where(BoardNoticer.board_id == b.id)).all():
        session.delete(nt)
    session.delete(b)
    session.commit()
    return {"ok": True}


class EventIn(BaseModel):
    type: str  # poll | comment | date
    title: str
    description: str = ""
    body: str = ""
    deadline: str = ""
    target: str = "전체"
    options: list[str] = []  # poll
    candidate_dates: list[str] = []  # date (ISO)


@router.post("/events")
def create_event(body: EventIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    if body.type not in ("poll", "comment", "date"):
        raise HTTPException(400, "잘못된 유형입니다.")
    if not body.title.strip():
        raise HTTPException(400, "제목을 입력하세요.")
    e = Event(type=body.type, title=body.title.strip(), description=body.description, body=body.body,
              deadline=body.deadline, target=body.target or "전체", created_by=admin.id,
              candidate_dates=",".join(body.candidate_dates) if body.type == "date" else "")
    session.add(e)
    session.commit()
    session.refresh(e)
    if body.type == "poll":
        for label in [o.strip() for o in body.options if o.strip()]:
            session.add(EventOption(event_id=e.id, label=label))
        session.commit()
    return {"id": e.id}


class EventEditIn(BaseModel):
    title: str
    description: str = ""
    deadline: str = ""
    target: str = "전체"


@router.put("/events/{event_id}")
def update_event(event_id: int, body: EventEditIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    e = session.get(Event, event_id)
    if not e:
        raise HTTPException(404, "이벤트를 찾을 수 없습니다.")
    if not body.title.strip():
        raise HTTPException(400, "제목을 입력하세요.")
    e.title, e.description, e.deadline, e.target = body.title.strip(), body.description, body.deadline, body.target or "전체"
    session.add(e)
    session.commit()
    return {"ok": True}


@router.delete("/events/{event_id}")
def delete_event(event_id: int, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    e = session.get(Event, event_id)
    if e:
        # 연관 자식 레코드 정리(FK 미적용 → 수동 cascade). 고아 레코드/집계 오염 방지.
        for opt in session.exec(select(EventOption).where(EventOption.event_id == event_id)).all():
            session.delete(opt)
        for ev in session.exec(select(EventVote).where(EventVote.event_id == event_id)).all():
            session.delete(ev)
        for entry in session.exec(select(EventEntry).where(EventEntry.event_id == event_id)).all():
            for like in session.exec(select(EventEntryLike).where(EventEntryLike.entry_id == entry.id)).all():
                session.delete(like)
            session.delete(entry)
        for da in session.exec(select(DateAvailability).where(DateAvailability.event_id == event_id)).all():
            session.delete(da)
        session.delete(e)
        session.commit()
    return {"ok": True}


class PinIn(BaseModel):
    pinned: bool


@router.post("/posts/{post_id}/pin")
def pin_post(post_id: int, body: PinIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    p = session.get(Post, post_id)
    if not p:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    p.pinned = body.pinned
    session.add(p)
    session.commit()
    return {"ok": True, "pinned": p.pinned}


class BannerIn(BaseModel):
    text: str = ""
    sub: str = ""
    image: str | None = None
    active: bool = True


@router.put("/banner")
def set_banner(body: BannerIn, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    b = session.exec(select(Banner)).first()
    if not b:
        b = Banner()
    b.text, b.sub, b.image, b.active, b.updated_at = body.text, body.sub, body.image, body.active, now()
    session.add(b)
    session.commit()
    return {"ok": True}
