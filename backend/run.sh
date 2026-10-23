#!/usr/bin/env bash
# Start the backend server, stopping whatever is already listening on its port first.
set -euo pipefail

cd "$(dirname "$0")"

# Use PORT from the environment, else from .env, else 8080.
if [ -z "${PORT:-}" ] && [ -f .env ]; then
  PORT=$(sed -n 's/^PORT=//p' .env | tail -n 1 | tr -d "\"' ")
fi
PORT="${PORT:-8080}"

pids=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)
if [ -n "$pids" ]; then
  echo "Stopping process(es) on port $PORT: $pids"
  kill $pids
  for _ in {1..20}; do
    lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null || break
    sleep 0.25
  done
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null; then
    echo "Process still running, forcing it to stop"
    kill -9 $(lsof -tiTCP:"$PORT" -sTCP:LISTEN)
  fi
fi

export PORT
exec go run ./cmd/server
