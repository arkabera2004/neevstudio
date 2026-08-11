#!/bin/bash
# Launch backend + frontend on fixed internal ports, then nginx on the public $PORT.
# If any of the three processes exits, stop the container so the platform restarts it.
# Uses `wait -n` (bash) — bash ships in the Debian-slim runtime image.
set -eu

echo "[start] launching Veritrace combined service on port ${PORT:-10000}"

# Frontend (Nitro SSR) on a fixed internal port (do NOT use $PORT — that's nginx's).
PORT=3000 node /app/.output/server/index.mjs &
NODE_PID=$!

# Backend (FastAPI) on a fixed internal port.
uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir /app/backend &
UVICORN_PID=$!

# Render the nginx config with the public port and start it in the foreground.
export PORT="${PORT:-10000}"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;' &
NGINX_PID=$!

# Exit (and let the platform restart) as soon as any process dies.
wait -n "$NODE_PID" "$UVICORN_PID" "$NGINX_PID"
echo "[start] a process exited — shutting down container"
kill "$NODE_PID" "$UVICORN_PID" "$NGINX_PID" 2>/dev/null || true
exit 1
