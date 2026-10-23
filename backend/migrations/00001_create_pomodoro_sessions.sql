-- +goose Up
CREATE TABLE pomodoro_sessions (
    id               TEXT PRIMARY KEY,
    kind             TEXT NOT NULL CHECK (kind IN ('focus', 'short_break', 'long_break')),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 1 AND 14400),
    label            TEXT NOT NULL DEFAULT '' CHECK (char_length(label) <= 100),
    completed_at     TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list endpoint reads one day at a time by completed_at.
CREATE INDEX pomodoro_sessions_completed_at_idx ON pomodoro_sessions (completed_at);

-- +goose Down
DROP TABLE pomodoro_sessions;
