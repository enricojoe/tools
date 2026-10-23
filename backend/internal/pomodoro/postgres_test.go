package pomodoro

import (
	"os"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"

	"backend/internal/database"
)

// testDB connects to TEST_DATABASE_URL, applies the migrations and empties
// pomodoro_sessions. It skips the test when the variable isn't set. Point it
// at a throwaway database: the table is wiped.
func testDB(t *testing.T) *sqlx.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := sqlx.Connect("pgx", url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, "TRUNCATE pomodoro_sessions"); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return db
}

func TestPostgresRepository(t *testing.T) {
	repo := NewPostgresRepository(testDB(t))
	base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	at := func(h int) time.Time { return base.Add(time.Duration(h) * time.Hour) }

	// Inserted out of chronological order on purpose; "d" ties with "a".
	for _, s := range []Session{
		{ID: "c", Kind: Focus, DurationSeconds: 1500, Label: "Write report", CompletedAt: at(20)},
		{ID: "a", Kind: ShortBreak, DurationSeconds: 300, CompletedAt: at(10)},
		{ID: "b", Kind: LongBreak, DurationSeconds: 900, CompletedAt: at(5)},
		{ID: "d", Kind: Focus, DurationSeconds: 60, CompletedAt: at(10)},
	} {
		if err := repo.Add(ctx, s); err != nil {
			t.Fatalf("Add(%s): %v", s.ID, err)
		}
	}

	tests := []struct {
		name     string
		from, to time.Time
		want     string
	}{
		{"all, sorted ascending, ties by insertion", at(0), at(24), "badc"},
		{"from is inclusive", at(5), at(24), "badc"},
		{"to is exclusive", at(0), at(10), "b"},
		{"none", at(30), at(40), ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := repo.Between(ctx, tt.from, tt.to)
			if err != nil {
				t.Fatal(err)
			}
			if got == nil {
				t.Fatal("got nil, want non-nil slice")
			}
			ids := ""
			for _, s := range got {
				ids += s.ID
			}
			if ids != tt.want {
				t.Errorf("ids = %q, want %q", ids, tt.want)
			}
		})
	}

	got, _ := repo.Between(ctx, at(20), at(21))
	if len(got) != 1 {
		t.Fatalf("got %d sessions, want 1", len(got))
	}
	want := Session{ID: "c", Kind: Focus, DurationSeconds: 1500, Label: "Write report", CompletedAt: at(20)}
	if s := got[0]; s.ID != want.ID || s.Kind != want.Kind || s.DurationSeconds != want.DurationSeconds ||
		s.Label != want.Label || !s.CompletedAt.Equal(want.CompletedAt) {
		t.Errorf("round trip = %+v, want %+v", s, want)
	}
}

func TestPostgresRepositoryRejectsDuplicateID(t *testing.T) {
	repo := NewPostgresRepository(testDB(t))
	s := Session{ID: "x", Kind: Focus, DurationSeconds: 60, CompletedAt: time.Now()}
	if err := repo.Add(ctx, s); err != nil {
		t.Fatal(err)
	}
	if err := repo.Add(ctx, s); err == nil {
		t.Error("second Add with the same id: want error, got nil")
	}
}
