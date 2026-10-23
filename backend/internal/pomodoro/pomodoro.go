// Package pomodoro holds the session log behind the Pomodoro tool: the Session
// type, kind validation, and PostgreSQL and in-memory stores.
package pomodoro

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Kind is the type of a finished Pomodoro interval.
type Kind string

// The supported interval kinds.
const (
	Focus      Kind = "focus"
	ShortBreak Kind = "short_break"
	LongBreak  Kind = "long_break"
)

// Valid reports whether k is one of the supported kinds.
func (k Kind) Valid() bool {
	switch k {
	case Focus, ShortBreak, LongBreak:
		return true
	}
	return false
}

// Session is one finished interval.
type Session struct {
	ID              string    `db:"id"`
	Kind            Kind      `db:"kind"`
	DurationSeconds int       `db:"duration_seconds"`
	Label           string    `db:"label"`
	CompletedAt     time.Time `db:"completed_at"`
}

// Repository is the storage the handlers depend on: PostgresRepository in the
// server, Store in tests.
type Repository interface {
	// Add saves a session.
	Add(ctx context.Context, s Session) error
	// Between returns the sessions completed in [from, to), oldest first.
	// The result is never nil.
	Between(ctx context.Context, from, to time.Time) ([]Session, error)
}

// MaxSessions is how many sessions a Store keeps before dropping the oldest.
const MaxSessions = 10000

// NewID returns a random 128-bit hex ID.
func NewID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// Store is a thread-safe in-memory Repository that keeps the newest
// MaxSessions sessions (by insertion order).
type Store struct {
	mu       sync.RWMutex
	max      int
	sessions []Session
}

// NewStore returns an empty Store capped at MaxSessions.
func NewStore() *Store {
	return &Store{max: MaxSessions}
}

// Add saves s, dropping the oldest session when the cap is exceeded.
func (st *Store) Add(_ context.Context, s Session) error {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.sessions = append(st.sessions, s)
	if over := len(st.sessions) - st.max; over > 0 {
		// Copy so the dropped sessions can be garbage collected.
		st.sessions = append([]Session(nil), st.sessions[over:]...)
	}
	return nil
}

// Between returns the sessions completed in [from, to), sorted by completion
// time ascending. The result is never nil.
func (st *Store) Between(_ context.Context, from, to time.Time) ([]Session, error) {
	st.mu.RLock()
	out := []Session{}
	for _, s := range st.sessions {
		if !s.CompletedAt.Before(from) && s.CompletedAt.Before(to) {
			out = append(out, s)
		}
	}
	st.mu.RUnlock()

	sort.SliceStable(out, func(i, j int) bool { return out[i].CompletedAt.Before(out[j].CompletedAt) })
	return out, nil
}
