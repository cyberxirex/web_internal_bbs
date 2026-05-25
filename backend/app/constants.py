"""앱 전역 상수 — 프론트/백엔드 단일 출처.

GROUPS: 사내 부서 목록. 회원가입 시 소속 선택, 이벤트 타게팅(target) 매칭에 사용.
프론트는 GET /api/meta 로 이 목록을 받아 하드코딩을 피한다.
"""
from __future__ import annotations

GROUPS = ["개발팀", "디자인팀", "기획팀", "마케팅팀", "경영지원팀"]
