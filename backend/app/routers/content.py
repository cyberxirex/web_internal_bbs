from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.abuse import PROFANITY_FILTER, min_interval, rate_limit
from app.db import get_session
from app.models import Board, BoardMember, BoardNoticer, Comment, Post, PostRead, User, Vote, now
from app.timeutil import iso_utc

NEW_MAX_AGE = timedelta(hours=8)  # 작성 8시간 지나면 (미확인이어도) NEW 제거


def _naive(dt):
    """SQLite는 naive datetime을 저장 — 비교 전 tz 제거(UTC 기준 통일)."""
    return dt.replace(tzinfo=None) if dt and dt.tzinfo else dt


from app.security import (
    can_access_board,
    can_post_notice,
    client_ip,
    get_current_user,
    get_optional_user,
    hash_pw,
    require_board_access,
    verify_pw,
)

router = APIRouter(prefix="/api", tags=["content"])


# ── 직렬화 ────────────────────────────────────────────────
def board_dict(b: Board) -> dict:
    return {"slug": b.slug, "name": b.name, "short": b.short, "tag": b.tag, "color": b.color,
            "anon": b.is_anon, "dept": b.is_dept, "desc": b.description}


def post_row(p: Post, b: Board) -> dict:
    imgs = [s for s in p.images.split(",") if s]
    return {
        "id": p.id, "boardSlug": b.slug, "board": b.short, "color": b.color,
        "title": p.title, "author": p.display_author, "votes": p.votes,
        "comments": p.comments_count, "views": p.views,
        "createdAt": iso_utc(p.created_at), "image": imgs[0] if imgs else None,
        "imageCount": len(imgs),
    }


def board_by_slug(session: Session, slug: str) -> Board:
    b = session.exec(select(Board).where(Board.slug == slug)).first()
    if not b:
        raise HTTPException(404, "게시판을 찾을 수 없습니다.")
    return b


# ── 게시판 / 목록 ─────────────────────────────────────────
@router.get("/boards")
def list_boards(session: Session = Depends(get_session), user: User | None = Depends(get_optional_user)):
    # 부서 게시판은 멤버(또는 관리자)에게만 노출
    boards = [b for b in session.exec(select(Board).order_by(Board.sort)).all() if can_access_board(session, user, b)]
    # 사이드바 NEW: 직전 방문(prev_login) 이후 올라온 글이 있으면 표시
    since = _naive((user.prev_login or user.created_at)) if user else None
    new_board_ids: set[int] = set()
    if since is not None:
        for p in session.exec(select(Post)).all():
            if _naive(p.created_at) > since:
                new_board_ids.add(p.board_id)
    out = []
    for b in boards:
        d = board_dict(b)
        d["hasNew"] = b.id in new_board_ids
        out.append(d)
    return out


