"""초기 시드 데이터 (비어 있을 때만 삽입)."""
from __future__ import annotations

from sqlmodel import Session, select

from app.db import engine
from app.models import (Banner, Board, Event, EventEntry, EventOption, Notice,
                        Post, User, now)
from app.security import hash_pw

BOARDS = [
    ("free", "자유게시판", "자유", "F", "primary", False, "자유롭게 이야기를 나누는 공간"),
    ("qna", "질문과 답변", "질문", "Q", "primary", False, "궁금한 점을 묻고 답해요"),
    ("news", "사내 소식", "소식", "N", "pink", False, "회사 공식 소식과 안내"),
    ("tips", "업무 팁", "팁", "L", "primary", False, "업무에 도움 되는 노하우"),
    ("gallery", "갤러리", "갤러리", "G", "primary", False, "사진과 이미지를 공유해요"),
    ("market", "나눔/장터", "나눔", "U", "primary", False, "사내 나눔과 중고 거래"),
    ("anon", "익명게시판", "익명", "A", "pink", True, "로그인 후 익명으로 글을 남깁니다 · 작성자/IP를 기록하지 않아요"),
]


def seed() -> None:
    with Session(engine) as s:
        if s.exec(select(Board)).first():
            return  # 이미 시드됨

        boards: dict[str, Board] = {}
        for i, (slug, name, short, tag, color, anon, desc) in enumerate(BOARDS):
            b = Board(slug=slug, name=name, short=short, tag=tag, color=color, is_anon=anon, description=desc, sort=i)
            s.add(b)
            boards[slug] = b
        s.commit()
        for b in boards.values():
            s.refresh(b)

        admin = User(username="admin", nickname="나야나", password_hash=hash_pw("admin"),
                     is_admin=True, points=1280, level=7, level_name="열심 회원", groups="개발팀", last_login=now())
        kim = User(username="kim", nickname="kim***", password_hash=hash_pw("test"), groups="개발팀")
        s.add(admin); s.add(kim)
        s.commit(); s.refresh(admin); s.refresh(kim)

        def post(slug, title, body, author, votes=0, views=0, images=""):
            p = Post(board_id=boards[slug].id, title=title, body=body, author_id=author.id,
                     display_author=author.nickname, votes=votes, views=views, images=images)
            s.add(p); return p

        post("free", "신규 입사자 환영회 사진 공유합니다 📸", "지난 금요일 환영회 사진 모아서 올립니다!", admin, 142, 1203)
        post("tips", "사내 VPN 느릴 때 이렇게 해보세요", "DNS를 사내 DNS로 바꾸면 빨라집니다.", kim, 87, 760)
        post("qna", "연차 이월 관련 아시는 분?", "올해 남은 연차 이월 가능한가요?", kim, 33, 410)
        post("gallery", "사옥 옥상에서 찍은 노을 🌇", "퇴근길 옥상에서 한 컷.", admin, 31, 274,
             images="/gallery/g1.jpg,/gallery/g5.jpg")
        post("gallery", "신입 환영회 단체사진 🎉", "다같이 모여 찍은 단체샷!", kim, 88, 920,
             images="/gallery/g3.jpg,/gallery/g1.jpg,/gallery/g6.jpg,/gallery/g4.jpg,/gallery/g2.jpg")
        s.commit()

        for t in ["[필독] 사내 게시판 이용 수칙 안내", "여름 휴가 신청 기간 안내 (6/1~6/14)", "보안 교육 이수 마감 D-3"]:
            s.add(Notice(title=t))
        s.commit()

        # 투표
        poll = Event(type="poll", title="체육대회 종목 투표", description="5/30까지", deadline="2026-05-30",
                     target="전체", body="가장 하고 싶은 종목 하나를 선택해 주세요!")
        s.add(poll); s.commit(); s.refresh(poll)
        for label, v in [("풋살", 52), ("피구", 34), ("줄다리기", 28), ("이어달리기", 14)]:
            s.add(EventOption(event_id=poll.id, label=label, votes=v))

        # 댓글 이벤트
        ce = Event(type="comment", title="맛집 추천 이벤트", description="댓글 선정", deadline="2026-06-05",
                   target="전체", body="회사 근처 맛집을 댓글로 추천해 주세요!")
        s.add(ce); s.commit(); s.refresh(ce)
        s.add(EventEntry(event_id=ce.id, author_id=kim.id, text="회사 뒷골목 두부공방 강추", likes=38))

        # 날짜 투표
        s.add(Event(type="date", title="3분기 팀 회식 일정", description="가능 시간 체크", deadline="2026-06-20",
                    target="개발팀", body="각 날짜 칸의 시계에서 가능한 시간을 칠해 주세요.",
                    candidate_dates="2026-07-03,2026-07-04,2026-07-08,2026-07-10,2026-07-11,2026-07-15"))

        s.add(Banner(text="🎉 2분기 우수사원 시상식이 곧 진행됩니다!", sub="관리자가 교체하는 공지/홍보 전용 슬롯입니다", active=True))
        s.commit()
