# Migrations

Every query that changes the database schema (tables, columns, indexes, constraints, seed data) lives here as a [goose](https://github.com/pressly/goose) SQL file. Never change the schema by hand.

## Files

- Named `NNNNN_short_name.sql` (sequential, e.g. `00001_create_pomodoro_sessions.sql`). Make them with `go run ./cmd/migrate create <short_name>`.
- Each file has an `Up` section and a `Down` section that undoes it:

  ```sql
  -- +goose Up
  CREATE TABLE example (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- +goose Down
  DROP TABLE example;
  ```

- Never edit a migration that has already been applied anywhere. Add a new one instead.

## Running

The server applies pending migrations when it starts. To run them by hand (from `backend/`):

```bash
go run ./cmd/migrate status   # applied and pending migrations
go run ./cmd/migrate up       # apply all pending
go run ./cmd/migrate down     # roll back the latest one
```

Applied versions are tracked in the `goose_db_version` table.
