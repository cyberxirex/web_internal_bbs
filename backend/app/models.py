"""SQLModel 테이블 정의 — 전 기능 포함."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


# ── 사용자 / 인증 ──────────────────────────────────────────
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    nickname: str
    password_hash: str
    is_admin: bool = False
    points: int = 0
    level: int = 1
    level_name: str = "새내기"
    groups: str = ""  # 콤마구분 그룹(투표 대상 매칭). 예: "개발팀"
    reg_ip: str = ""  # 가입 IP (다중가입 탐지)
    created_at: datetime = Field(default_factory=now)
    last_login: datetime | None = None
    prev_login: datetime | None = None  # 직전 세션 로그인 시각 (사이드바 NEW 기준)
    flagged: bool = False  # 동일 IP 다중가입 등 의심 플래그
    notif_seen_at: datetime | None = None  # 알림 "모두 읽음" 시각 (이후 활동만 알림)


class AuthToken(SQLModel, table=True):
    token: str = Field(primary_key=True)
    user_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=now)


# ── 게시판 / 글 / 댓글 ─────────────────────────────────────
class Board(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True)
    name: str
    short: str
    tag: str = ""
    color: str = "primary"  # primary | pink
    is_anon: bool = False
    is_dept: bool = False  # 부서 게시판(멤버만 접근). 관리자가 신설/삭제.
    description: str = ""
    sort: int = 0


class BoardNoticer(SQLModel, table=True):
    """게시판별 공지 작성 권한자 (관리자가 지정). 관리자는 별도 지정 없이도 항상 가능."""
    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(index=True)
    user_id: int = Field(index=True)


class BoardMember(SQLModel, table=True):
    """부서 게시판 멤버(접근 가능자). 관리자는 멤버가 아니어도 관리 가능."""
    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(index=True)
    user_id: int = Field(index=True)


class PostRead(SQLModel, table=True):
    """사용자가 연(확인한) 글. NEW 딱지 제거 기준."""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    post_id: int = Field(index=True)


class Post(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(index=True)
    title: str
    body: str = ""
    images: str = ""  # 콤마구분 이미지 경로
    # 일반글: author_id/author_ip 기록. 익명글: 둘 다 None(추적 안 함) + delete_pw_hash.
    author_id: int | None = Field(default=None, index=True)
    author_ip: str | None = None
    display_author: str = "익명"
    is_anon: bool = False
    delete_pw_hash: str | None = None  # 익명글 삭제용 4자리 비번 해시
    votes: int = 0
    views: int = 0
    comments_count: int = 0
    pinned: bool = False  # 관리자 고정(게시판 최상단, 페이지네이션 무관)
    created_at: datetime = Field(default_factory=now)


class Comment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    post_id: int = Field(index=True)
    body: str
    images: str = ""  # 콤마구분 이미지 경로
    author_id: int | None = Field(default=None, index=True)
    author_ip: str | None = None
    display_author: str = "익명"
    is_anon: bool = False
    votes: int = 0
    created_at: datetime = Field(default_factory=now)


class Vote(SQLModel, table=True):
    """공감(추천). 1인 1표 (user_id + target)."""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    target_type: str = Field(index=True)  # post | comment
    target_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=now)


# ── 공지 ───────────────────────────────────────────────────
class Notice(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    body: str = ""
    created_at: datetime = Field(default_factory=now)


class NoticeRead(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    notice_id: int = Field(index=True)


# ── 이벤트 (투표 / 댓글이벤트 / 날짜투표) ──────────────────
class Event(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    type: str  # poll | comment | date
    title: str
    description: str = ""
    body: str = ""
    deadline: str = ""
    target: str = "전체"
    candidate_dates: str = ""  # date 타입: 콤마구분 ISO 날짜
    created_by: int | None = None
    created_at: datetime = Field(default_factory=now)


class EventOption(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)
    label: str
    votes: int = 0


class EventVote(SQLModel, table=True):
    """투표 1인 1표. option_id None = 기권."""
    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)
    user_id: int = Field(index=True)
    option_id: int | None = None


class EventEntry(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)
    author_id: int
    text: str
    likes: int = 0
    created_at: datetime = Field(default_factory=now)


class EventEntryLike(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    entry_id: int = Field(index=True)
    user_id: int = Field(index=True)


class DateAvailability(SQLModel, table=True):
    """날짜투표: 사용자별 (날짜, 시) 가능 표시."""
    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)
    user_id: int = Field(index=True)
    date: str = Field(index=True)  # ISO
    hour: int = Field(index=True)


# ── 배너 (메인 상단 사내 홍보 슬롯, 1개 활성) ──────────────
class Banner(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    text: str = ""
    sub: str = ""
    image: str | None = None
    active: bool = True
    updated_at: datetime = Field(default_factory=now)
