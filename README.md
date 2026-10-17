# Beyond Tech Intelligence — AI Receptionist

A browser-first Hinglish AI receptionist built with React/Vite, FastAPI, Pipecat WebRTC, Groq, Cartesia, and PostgreSQL.

## What was fixed

- Removed the render-blocking Google Fonts `@import`; the UI now uses fast system font stacks.
- Public landing pages no longer wait for `/api/auth/me`.
- API calls now support a separate Render API service through `VITE_API_URL`.
- Voice calls now support a separate Pipecat service through `VITE_PIPECAT_URL`.
- WebRTC startup begins immediately instead of waiting for a database conversation insert.
- Added pending-message handling so early transcript messages are persisted after the conversation row is ready.
- Added keyboard focus states, content-visibility hints, and subtle card interaction polish.
- Added JSON-LD Organization, WebApplication, and FAQ structured data.
- Added `robots.txt`, `sitemap.xml`, `llms.txt`, and `aeo-geo.md` for SEO, AEO, and GEO.
- Removed the checked-in backend secret file; use the environment templates instead.

## Local run

### API

```bash
cd backend
cp .env.example .env
# Fill DATABASE_URL in .env
python -m pip install -r requirements-web.txt
uvicorn api:app --reload --port 8000
```

### Pipecat voice service

```bash
cd backend
# Install the project dependencies from pyproject.toml/uv.lock.
uv sync
# Add GROQ_API_KEY_1 and CARTESIA_API_KEY_1 to backend/.env
uv run bot1.py -t webrtc
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8000` and voice endpoints to `http://localhost:7860` in development. The production build uses the two `VITE_*` URLs.

## Free Render hosting

The included [`render.yaml`](render.yaml) creates three Render services:

1. **bti-receptionist** — free Static Site for the Vite frontend.
2. **bti-api** — free Docker Web Service for FastAPI and auth/PostgreSQL access.
3. **bti-voice** — free Docker Web Service for the Pipecat WebRTC bot.

### Steps

1. Push this folder to a GitHub repository. Do not commit `.env` files or API keys.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml`. Set the three secret values when prompted:
   - `bti-api`: `DATABASE_URL`
   - `bti-voice`: `GROQ_API_KEY_1`
   - `bti-voice`: `CARTESIA_API_KEY_1`
4. Create a free PostgreSQL database on Neon, Supabase, or another PostgreSQL provider and paste its pooled `DATABASE_URL` into `bti-api`.
5. Deploy all three services. The frontend build uses:
   ```bash
   npm ci && npm run build
   ```
6. If you choose different service names or custom domains, update these Render variables on the frontend and redeploy:
   - `VITE_API_URL=https://YOUR-API.onrender.com`
   - `VITE_PIPECAT_URL=https://YOUR-VOICE.onrender.com`
   - `VITE_SITE_URL=https://YOUR-FRONTEND.onrender.com`
7. Update `CORS_ORIGINS` on `bti-api` to exactly match the frontend origin, without a trailing slash.
8. Replace `bti-receptionist.onrender.com` in `frontend/public/sitemap.xml`, `frontend/public/robots.txt`, `frontend/public/llms.txt`, `frontend/public/aeo-geo.md`, and the JSON-LD in `frontend/index.html` when using a custom domain.

### Exact Dockerfiles

- API: [`backend/Dockerfile`](backend/Dockerfile)
- Voice: [`backend/Dockerfile.bot`](backend/Dockerfile.bot)

The API container listens on Render's `$PORT` and defaults to `10000`. The voice container runs the Pipecat command `python bot1.py -t webrtc` and defaults to port `7860`.

### Free-tier caveat

Render free Web Services sleep after inactivity, so the first request after idle can take 30–60 seconds. The static frontend remains fast. The first voice connection can still be slow when `bti-voice` wakes; this is a Render free-tier limitation, not a frontend loading bug. A paid always-on service removes that cold start.

## Environment files

- [`backend/.env.example`](backend/.env.example) — API/database settings.
- [`frontend/.env.example`](frontend/.env.example) — frontend API, voice, and site URLs.

Never copy the old local `backend/.env` into GitHub or Render; credentials belong only in Render's Environment settings.
