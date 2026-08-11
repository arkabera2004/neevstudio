# syntax=docker/dockerfile:1

# ============================================================
# Veritrace — combined production image
#   • Frontend: TanStack Start SSR (Nitro Node server) on :3000 (internal)
#   • Backend:  FastAPI (uvicorn) on :8000 (internal)
#   • nginx reverse proxy on $PORT: /api/* → backend, everything else → frontend
# The browser therefore talks to a SINGLE origin (no CORS, no cross-URL wiring).
# Works on Render (one Docker web service) or any Docker host.
# ============================================================

# ---- Stage 1: build the frontend into a self-contained Node server ----
# Node 24: its ESM loader correctly reads named exports from CommonJS deps that
# Nitro relies on (e.g. `nodeFileTrace` from @vercel/nft). Node 22 fails there.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_URL is intentionally left empty → the frontend calls same-origin "/api".
COPY . .
RUN npm run build   # → /app/.output (self-contained Node server)

# ---- Stage 2: runtime with Node (frontend) + Python (backend) + nginx ----
# Debian-based node image so Python wheels (pydantic-core, uvloop, …) install cleanly.
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# System deps: Python + venv, nginx, and gettext-base (envsubst for the nginx template).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv nginx gettext-base curl \
 && rm -rf /var/lib/apt/lists/* \
 && rm -f /etc/nginx/sites-enabled/default

# Python backend dependencies (cached on requirements.txt).
COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m venv /opt/venv \
 && pip install --no-cache-dir -r backend/requirements.txt

# Backend source (backend/.env is excluded via .dockerignore — key comes from runtime env).
COPY backend ./backend

# Frontend build output from stage 1.
COPY --from=build /app/.output ./.output

# Reverse-proxy config template + process launcher.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# nginx binds Render's injected $PORT (default 10000 if run standalone).
ENV PORT=10000
EXPOSE 10000

CMD ["/app/start.sh"]