@router.get("/boards/{slug}/posts")
def board_posts(slug: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # 게시판 직접 접근은 로그인 필요 (홈 피드만 공개)
    b = board_by_slug(session, slug)
    require_board_access(session, user, b)
    posts = session.exec(select(Post).where(Post.board_id == b.id).order_by(Post.created_at.desc())).all()
    # NEW: 미확인 + 작성 8시간 이내
    cutoff = _naive(now()) - NEW_MAX_AGE
    fresh_ids = [p.id for p in posts if _naive(p.created_at) > cutoff]
    read_ids = set()
    if fresh_ids:
        read_ids = {r.post_id for r in session.exec(
            select(PostRead).where(PostRead.user_id == user.id, PostRead.post_id.in_(fresh_ids))
        ).all()}

    def row(p: Post) -> dict:
        d = post_row(p, b)
        d["isNew"] = _naive(p.created_at) > cutoff and p.id not in read_ids
        return d

    pinned = [row(p) for p in posts if p.pinned]
    normal = [row(p) for p in posts if not p.pinned]
    return {"board": board_dict(b), "pinned": pinned, "posts": normal}


@router.get("/me/stats")
def me_stats(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    boards = {b.id: b for b in session.exec(select(Board)).all()}
    my_posts = session.exec(select(Post).where(Post.author_id == user.id).order_by(Post.created_at.desc())).all()
    my_post_ids = [p.id for p in my_posts]
    likes_received = 0
    if my_post_ids:
        likes_received = len(session.exec(select(Vote).where(Vote.target_type == "post", Vote.target_id.in_(my_post_ids))).all())
    return {
        "posts": len(my_posts),
        "comments": len(session.exec(select(Comment).where(Comment.author_id == user.id)).all()),
        "likesGiven": len(session.exec(select(Vote).where(Vote.user_id == user.id)).all()),
        "likesReceived": likes_received,
        "myPosts": [post_row(p, boards[p.board_id]) for p in my_posts[:5] if p.board_id in boards],
    }


@router.get("/me/permissions")
def me_permissions(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """공지 작성 가능한 게시판 slug 목록. 관리자는 전체."""
    boards = session.exec(select(Board)).all()
    if user.is_admin:
        notice_boards = [b.slug for b in boards]
    else:
        by_id = {b.id: b for b in boards}
        rows = session.exec(select(BoardNoticer).where(BoardNoticer.user_id == user.id)).all()
        notice_boards = [by_id[r.board_id].slug for r in rows if r.board_id in by_id]
    return {"isAdmin": user.is_admin, "noticeBoards": notice_boards}


@router.get("/feed")
def feed(session: Session = Depends(get_session)):
    # 홈 피드는 공개 — 부서 게시판 글은 노출하지 않음
    boards = {b.id: b for b in session.exec(select(Board)).all() if not b.is_dept}
    posts = session.exec(select(Post).order_by(Post.created_at.desc()).limit(200)).all()
    rows = [post_row(p, boards[p.board_id]) for p in posts if p.board_id in boards][:60]
    weekly = sorted(rows, key=lambda r: r["votes"], reverse=True)[:5]
    return {"posts": rows, "weeklyBest": weekly}


# ── 글 상세 (로그인 필요) ─────────────────────────────────
@router.get("/posts/{post_id}")
def get_post(post_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    p = session.get(Post, post_id)
    if not p:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    b = session.get(Board, p.board_id)
    require_board_access(session, user, b)
    # 조회수는 원자적 UPDATE로 증가(동시 조회 시 lost-update 방지)
    session.execute(update(Post).where(Post.id == p.id).values(views=Post.views + 1))
    session.commit()
    session.refresh(p)
    # 확인 기록 → NEW 딱지 제거. 멱등: 동시/중복 삽입은 unique 제약 위반을 무시.
    already = session.exec(select(PostRead).where(PostRead.user_id == user.id, PostRead.post_id == p.id)).first()
    if not already:
        session.add(PostRead(user_id=user.id, post_id=p.id))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
    voted = session.exec(
        select(Vote).where(Vote.user_id == user.id, Vote.target_type == "post", Vote.target_id == p.id)
    ).first() is not None
    data = post_row(p, b)
    data.update({
        "body": p.body,
        "images": [s for s in p.images.split(",") if s],
        "isAnon": p.is_anon,
        "voted": voted,
        "mine": (not p.is_anon) and p.author_id == user.id,
        "pinned": p.pinned,
    })
    return data


class PostIn(BaseModel):
    title: str
    body: str = ""
    images: list[str] = []
    delete_password: str | None = None  # 익명글 4자리
    pinned: bool = False  # 공지 고정 (관리자만 적용)


@router.post("/boards/{slug}/posts")
def create_post(slug: str, body: PostIn, request: Request, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    b = board_by_slug(session, slug)
    require_board_access(session, user, b)
    if not body.title.strip():
        raise HTTPException(400, "제목을 입력하세요.")
    # 도배 방지: 사용자/IP 최소 간격 + 분당 제한
    ip = client_ip(request)
    min_interval(f"post:{user.id}", 20)
    rate_limit(f"post-ip:{ip}", limit=10, window_sec=600)
    if PROFANITY_FILTER(body.title)[1] or PROFANITY_FILTER(body.body)[1]:
        raise HTTPException(400, "사용할 수 없는 표현이 포함되어 있어요. 수정 후 다시 등록해 주세요.")

    p = Post(board_id=b.id, title=body.title, body=body.body, images=",".join(body.images))
    is_notice = body.pinned and can_post_notice(session, user, b.id)
    p.pinned = is_notice
    if b.is_anon and not is_notice:
        # 진짜 익명: 작성자/IP 미기록. 4자리 삭제 비번 필수.
        pw = (body.delete_password or "").strip()
        if not (pw.isdigit() and len(pw) == 4):
            raise HTTPException(400, "익명글은 4자리 숫자 삭제 비밀번호가 필요합니다.")
        p.is_anon = True
        p.display_author = "익명"
        p.delete_pw_hash = hash_pw(pw)
    else:
        # 일반글, 또는 익명게시판의 공지(실명·권한자만)
        p.author_id = user.id
        p.author_ip = ip
        p.display_author = user.nickname
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"id": p.id}


class DeleteIn(BaseModel):
    password: str | None = None


@router.post("/posts/{post_id}/delete")
def delete_post(post_id: int, body: DeleteIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    p = session.get(Post, post_id)
    if not p:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    require_board_access(session, user, session.get(Board, p.board_id))
    if p.is_anon:
        if not p.delete_pw_hash or not verify_pw((body.password or ""), p.delete_pw_hash):
            raise HTTPException(403, "삭제 비밀번호가 올바르지 않습니다.")
    elif p.author_id != user.id and not user.is_admin:
        raise HTTPException(403, "본인 글만 삭제할 수 있습니다.")
    # 댓글 + 댓글/글의 공감(Vote) + 읽음기록(PostRead)까지 함께 정리(고아 레코드/집계 오염 방지)
    for c in session.exec(select(Comment).where(Comment.post_id == p.id)).all():
        for v in session.exec(select(Vote).where(Vote.target_type == "comment", Vote.target_id == c.id)).all():
            session.delete(v)
        session.delete(c)
    for v in session.exec(select(Vote).where(Vote.target_type == "post", Vote.target_id == p.id)).all():
        session.delete(v)
    for r in session.exec(select(PostRead).where(PostRead.post_id == p.id)).all():
        session.delete(r)
    session.delete(p)
    session.commit()
    return {"ok": True}


# ── 댓글 ───────────────────────────────────────────────────
@router.get("/posts/{post_id}/comments")
def list_comments(post_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    p = session.get(Post, post_id)
    if p:
        require_board_access(session, user, session.get(Board, p.board_id))
    cmts = session.exec(select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at)).all()
    return [{"id": c.id, "author": c.display_author, "body": c.body, "votes": c.votes,
             "images": [s for s in c.images.split(",") if s], "createdAt": iso_utc(c.created_at)} for c in cmts]


class CommentIn(BaseModel):
    body: str
    images: list[str] = []


@router.post("/posts/{post_id}/comments")
def create_comment(post_id: int, body: CommentIn, request: Request, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    p = session.get(Post, post_id)
    if not p:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    require_board_access(session, user, session.get(Board, p.board_id))
    if not body.body.strip() and not body.images:
        raise HTTPException(400, "내용을 입력하세요.")
    min_interval(f"comment:{user.id}", 10)
    if PROFANITY_FILTER(body.body)[1]:
        raise HTTPException(400, "사용할 수 없는 표현이 포함되어 있어요. 수정 후 다시 등록해 주세요.")
    b = session.get(Board, p.board_id)
    c = Comment(post_id=post_id, body=body.body, images=",".join(body.images))
    if b and b.is_anon:
        c.is_anon = True
        c.display_author = "익명"
    else:
        c.author_id = user.id
        c.author_ip = client_ip(request)
        c.display_author = user.nickname
    session.add(c)
    # 댓글수도 원자적 증가(동시 작성 시 lost-update 방지)
    session.execute(update(Post).where(Post.id == p.id).values(comments_count=Post.comments_count + 1))
    session.commit()
    session.refresh(c)
    return {"id": c.id}


# ── 공감(추천) 토글 — 1인 1표 ─────────────────────────────
def _vote_count_subq(target_type: str, target_id: int):
    return (select(func.count()).select_from(Vote)
            .where(Vote.target_type == target_type, Vote.target_id == target_id)
            .scalar_subquery())


def _toggle_vote(session: Session, user: User, target_type: str, target_id: int, obj) -> dict:
    """공감 토글. 카운터는 ±1 누산 대신 '실제 행 수' 서브쿼리를 단일 원자적 UPDATE로 대입 →
    동시 토글에서도 lost-update/드리프트 없음(SQLite·Postgres 양쪽 안전). 중복은 unique 제약으로 차단."""
    obj_type, obj_id = type(obj), obj.id
    existing = session.exec(
        select(Vote).where(Vote.user_id == user.id, Vote.target_type == target_type, Vote.target_id == target_id)
    ).first()
    if existing:
        session.delete(existing)
        voted = False
    else:
        session.add(Vote(user_id=user.id, target_type=target_type, target_id=target_id))
        voted = True
        try:
            session.flush()  # 동시 중복 공감 → unique 위반을 여기서 흡수(이미 공감한 상태로 간주)
        except IntegrityError:
            session.rollback()
            voted = True
    # flush된 insert/delete를 포함한 현재 상태로 카운터를 한 문장으로 재계산
    session.execute(update(obj_type).where(obj_type.id == obj_id)
                    .values(votes=_vote_count_subq(target_type, target_id)))
    session.commit()
    obj = session.get(obj_type, obj_id)
    return {"voted": voted, "votes": obj.votes}


@router.post("/posts/{post_id}/vote")
def vote_post(post_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    p = session.get(Post, post_id)
    if not p:
        raise HTTPException(404, "글을 찾을 수 없습니다.")
    require_board_access(session, user, session.get(Board, p.board_id))
    return _toggle_vote(session, user, "post", post_id, p)


@router.post("/comments/{comment_id}/vote")
def vote_comment(comment_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    c = session.get(Comment, comment_id)
    if not c:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    p = session.get(Post, c.post_id)
    if not p:
        raise HTTPException(404, "댓글을 찾을 수 없습니다.")
    require_board_access(session, user, session.get(Board, p.board_id))  # 부서 게시판 비멤버 차단(IDOR 방지)
    return _toggle_vote(session, user, "comment", comment_id, c)
