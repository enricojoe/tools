# Database setup (PostgreSQL)

Branch: `backend/feature/database`

## Goal

Connect the backend to the owner's PostgreSQL server and give it a migration workflow. No feature moves to the database yet; that happens one feature at a time later.

## Decisions

- **Driver / queries:** `jackc/pgx/v5` (through its `database/sql` driver) + `jmoiron/sqlx`.
- **Migrations:** `pressly/goose/v3`. Every query that changes the schema is a SQL file in `backend/migrations/` (`NNNNN_name.sql`, `-- +goose Up` / `-- +goose Down`). The folder is embedded in the binary.
- **Config:** env vars, optionally loaded from `backend/.env` (gitignored) via `joho/godotenv`; real env vars win. `backend/.env.example` lists every var for the owner to fill in.
  - `PORT`, `DB_HOST`, `DB_PORT` (5432), `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` (`require`).
- **Startup:** the server loads config, connects (pings), applies pending migrations, then serves. It exits with a clear message if the database is missing or unreachable.
- **Manual control:** `go run ./cmd/migrate up|down|status|create <name>`.
- **Health:** `GET /api/health` also pings the database (`503` if it's down).

## Steps

- [x] Create the branch off `main`
- [x] `internal/config`: load `.env` + env vars, validate, build the DSN (password escaped), with tests
- [x] `internal/database`: open the pool (pool limits, ping with timeout) and run migrations
- [x] `migrations/`: embedded folder with a README on conventions (no tables yet)
- [x] `cmd/migrate`: up / down / status / create
- [x] `cmd/server`: wire config + DB, close the pool on shutdown
- [x] Health handler pings the DB, with tests
- [x] `backend/.env.example`
- [x] README: stack, structure, setup, API row, Progress
- [x] Verify: `go vet`, `go test ./...`, run the server and the migrate tool against a throwaway Postgres container

## Result

- `go vet ./...` and `go test ./...` pass (new tests: `internal/config`, `handler/health`).
- Checked against a throwaway `postgres:17-alpine` container: a missing config gives a clear error; an unreachable DB stops startup; `/api/health` returns 200 when the DB is up and 503 when it's paused; with no migrations the server starts and `migrate status` says "no migrations yet"; a test migration was created, applied at startup (`goose_db_version` + table present), `up` again said "already up to date", and `down` dropped it. The test migration and the container were removed afterwards.
- `migrations/` is empty apart from `README.md` and `migrations.go` (the embed). Tables arrive with each feature as it moves to the database.
