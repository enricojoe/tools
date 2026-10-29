# Deploy behind Traefik

Branch: `project/chore/traefik-deploy`

## Goal

The first release failed on the server (SSH host key, then a missing `.env`). The owner runs Traefik there, so the app should be reached through it instead of a published port, and the server compose file should have a name that doesn't clash with the local one.

## Decisions

- Rename `deploy/docker-compose.yml` to `deploy/compose.prod.yml`. `deploy.sh` sets `COMPOSE_FILE=compose.prod.yml`; the server's `.env` sets it too, so `docker compose ps|logs` works by hand.
- No published port. The app joins Traefik's external network and gets labels: router `tools` on `Host(TOOLS_DOMAIN)`, TLS with a cert resolver, service port 8080.
- The Traefik details weren't known yet, so they're `.env` settings with the usual defaults: `TOOLS_DOMAIN` (required), `TRAEFIK_NETWORK=traefik_web`, `TRAEFIK_ENTRYPOINT=websecure`, `TRAEFIK_CERTRESOLVER=letsencrypt`.
- `actions/checkout` v4 → v5 (the run warned that Node 20 is deprecated).

## Steps

- [x] Branch off `main`
- [x] `deploy/compose.prod.yml` with Traefik labels and network
- [x] `deploy.sh`, `release.yml` use the new name; checkout v5 in both workflows
- [x] `deploy/README.md` (.env, Traefik section), root README
- [x] Verify: local Traefik v3.6 + Postgres + the image through `compose.prod.yml`; actionlint, shellcheck

## Result

- With a local Traefik (docker provider, `websecure` on :443, a `letsencrypt` resolver) on a `traefik` network: the app became healthy with no host port, `https://tools.test/api/health` through Traefik returned `{"database":"ok","status":"ok"}`, `/tools/qr-code` returned 200, another host got 404. `COMPOSE_FILE` from `.env` picked the file and the shell's `TOOLS_IMAGE` overrode `.env`'s. A missing `TOOLS_DOMAIN` stops compose with a clear message.
- `actionlint` and `shellcheck` pass. The real Traefik names on the server still have to be filled into its `.env`.
- `container_name: tools` added at the owner's request (Compose would otherwise name it `tools-app-1`).
- The owner set the network default to `traefik_web` and added the external `db_network` (`DB_NETWORK`), because PostgreSQL runs in a container on the server; `DB_HOST` is that container's name.
