# Pomodoro sessions in PostgreSQL

Branch: `backend/feature/pomodoro-db` (off `backend/feature/database`, which isn't merged into `main` yet)

## Goal

Save Pomodoro sessions in the database instead of server memory, so they survive restarts. The API contract stays the same, except a database failure now returns `500`.

## Steps

- [x] Migration `00001_create_pomodoro_sessions.sql`: table with CHECK constraints matching the API validation, index on `completed_at`
- [x] `pomodoro.Repository` takes a context and returns errors; update the in-memory `Store` (kept for handler tests) and its tests
- [x] `pomodoro.PostgresRepository` (sqlx): `Add` = one INSERT, `Between` = one range SELECT ordered by `completed_at`
- [x] Handlers return `500 {"error": ...}` when the repository fails, with tests
- [x] Router uses `PostgresRepository`
- [x] Integration test for `PostgresRepository`, run only when `TEST_DATABASE_URL` is set
- [x] README: Pomodoro tool text, API row, structure, Progress, how to run the DB tests
- [x] Verify: vet, tests (`-race`), integration tests against a throwaway container, migration up/down, then apply to the real DB
- [x] (added) Per-query timeout (`database.QueryTimeout`, 5 s): a database that stops answering hung requests indefinitely

## Result

- Migration `00001_create_pomodoro_sessions.sql`; `PostgresRepository` with one INSERT and one indexed range SELECT; the router uses it. The in-memory `Store` remains for handler tests.
- `go vet` and `go test -race ./...` pass. With `TEST_DATABASE_URL` pointed at a throwaway `postgres:17-alpine` container, the repository tests pass (ordering, range bounds, round trip, duplicate id).
- Against the container: migration down/up round trip, CHECK constraints reject a bad kind, a session posted through the API survives a server restart, and with the DB paused both endpoints return `500` after 5 s and recover once it's back.
- Applied the migration to the real database (`migrate up`); `GET /api/pomodoro/sessions` returns `200` with an empty list. No test data was written there.
