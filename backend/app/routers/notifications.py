from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import (Comment, DateAvailability, Event, EventEntry, EventVote,
                        Notice, Post, User, Vote, now)
from app.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

KIND = {"poll": "투표", "comment": "이벤트", "date": "날짜 투표"}
ICON = {"poll": "📊", "comment": "💬", "date": "📅"}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _targets_user(event: Event, user: User) -> bool:
    target = (event.target or "").strip()
    if target in ("전체", ""):
        return True
    tokens = {x.strip() for x in target.split(",") if x.strip()}
    groups = {g.strip() for g in (user.groups or "").split(",") if g.strip()}
    return bool(tokens & groups) or user.username in tokens or user.nickname in tokens


def _participated(session: Session, event: Event, user: User) -> bool:
    if event.type == "poll":
        return session.exec(select(EventVote).where(EventVote.event_id == event.id, EventVote.user_id == user.id)).first() is not None
    if event.type == "comment":
        return session.exec(select(EventEntry).where(EventEntry.event_id == event.id, EventEntry.author_id == user.id)).first() is not None
    return session.exec(select(DateAvailability).where(DateAvailability.event_id == event.id, DateAvailability.user_id == user.id)).first() is not None


@router.get("")
def get_notifications(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    cutoff = _aware(user.notif_seen_at) if user.notif_seen_at else None
    def after(dt: datetime) -> bool:
        return cutoff is None or _aware(dt) > cutoff

    # 확인할 것: (확인 시각 이후) 공지 + 대상이면서 미참여한 이벤트
    todos = []
    for n in session.exec(select(Notice).order_by(Notice.created_at.desc())).all():
        if after(n.created_at):
            todos.append({"icon": "📢", "label": "안 읽은 공지", "sub": n.title, "href": "/b/news"})
    for e in session.exec(select(Event)).all():
        if _targets_user(e, user) and not _participated(session, e, user) and after(e.created_at):
            todos.append({"icon": ICON[e.type], "label": f"미참여 {KIND[e.type]}", "sub": e.title, "href": f"/events/{e.id}"})

    my_posts = session.exec(select(Post).where(Post.author_id == user.id)).all()
    my_post_ids = [p.id for p in my_posts]
    titles = {p.id: p.title for p in my_posts}

    new_comments = []
    new_likes = []
    if my_post_ids:
        for c in session.exec(select(Comment).where(Comment.post_id.in_(my_post_ids)).order_by(Comment.created_at.desc())).all():
            if c.author_id != user.id and after(c.created_at):
                new_comments.append({"who": c.display_author, "post": titles[c.post_id], "href": f"/post/{c.post_id}"})
        users = {u.id: u for u in session.exec(select(User)).all()}
        for v in session.exec(select(Vote).where(Vote.target_type == "post", Vote.target_id.in_(my_post_ids)).order_by(Vote.created_at.desc())).all():
            if v.user_id != user.id and after(v.created_at):
                new_likes.append({"who": users[v.user_id].nickname if v.user_id in users else "회원", "post": titles[v.target_id], "href": f"/post/{v.target_id}"})

    return {"todos": todos, "newComments": new_comments[:20], "newLikes": new_likes[:20],
            "total": len(todos) + len(new_comments) + len(new_likes)}


@router.post("/read")
def mark_read(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    user.notif_seen_at = now()
    session.add(user)
    session.commit()
    return {"ok": True}
