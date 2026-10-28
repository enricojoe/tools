#!/usr/bin/env bash
# Runs on the server, next to compose.prod.yml and .env:
#   deploy.sh <image>
# Pulls the image and recreates the app, failing if its health check doesn't pass.
# The server's deploy user must already be logged in to Docker Hub (docker login).
set -euo pipefail
cd "$(dirname "$0")"

image=$1

export TOOLS_IMAGE=$image
export COMPOSE_FILE=compose.prod.yml
docker compose pull
docker compose up -d --wait --wait-timeout 120 --force-recreate
docker image prune -f
