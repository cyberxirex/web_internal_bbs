from __future__ import annotations

import os
import re
import secrets
import urllib.request
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, col, or_, select

from app.db import get_session
from app.models import Banner, Board, Notice, Post, User
from app.routers.content import board_dict, post_row
from app.security import can_access_board, get_current_user

router = APIRouter(prefix="/api", tags=["misc"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── 검색 (로그인 필요) ────────────────────────────────────
@router.get("/search")
def search(q: str = "", session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    query = q.strip()
    if not query:
        return {"query": "", "results": []}
    like = f"%{query}%"
    boards = {b.id: b for b in session.exec(select(Board)).all()}
    posts = session.exec(
        select(Post).where(or_(col(Post.title).ilike(like), col(Post.body).ilike(like))).order_by(Post.created_at.desc())
    ).all()
    results = []
    for p in posts:
        b = boards.get(p.board_id)
        if not b or not can_access_board(session, user, b):
            continue  # 부서 게시판은 멤버에게만
        row = post_row(p, b)
        row["snippet"] = p.body[:120]
        results.append(row)
    return {"query": query, "results": results}


# ── 갤러리 (공개 — 비로그인도 열람, 프론트에서 블러 처리) ──
@router.get("/gallery")
def gallery(session: Session = Depends(get_session)):
    b = session.exec(select(Board).where(Board.slug == "gallery")).first()
    if not b:
        return {"board": None, "posts": []}
    posts = session.exec(select(Post).where(Post.board_id == b.id).order_by(Post.created_at.desc())).all()
    return {"board": board_dict(b), "posts": [post_row(p, b) for p in posts]}


# ── 공지 목록 ─────────────────────────────────────────────
@router.get("/notices")
def list_notices(session: Session = Depends(get_session)):
    rows = session.exec(select(Notice).order_by(Notice.created_at.desc())).all()
    return [{"id": n.id, "title": n.title, "time": n.created_at.strftime("%m-%d")} for n in rows]


# ── 배너 (메인 상단 사내 홍보 슬롯) ───────────────────────
@router.get("/banner")
def get_banner(session: Session = Depends(get_session)):
    b = session.exec(select(Banner).where(Banner.active == True)).first()  # noqa: E712
    if not b:
        return None
    return {"text": b.text, "sub": b.sub, "image": b.image}


# ── 링크 미리보기 (OG 메타) ───────────────────────────────
def _meta(html: str, prop: str) -> str | None:
    for pat in (
        r'<meta[^>]+(?:property|name)=["\']' + re.escape(prop) + r'["\'][^>]*content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']' + re.escape(prop) + r'["\']',
    ):
        m = re.search(pat, html, re.I)
        if m:
            return m.group(1)
    return None


@router.get("/link-preview")
def link_preview(url: str, user: User = Depends(get_current_user)):
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(400, "유효한 URL이 아닙니다.")
    domain = urlparse(url).netloc
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; CTCK-BBS/1.0)"})
        with urllib.request.urlopen(req, timeout=4) as r:  # noqa: S310 (사내망 전용)
            html = r.read(300_000).decode("utf-8", "ignore")
    except Exception:
        return {"url": url, "title": url, "description": "", "image": None, "domain": domain}
    title = _meta(html, "og:title")
    if not title:
        m = re.search(r"<title[^>]*>([^<]+)", html, re.I)
        title = m.group(1).strip() if m else url
    return {"url": url, "title": title, "description": _meta(html, "og:description") or "", "image": _meta(html, "og:image"), "domain": domain}


# ── 이미지 업로드 (붙여넣기) ──────────────────────────────
@router.post("/uploads")
async def upload(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        raise HTTPException(400, "이미지 파일만 업로드할 수 있습니다.")
    name = secrets.token_hex(8) + ext
    path = os.path.join(UPLOAD_DIR, name)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"url": f"/uploads/{name}"}
