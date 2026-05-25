# CLAUDE.md — 사내 게시판 (web_internal_bbs)

> Claude Code가 이 리포에서 작업할 때 참고하는 프로젝트 컨텍스트·결정사항.

## 무엇인가

**사내 소통 게시판**. 일반적인 한국형 커뮤니티 포털 스타일의 3단 레이아웃·기능.

- **규모/제약**: 사내망 전용(외부 미노출), 동접 ≤20명, 광고 없음(메인 상단 관리자 배너 슬롯 1개만).
- **스택**: 백엔드 **FastAPI + SQLModel + SQLite**(`backend/`, 기본 `ctck.db`, `DATABASE_URL`로 PostgreSQL 전환 가능) · 프론트 **Next.js 16(App Router, Turbopack) + React 19 + Tailwind v4**(`frontend/`).
- **인증**: Bearer 토큰(`AuthToken` 테이블), 만료 `TOKEN_TTL_DAYS`(기본 7). 프론트는 `lib/api.ts`에서 localStorage 토큰으로 fetch.

## 실행

```bash
# 백엔드 (backend/에서) — startup에서 init_db + seed 자동
cd backend && uv run uvicorn app.main:app --port 8000 --reload
# 프론트
cd frontend && npm run dev          # :3000
```

- 프론트 BASE = `NEXT_PUBLIC_API_URL` || `http://localhost:8000`.
- CORS 허용 origin = `CORS_ORIGINS`(콤마구분) || `localhost:3000,127.0.0.1:3000`. **3000 외 포트로 프론트를 띄우면 CORS_ORIGINS도 맞춰야 함.**
- 업로드 파일은 `backend/uploads/` → `/uploads` 정적 서빙(리포 미포함).
- **시드**: 게시판 7개(구조)는 dev/운영 공통으로 항상 생성(멱등). 데모 콘텐츠(테스트 계정·샘플 글/이벤트/배너)는 **개발 환경에서만** 주입. 테스트 계정(개발용): `admin`/`admin`(관리자), `kim`/`test`. 운영(`ENV=production`)은 게시판 구조만 만들고 데모는 생략하며 admin은 생성하지 않음.

## 환경변수

| 변수 | 기본 | 설명 |
|------|------|------|
| `DATABASE_URL` | `sqlite:///./ctck.db` | DB 연결. PostgreSQL 전환 가능 |
| `ENV` | `development` | `production`이면 게시판 구조만 시드(데모 콘텐츠·admin 미주입) |
| `SEED_ADMIN_PW` | `admin` | 시드 admin 비번 |
| `TOKEN_TTL_DAYS` | `7` | 인증 토큰 만료(일) |
| `TRUST_PROXY` | `0` | `1`일 때만 X-Forwarded-For 신뢰(역프록시 뒤). 기본은 미신뢰 |
| `CORS_ORIGINS` | localhost:3000,127… | 허용 origin 콤마구분 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | 프론트가 호출할 백엔드 |

## 백엔드 구조 (`backend/app/`)

`db.py`(엔진/세션 + SQLite WAL·풀, `_ensure_columns` 경량 마이그레이션) · `models.py`(전 테이블, 복합 UNIQUE 제약) · `security.py`(bcrypt, 토큰, `get_current_user`/`require_admin`, `client_ip`, `target_matches`) · `abuse.py`(인메모리 레이트리밋·도배방지·다중가입 플래그·교체형 비속어필터 `PROFANITY_FILTER`) · `constants.py`(`GROUPS` 부서 목록 단일 출처) · `timeutil.py`(UTC/KST 변환) · `seed.py` · `routers/`(auth, content, events, notifications, admin, misc).

## 핵심 기능·정책

