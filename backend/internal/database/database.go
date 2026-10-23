// Package database opens the PostgreSQL connection pool and applies the
// schema migrations.
package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
	"github.com/jmoiron/sqlx"
	"github.com/pressly/goose/v3"

	"backend/internal/config"
	"backend/migrations"
)

// QueryTimeout bounds a single query, so a database that stops answering
// fails the request instead of hanging it.
const QueryTimeout = 5 * time.Second

// Open connects to the database described by cfg and checks it with a ping.
func Open(ctx context.Context, cfg config.DB) (*sqlx.DB, error) {
	db, err := sqlx.Open("pgx", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(time.Hour)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("connect to %s:%d/%s: %w", cfg.Host, cfg.Port, cfg.Name, err)
	}
	return db, nil
}

// NewMigrator returns a goose provider for the embedded migrations. ok is
// false when there are no migration files yet.
func NewMigrator(db *sqlx.DB) (p *goose.Provider, ok bool, err error) {
	p, err = goose.NewProvider(goose.DialectPostgres, db.DB, migrations.FS)
	if errors.Is(err, goose.ErrNoMigrations) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("load migrations: %w", err)
	}
	return p, true, nil
}

// Migrate applies every pending migration and returns how many ran.
func Migrate(ctx context.Context, db *sqlx.DB) (int, error) {
	p, ok, err := NewMigrator(db)
	if err != nil || !ok {
		return 0, err
	}
	results, err := p.Up(ctx)
	if err != nil {
		return len(results), fmt.Errorf("apply migrations: %w", err)
	}
	return len(results), nil
}
