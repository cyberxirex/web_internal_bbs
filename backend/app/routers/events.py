from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.abuse import PROFANITY_FILTER, min_interval
from app.db import get_session
from app.models import (DateAvailability, Event, EventEntry, EventEntryLike,
                        EventOption, EventVote, User)
from app.security import get_current_user, get_optional_user, target_matches

router = APIRouter(prefix="/api/events", tags=["events"])

KIND = {"poll": "투표", "comment": "댓글", "date": "날짜 투표"}


def can_see_event(user: User | None, e: Event) -> bool:
    """대상(target)에 해당하는 사람에게만 노출. 전체/미지정은 모두, 관리자는 항상."""
    if user and user.is_admin:
        return True
    return target_matches(user, e.target)


def require_event_visible(user: User | None, e: Event) -> None:
    if not can_see_event(user, e):
        raise HTTPException(status_code=403, detail="이 소식에 참여할 권한이 없습니다.")


def _participants(session: Session, event_id: int, etype: str) -> int:
    if etype == "poll":
        return len(session.exec(select(EventVote.user_id).where(EventVote.event_id == event_id)).all())
    if etype == "comment":
        return len(set(session.exec(select(EventEntry.author_id).where(EventEntry.event_id == event_id)).all()))
    return len(set(session.exec(select(DateAvailability.user_id).where(DateAvailability.event_id == event_id)).all()))


def _pct(session: Session, e: Event) -> int:
    if e.type == "poll":
        opts = session.exec(select(EventOption).where(EventOption.event_id == e.id)).all()
        total = sum(o.votes for o in opts) or 1
        return round(max((o.votes for o in opts), default=0) / total * 100)
    if e.type == "date":
        rows = session.exec(select(DateAvailability).where(DateAvailability.event_id == e.id)).all()
        if not rows:
            return 0
        cells: dict = defaultdict(int)
        for r in rows:
            cells[(r.date, r.hour)] += 1
        part = _participants(session, e.id, "date") or 1
        return round(max(cells.values()) / part * 100)
    return min(100, _participants(session, e.id, "comment") * 12)


