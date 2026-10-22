package pomodoro

import (
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestKindValid(t *testing.T) {
	tests := []struct {
		kind Kind
		want bool
	}{
		{Focus, true},
		{ShortBreak, true},
		{LongBreak, true},
		{"", false},
		{"nap", false},
		{"Focus", false},
	}
	for _, tt := range tests {
		t.Run(string(tt.kind), func(t *testing.T) {
			if got := tt.kind.Valid(); got != tt.want {
				t.Errorf("Valid() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNewID(t *testing.T) {
	a, err := NewID()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := NewID()
	if len(a) != 32 || a == b {
		t.Errorf("ids %q and %q: want distinct 32-char hex", a, b)
	}
}

func TestStoreBetween(t *testing.T) {
	base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	at := func(h int) time.Time { return base.Add(time.Duration(h) * time.Hour) }

	tests := []struct {
		name     string
		from, to time.Time
		want     []string
	}{
		{"all, sorted ascending", at(0), at(24), []string{"b", "a", "c"}},
		{"from is inclusive", at(5), at(24), []string{"b", "a", "c"}},
		{"to is exclusive", at(0), at(10), []string{"b"}},
		{"none is empty, not nil", at(30), at(40), []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			st := NewStore()
			// Inserted out of chronological order on purpose.
			st.Add(Session{ID: "c", CompletedAt: at(20)})
			st.Add(Session{ID: "a", CompletedAt: at(10)})
			st.Add(Session{ID: "b", CompletedAt: at(5)})

			got := st.Between(tt.from, tt.to)
			if got == nil {
				t.Fatal("got nil, want non-nil slice")
			}
			ids := []string{}
			for _, s := range got {
				ids = append(ids, s.ID)
			}
			if !reflect.DeepEqual(ids, tt.want) {
				t.Errorf("ids = %v, want %v", ids, tt.want)
			}
		})
	}
}

func TestStoreCap(t *testing.T) {
	st := &Store{max: 3}
	base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 5; i++ {
		st.Add(Session{ID: string(rune('a' + i)), CompletedAt: base.Add(time.Duration(i) * time.Minute)})
	}
	got := st.Between(base, base.Add(time.Hour))
	if len(got) != 3 || got[0].ID != "c" || got[2].ID != "e" {
		t.Errorf("got %+v, want the newest three (c, d, e)", got)
	}
}

func TestStoreConcurrent(t *testing.T) {
	st := NewStore()
	now := time.Now()
	from, to := now.Add(-time.Hour), now.Add(time.Hour)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); st.Add(Session{CompletedAt: now}) }()
		go func() { defer wg.Done(); st.Between(from, to) }()
	}
	wg.Wait()
	if n := len(st.Between(from, to)); n != 50 {
		t.Errorf("stored %d sessions, want 50", n)
	}
}
