// Package stopwatch holds the session log behind the Stopwatch tool: the
// Session type and an in-memory store.
package stopwatch

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Session is one saved stopwatch run.
type Session struct {
	ID          string
	Label       string
	ElapsedMs   int
	Laps        []int
	CompletedAt time.Time
}

// Repository is the storage the handlers depend on, so a database can replace
// the in-memory Store later.
type Repository interface {
	// Add saves a session.
	Add(s Session)
	// List returns up to limit sessions, newest completedAt first.
	List(limit int) []Session
	// Delete removes the session with the given ID and reports whether it existed.
	Delete(id string) bool
}

// MaxSessions is how many sessions a Store keeps before dropping the oldest.
const MaxSessions = 1000

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
func (st *Store) Add(s Session) {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.sessions = append(st.sessions, s)
	if over := len(st.sessions) - st.max; over > 0 {
		// Copy so the dropped sessions can be garbage collected.
		st.sessions = append([]Session(nil), st.sessions[over:]...)
	}
}

// List returns up to limit sessions sorted by completion time, newest first
// (ties: most recently added first). The result is never nil.
func (st *Store) List(limit int) []Session {
	st.mu.RLock()
	out := make([]Session, 0, len(st.sessions))
	for i := len(st.sessions) - 1; i >= 0; i-- {
		out = append(out, st.sessions[i])
	}
	st.mu.RUnlock()

	sort.SliceStable(out, func(i, j int) bool { return out[i].CompletedAt.After(out[j].CompletedAt) })
	if limit >= 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

// Delete removes the session with the given ID and reports whether it existed.
func (st *Store) Delete(id string) bool {
	st.mu.Lock()
	defer st.mu.Unlock()
	for i, s := range st.sessions {
		if s.ID == id {
			st.sessions = append(st.sessions[:i:i], st.sessions[i+1:]...)
			return true
		}
	}
	return false
}