@router.get("")
def list_events(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    out = []
    for e in session.exec(select(Event)).all():
        if not can_see_event(user, e):
            continue  # 대상이 아닌 소식은 숨김
        out.append({"id": e.id, "type": e.type, "title": e.title, "desc": e.description,
                    "deadline": e.deadline, "target": e.target, "pct": _pct(session, e),
                    "participants": _participants(session, e.id, e.type)})
    return out


@router.get("/{event_id}")
def get_event(event_id: int, session: Session = Depends(get_session), user: User | None = Depends(get_optional_user)):
    e = session.get(Event, event_id)
    if not e:
        raise HTTPException(404, "이벤트를 찾을 수 없습니다.")
    require_event_visible(user, e)
    base = {"id": e.id, "type": e.type, "title": e.title, "desc": e.description, "body": e.body,
            "deadline": e.deadline, "target": e.target, "participants": _participants(session, e.id, e.type)}

    if e.type == "poll":
        opts = session.exec(select(EventOption).where(EventOption.event_id == e.id)).all()
        abstain = len(session.exec(select(EventVote).where(EventVote.event_id == e.id, EventVote.option_id == None)).all())  # noqa: E711
        my = None
        if user:
            mv = session.exec(select(EventVote).where(EventVote.event_id == e.id, EventVote.user_id == user.id)).first()
            my = ("abstain" if mv.option_id is None else mv.option_id) if mv else None
        base.update({"options": [{"id": o.id, "label": o.label, "votes": o.votes} for o in opts],
                     "abstain": abstain, "myVote": my})

    elif e.type == "comment":
        entries = session.exec(select(EventEntry).where(EventEntry.event_id == e.id)).all()
        authors = {u.id: u for u in session.exec(select(User)).all()}
        my_likes = set()
        if user:
            my_likes = {l.entry_id for l in session.exec(select(EventEntryLike).where(EventEntryLike.user_id == user.id)).all()}
        entries.sort(key=lambda x: x.likes, reverse=True)
        base["entries"] = [{"id": en.id, "author": authors.get(en.author_id).nickname if authors.get(en.author_id) else "익명",
                            "text": en.text, "likes": en.likes, "liked": en.id in my_likes} for en in entries]

    else:  # date
        rows = session.exec(select(DateAvailability).where(DateAvailability.event_id == e.id)).all()
        users = {u.id: u for u in session.exec(select(User)).all()}
        cells: dict = defaultdict(list)
        mine = []
        for r in rows:
            cells[f"{r.date}|{r.hour}"].append(users[r.user_id].nickname if r.user_id in users else "?")
            if user and r.user_id == user.id:
                mine.append({"date": r.date, "hour": r.hour})
        base.update({
            "dates": [d for d in e.candidate_dates.split(",") if d],
            "cells": [{"date": k.split("|")[0], "hour": int(k.split("|")[1]), "count": len(v), "names": v} for k, v in cells.items()],
            "mine": mine,
        })
    return base


# ── 투표(poll) ────────────────────────────────────────────
class PollVoteIn(BaseModel):
    option_id: int | None = None  # None = 기권


@router.post("/{event_id}/vote")
def poll_vote(event_id: int, body: PollVoteIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    e = session.get(Event, event_id)
    if not e or e.type != "poll":
        raise HTTPException(404, "투표를 찾을 수 없습니다.")
    require_event_visible(user, e)
    if session.exec(select(EventVote).where(EventVote.event_id == event_id, EventVote.user_id == user.id)).first():
        raise HTTPException(409, "이미 투표하셨습니다. (1인 1표)")
    opt = None
    if body.option_id is not None:
        opt = session.get(EventOption, body.option_id)
        if not opt or opt.event_id != event_id:
            raise HTTPException(400, "잘못된 선택지입니다.")
    # 동시 중복 투표는 (event_id,user_id) unique 제약이 차단(IntegrityError→409). 카운터는 원자적 재계산.
    session.add(EventVote(event_id=event_id, user_id=user.id, option_id=body.option_id))
    session.flush()
    if opt is not None:
        count_subq = (select(func.count()).select_from(EventVote)
                      .where(EventVote.event_id == event_id, EventVote.option_id == opt.id).scalar_subquery())
        session.execute(update(EventOption).where(EventOption.id == opt.id).values(votes=count_subq))
    session.commit()
    return {"ok": True}


# ── 댓글 이벤트 ───────────────────────────────────────────
class EntryIn(BaseModel):
    text: str


@router.post("/{event_id}/entries")
def add_entry(event_id: int, body: EntryIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    e = session.get(Event, event_id)
    if not e or e.type != "comment":
        raise HTTPException(404, "이벤트를 찾을 수 없습니다.")
    require_event_visible(user, e)
    if not body.text.strip():
        raise HTTPException(400, "내용을 입력하세요.")
    if PROFANITY_FILTER(body.text)[1]:
        raise HTTPException(400, "사용할 수 없는 표현이 포함되어 있어요. 수정 후 다시 등록해 주세요.")
    min_interval(f"entry:{user.id}", 10)
    en = EventEntry(event_id=event_id, author_id=user.id, text=body.text.strip())
    session.add(en)
    session.commit()
    session.refresh(en)
    return {"id": en.id}


@router.post("/entries/{entry_id}/like")
def like_entry(entry_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    en = session.get(EventEntry, entry_id)
    if not en:
        raise HTTPException(404, "항목을 찾을 수 없습니다.")
    require_event_visible(user, session.get(Event, en.event_id))
    like = session.exec(select(EventEntryLike).where(EventEntryLike.entry_id == entry_id, EventEntryLike.user_id == user.id)).first()
    if like:
        session.delete(like)
        liked = False
    else:
        session.add(EventEntryLike(entry_id=entry_id, user_id=user.id))
        liked = True
        try:
            session.flush()  # 동시 중복 좋아요 → unique 위반 흡수
        except IntegrityError:
            session.rollback()
            liked = True
    # 좋아요 수는 실제 행 수를 단일 원자적 UPDATE로 대입(드리프트 방지)
    count_subq = (select(func.count()).select_from(EventEntryLike)
                  .where(EventEntryLike.entry_id == entry_id).scalar_subquery())
    session.execute(update(EventEntry).where(EventEntry.id == entry_id).values(likes=count_subq))
    session.commit()
    en = session.get(EventEntry, entry_id)
    return {"liked": liked, "likes": en.likes}


# ── 날짜 투표 ─────────────────────────────────────────────
class AvailIn(BaseModel):
    date: str
    hour: int
    on: bool


@router.post("/{event_id}/availability")
def set_availability(event_id: int, body: AvailIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    e = session.get(Event, event_id)
    if not e or e.type != "date":
        raise HTTPException(404, "이벤트를 찾을 수 없습니다.")
    require_event_visible(user, e)
    row = session.exec(select(DateAvailability).where(
        DateAvailability.event_id == event_id, DateAvailability.user_id == user.id,
        DateAvailability.date == body.date, DateAvailability.hour == body.hour)).first()
    if body.on and not row:
        session.add(DateAvailability(event_id=event_id, user_id=user.id, date=body.date, hour=body.hour))
    elif not body.on and row:
        session.delete(row)
    session.commit()
    return {"ok": True}