- **게시판**: 일반(공개) + **익명게시판**(작성자/IP 미기록, 4자리 삭제비번 해시, 수정 불가, 접근만 로그인) + **부서/동호회 게시판**(멤버 전용).
- **권한 분리(서버 강제)**:
  - 일반 게시판 → 누구나(비로그인 포함 일부).
  - 부서 게시판(`Board.is_dept`, `BoardMember`) → `can_access_board`/`require_board_access`가 read/write 전부 게이트. `/api/boards`가 멤버십으로 서버에서 필터 → 비멤버는 응답에서 아예 제외(피드·검색에서도). 프론트 조작으로 우회 불가.
  - 공지(고정) 권한 → 관리자 지정(`BoardNoticer`, `can_post_notice`). 익명게시판 공지는 실명으로 기록.
- **게시판 메뉴 구조는 의도적으로 프론트 하드코딩**: 일반 게시판의 그룹·순서는 `frontend/src/components/LeftPanel.tsx`의 `GROUPS`에 slug로 박혀 있고, 시드 slug와 짝이 맞아야 표시됨. 일반 게시판 추가 시 **DB(seed)와 LeftPanel `GROUPS` 두 곳을 같이** 수정해야 함(+필요시 `Header.tsx`, `hideOrder`). 부서 게시판은 `b.dept`로 동적 렌더돼 DB만 추가하면 됨. (모두 공개라 권한이 필요 없고 게시판이 고정적이라, data-driven으로 안 바꾸기로 결정 — YAGNI)
- **이벤트(진행 중 소식)**: poll(1인1표/기권)·comment(좋아요)·date(아날로그 시계 날짜투표). `Event.target`으로 대상 제한 — `target_matches`(그룹 또는 username만; nickname은 중복 가능해 매칭에서 제외). 관리자는 항상 열람.
- **NEW 배지**: 사이드바=직전 방문(`prev_login`) 이후 글 / 글목록=미확인 & 8시간 이내(`PostRead`로 제거).
- **어뷰징 방지**: 가입IP 기록·동일IP 다계정 플래그·가입/로그인/작성 레이트리밋·도배 최소간격·비속어 필터. **전제**: 사내망에서 각 PC 사설 IP를 직접 수신(NAT 단일출구 문제 없음). 외부 노출/프록시 도입 시 `TRUST_PROXY`로 XFF 처리.

## 동시성·정합성 (검증 완료)

- 카운터(votes/views/likes/comments_count)는 **원자적 UPDATE/서브쿼리 재계산**으로 lost-update 없음(SQLite·Postgres 양쪽 안전).
- 1인1표류는 **복합 UNIQUE 제약** + IntegrityError→409(전역 핸들러). 토글은 unique 위반을 흡수.
- 삭제 시 cascade(글/부서판/이벤트 삭제 → 자식 Vote/PostRead/EventOption 등 정리).
- **주의**: `_ensure_columns`(경량 마이그레이션)는 SQLite에서 **컬럼 추가만** 가능. UNIQUE 등 제약은 신규 테이블에만 적용되고 기존 `ctck.db`엔 소급 안 됨 → 정식 변경은 Alembic 필요.

## 작업 관례

- **UI 검증**: `npx playwright`가 아니라 **uv + Python Playwright**(`uv run --with playwright python ...`) 사용. 로그인 폼 → 네비게이트 → 스크린샷.
- 백엔드 임시 DB 테스트: `DATABASE_URL="sqlite:///./_tmp.db"`로 격리하고 운영 `ctck.db` 오염 금지, 끝나면 삭제.
- 프론트 빌드 게이트: `next build`는 ESLint를 막지 않음. `react-hooks/set-state-in-effect` 경고는 코드베이스 전반의 기존 패턴(빌드 무관).
- `frontend/AGENTS.md`: 이 Next.js는 학습데이터와 다를 수 있으니 Next 고유 기능 작성 전 `node_modules/next/dist/docs/` 확인 권장.

## 남은 백로그 (심각 잔여 없음)

- `set-state-in-effect` lint 정리(빌드 무관, 7곳, 코드베이스 전반).
- 기존 `ctck.db`에 복합 UNIQUE 소급(Alembic 도입 시점).
- 프론트 캐싱/실시간 부재(SWR/폴링 없음 — `useFocusRefetch`로 부분 보강). 동접 20 규모엔 무해.
- dev `ctck.db`의 데모/테스트 데이터 정리 여부 미결정.
