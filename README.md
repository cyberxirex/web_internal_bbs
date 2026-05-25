# CTCK 사내 게시판 (Web Internal BBS)

사내용 게시판/공지/이벤트 시스템. **백엔드 FastAPI + 프론트엔드 Next.js** 구성입니다.

- 백엔드: FastAPI · SQLModel · SQLite(기본) — `backend/`
- 프론트엔드: Next.js 16 · React 19 · Tailwind CSS — `frontend/`

> 데모 DB(`backend/ctck.db`)와 업로드 파일(`backend/uploads/`)은 저장소에 포함되지 않습니다. 백엔드를 처음 실행하면 DB가 **자동 생성·시드**됩니다.

---

## 사전 준비물

- [uv](https://docs.astral.sh/uv/) (Python 3.11+ 패키지/런타임 관리)
- Node.js 18+ 및 npm

## 1. 백엔드 실행

```bash
# 저장소 루트에서: 의존성 설치
uv sync

# 브라우저 자동화(이미지 처리 등)에 Playwright 브라우저가 필요한 경우
uv run playwright install chromium

# 백엔드 기동 (backend 디렉터리에서 실행 → ctck.db가 backend/에 생성됨)
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

- 최초 기동 시 `backend/ctck.db`가 생성되고 초기 데이터가 시드됩니다.
- API 문서: http://localhost:8000/docs · 헬스체크: http://localhost:8000/api/health
- 업로드 파일은 `backend/uploads/`에 저장되어 `/uploads`로 제공됩니다.

### 기본 계정 (시드 데이터)

| 사용자명 | 비밀번호 | 권한 |
|---------|---------|------|
| `admin` | `admin` | 관리자 |
| `kim`   | `test`  | 일반 |

## 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

- 접속: http://localhost:3000
- 백엔드 주소는 기본값 `http://localhost:8000`. 다르게 쓰려면 `frontend/.env.local`에 설정:

  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

## 설정 (환경 변수)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./ctck.db` | DB 연결 문자열. PostgreSQL 등으로 전환 가능 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | 프론트엔드가 호출할 백엔드 주소 |

## DB 초기화 / 재생성

DB는 비어 있을 때만 시드됩니다. 데이터를 초기화하려면 DB 파일을 지우고 백엔드를 다시 기동하세요.

```bash
rm backend/ctck.db
# 백엔드 재기동 시 자동 재생성·시드
```
