import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg
from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for the auth API")

app = FastAPI(title="BTI Receptionist API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COOKIE_NAME = "bti_session"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"


def db():
    return psycopg.connect(DATABASE_URL)


def init_db() -> None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS bti_users (
                    id BIGSERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS bti_sessions (
                    token TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES bti_users(id) ON DELETE CASCADE,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS bti_conversations (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES bti_users(id) ON DELETE CASCADE,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ended_at TIMESTAMPTZ,
                    duration_seconds INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS bti_messages (
                    id BIGSERIAL PRIMARY KEY,
                    conversation_id BIGINT NOT NULL REFERENCES bti_conversations(id) ON DELETE CASCADE,
                    speaker TEXT NOT NULL CHECK (speaker IN ('AI', 'YOU')),
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS bti_sessions_user_idx ON bti_sessions(user_id);
                CREATE INDEX IF NOT EXISTS bti_messages_conversation_idx ON bti_messages(conversation_id);
                """
            )


@app.on_event("startup")
def startup() -> None:
    init_db()


class Credentials(BaseModel):
    name: str = Field(default="", max_length=100)
    email: EmailStr
    password: str = Field(max_length=128)


class Message(BaseModel):
    speaker: str = Field(max_length=10)
    content: str = Field(max_length=8000)


class EndPayload(BaseModel):
    duration_seconds: int = 0


class ConversationPayload(BaseModel):
    duration_seconds: int = 0
    messages: list[Message] = []


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
        return algorithm == "pbkdf2_sha256" and hmac.compare_digest(candidate.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_session(response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=14)
    with db() as conn:
        conn.execute("INSERT INTO bti_sessions (token, user_id, expires_at) VALUES (%s, %s, %s)", (token, user_id, expires))
    response.set_cookie(COOKIE_NAME, token, max_age=14 * 24 * 3600, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/")


def current_user(session: str | None) -> dict[str, Any] | None:
    if not session:
        return None
    with db() as conn:
        row = conn.execute(
            """SELECT u.id, u.name, u.email FROM bti_sessions s JOIN bti_users u ON u.id=s.user_id
               WHERE s.token=%s AND s.expires_at > NOW()""",
            (session,),
        ).fetchone()
    return {"id": row[0], "name": row[1], "email": row[2]} if row else None


def require_user(session: str | None) -> dict[str, Any]:
    user = current_user(session)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return user


@app.get("/status")
def status() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/signup")
def signup(payload: Credentials, response: Response) -> dict[str, Any]:
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Use a password with at least 8 characters")
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Tell us your name")
    try:
        with db() as conn:
            row = conn.execute(
                "INSERT INTO bti_users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
                (name, payload.email.lower().strip(), hash_password(payload.password)),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    create_session(response, row[0])
    return {"user": {"id": row[0], "name": name, "email": payload.email.lower().strip()}}


@app.post("/api/auth/login")
def login(payload: Credentials, response: Response) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("SELECT id, name, email, password_hash FROM bti_users WHERE email=%s", (payload.email.lower().strip(),)).fetchone()
    if not row or not verify_password(payload.password, row[3]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    create_session(response, row[0])
    return {"user": {"id": row[0], "name": row[1], "email": row[2]}}


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response, bti_session: str | None = Cookie(default=None)) -> None:
    if bti_session:
        with db() as conn:
            conn.execute("DELETE FROM bti_sessions WHERE token=%s", (bti_session,))
    response.delete_cookie(COOKIE_NAME, path="/")


@app.get("/api/auth/me")
def me(bti_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    return {"user": current_user(bti_session)}


@app.post("/api/conversations")
def save_conversation(payload: ConversationPayload, bti_session: str | None = Cookie(default=None)) -> dict[str, int]:
    user = require_user(bti_session)
    with db() as conn:
        conversation = conn.execute(
            "INSERT INTO bti_conversations (user_id, duration_seconds) VALUES (%s, %s) RETURNING id",
            (user["id"], max(0, payload.duration_seconds)),
        ).fetchone()
        for message in payload.messages:
            if message.speaker in {"AI", "YOU"} and message.content.strip():
                conn.execute("INSERT INTO bti_messages (conversation_id, speaker, content) VALUES (%s, %s, %s)", (conversation[0], message.speaker, message.content.strip()))
    return {"id": conversation[0]}


@app.post("/api/conversations/{conversation_id}/messages")
def save_message(conversation_id: int, message: Message, bti_session: str | None = Cookie(default=None)) -> dict[str, bool]:
    user = require_user(bti_session)
    if message.speaker not in {"AI", "YOU"} or not message.content.strip():
        raise HTTPException(status_code=400, detail="Invalid message")
    with db() as conn:
        owns = conn.execute("SELECT 1 FROM bti_conversations WHERE id=%s AND user_id=%s", (conversation_id, user["id"])).fetchone()
        if not owns:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conn.execute("INSERT INTO bti_messages (conversation_id, speaker, content) VALUES (%s, %s, %s)", (conversation_id, message.speaker, message.content.strip()))
    return {"saved": True}


@app.post("/api/conversations/{conversation_id}/end")
def end_conversation(conversation_id: int, payload: EndPayload, bti_session: str | None = Cookie(default=None)) -> dict[str, bool]:
    user = require_user(bti_session)
    with db() as conn:
        updated = conn.execute(
            "UPDATE bti_conversations SET ended_at=NOW(), duration_seconds=%s WHERE id=%s AND user_id=%s",
            (max(0, payload.duration_seconds), conversation_id, user["id"]),
        )
        if updated.rowcount == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ended": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=int(os.environ.get("API_PORT", "8000")), reload=False)