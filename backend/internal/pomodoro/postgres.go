package pomodoro

import (
	"context"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"backend/internal/database"
)

// PostgresRepository is a Repository backed by the pomodoro_sessions table
// (migrations/00001_create_pomodoro_sessions.sql).
type PostgresRepository struct {
	db *sqlx.DB
}

// NewPostgresRepository returns a PostgresRepository using db.
func NewPostgresRepository(db *sqlx.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// Add inserts s.
func (r *PostgresRepository) Add(ctx context.Context, s Session) error {
	const q = `
		INSERT INTO pomodoro_sessions (id, kind, duration_seconds, label, completed_at)
		VALUES (:id, :kind, :duration_seconds, :label, :completed_at)`
	ctx, cancel := context.WithTimeout(ctx, database.QueryTimeout)
	defer cancel()
	if _, err := r.db.NamedExecContext(ctx, q, s); err != nil {
		return fmt.Errorf("insert pomodoro session: %w", err)
	}
	return nil
}

// Between returns the sessions completed in [from, to), oldest first (ties in
// insertion order). The result is never nil.
func (r *PostgresRepository) Between(ctx context.Context, from, to time.Time) ([]Session, error) {
	const q = `
		SELECT id, kind, duration_seconds, label, completed_at
		FROM pomodoro_sessions
		WHERE completed_at >= $1 AND completed_at < $2
		ORDER BY completed_at, created_at`
	ctx, cancel := context.WithTimeout(ctx, database.QueryTimeout)
	defer cancel()
	out := []Session{}
	if err := r.db.SelectContext(ctx, &out, q, from, to); err != nil {
		return nil, fmt.Errorf("list pomodoro sessions: %w", err)
	}
	return out, nil
}
