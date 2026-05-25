from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import admin, auth, content, events, misc, notifications
from app.seed import seed

app = FastAPI(title="CTCK BBS API")

# 사내망 프론트(Next.js). 운영 시 도메인 제한.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(events.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(misc.router)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
