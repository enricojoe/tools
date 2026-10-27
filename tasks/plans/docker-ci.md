# Docker image + CI (GitHub Actions)

Branch: `project/chore/docker-ci`

## Goal

Build the whole app (backend + frontend) as one Docker image on GitHub's free runners, run the tests on every pull request, and publish the image when `main` changes or a version tag is pushed.

## Decisions

- **One image:** the Go server also serves the built frontend. A new optional `STATIC_DIR` setting points at the folder; when it's set, files are served from it and any non-`/api` path falls back to `index.html` (client-side routes). Unknown `/api` paths stay a JSON 404. Unset (local dev) = API only, as today.
- **Registry:** Docker Hub only (owner's call, after first choosing GHCR): `docker.io/<DOCKERHUB_USERNAME>/tools`, with the repo variable `DOCKERHUB_USERNAME` and secret `DOCKERHUB_TOKEN`.
- **Triggers** (owner's call, two workflows):
  - `ci.yml`, pull request to `main`: backend tests + frontend lint and build. No image.
  - `release.yml`, tag `v*` (e.g. `v1.2.3`): image build + push as `1.2.3`, `1.2`, `latest`. No tests (they ran on the PR).
  - Push to `main`: nothing runs.
- **Deploy** (in `release.yml`, after the image job): SSH with a dedicated key and a pinned `known_hosts` (secrets in a `production` environment), copy `deploy/docker-compose.yml` + `deploy/deploy.sh`, then `deploy.sh` pulls the released version and runs `docker compose up -d --wait --force-recreate` (fails on an unhealthy app), then prunes images. The server is already logged in to Docker Hub (owner's call), so no token is sent to it. The database stays on the owner's existing PostgreSQL server; the server's `.env` holds its settings.
- **Platform:** `linux/amd64` only.
- **Image:** multi-stage: `node:24-alpine` builds the frontend, `golang:1.26-alpine` builds static binaries (`CGO_ENABLED=0`, server + migrate), final `alpine` with `tzdata` and `ca-certificates`, non-root user. `TZ` defaults to `Asia/Jakarta` (the app's "today" and alarm clock use the server zone); override at run time.
- **Secrets:** DB settings are passed at run time only; `.env` is excluded by `.dockerignore`.

## Steps

- [x] Create the branch off `main`
- [x] `config`: optional `STATIC_DIR`, with a test
- [x] `router`: serve `STATIC_DIR` with an `index.html` fallback (API 404s stay JSON), with tests
- [x] `Dockerfile` + `.dockerignore` at the repo root
- [x] `.github/workflows/ci.yml` (PR: backend tests with a Postgres service, frontend lint + build) and `release.yml` (tag: Docker build/push)
- [x] `docker-compose.yml` for running the image + Postgres locally
- [x] README: stack, structure, setup (Docker + CI + releases), Progress; `.env.example`
- [x] Deploy job + `deploy/` (compose file, script, setup README)
- [x] Verify: `go vet`, `go test ./...` (with DB), frontend build, `docker build`, run the image against Postgres (health, a page route, an API 404), validate the workflow YAML

## Result

- `go vet ./...` and `go test ./...` pass, including the database tests against a throwaway `postgres:17-alpine` (new: `internal/router` tests for frontend serving, cache headers, API 404s, and no files served from outside the folder; a `STATIC_DIR` default check in `config`).
- Frontend `npm run lint` and `npm run build` pass.
- `docker build` works (image is 46.6 MB). With `docker compose up`: the container becomes healthy, runs as a non-root user, `/api/health` gives 200 with the database ok, `/api/time` reports `Asia/Jakarta`, `/` and `/tools/qr-code` serve the app (`no-cache`), hashed assets get `immutable`, `/api/nope` gives a JSON 404, a Pomodoro session saves, and `/app/migrate status` lists the migration as applied. The stack and its volume were removed afterwards.
- The workflow was then split as the owner asked: PRs only test, tags only build and push. `npm run build` went back into the frontend job, because PRs no longer build the image.
- Deploy: `actionlint` and `shellcheck` pass. The production compose file was run locally with `--wait` against a Postgres container: healthy with good settings (exit 0, `/api/health` ok), and exit 1 with a wrong DB password, so a bad deploy fails the job. The SSH step and the server's Docker Hub pull can only be checked on the first real tag.
- `actionlint` reports no problems in the workflow. It hasn't run on GitHub yet; the first pull request will be its first real run.
