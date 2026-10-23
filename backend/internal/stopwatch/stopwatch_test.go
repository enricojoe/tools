package stopwatch

import (
	"reflect"
	"strconv"
	"sync"
	"testing"
	"time"
)

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

func ids(ss []Session) []string {
	out := []string{}
	for _, s := range ss {
		out = append(out, s.ID)
	}
	return out
}

func TestStoreList(t *testing.T) {
	base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	at := func(h int) time.Time { return base.Add(time.Duration(h) * time.Hour) }

	tests := []struct {
		name  string
		limit int
		want  []string
	}{
		{"newest first", 10, []string{"c", "d", "a", "b"}},
		{"limit truncates", 2, []string{"c", "d"}},
		{"limit zero is empty", 0, []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			st := NewStore()
			// Inserted out of chronological order; a and d tie at 10h and the
			// later insertion (d) comes first.
			st.Add(Session{ID: "a", CompletedAt: at(10)})
			st.Add(Session{ID: "b", CompletedAt: at(5)})
			st.Add(Session{ID: "c", CompletedAt: at(20)})
			st.Add(Session{ID: "d", CompletedAt: at(10)})
			got := st.List(tt.limit)
			if got == nil {
				t.Fatal("got nil, want non-nil slice")
			}
			if !reflect.DeepEqual(ids(got), tt.want) {
				t.Errorf("ids = %v, want %v", ids(got), tt.want)
			}
		})
	}

	t.Run("empty store is empty, not nil", func(t *testing.T) {
		if got := NewStore().List(5); got == nil || len(got) != 0 {
			t.Errorf("got %v, want empty non-nil slice", got)
		}
	})
}

func TestStoreCap(t *testing.T) {
	st := &Store{max: 3}
	base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 5; i++ {
		st.Add(Session{ID: string(rune('a' + i)), CompletedAt: base.Add(time.Duration(i) * time.Minute)})
	}
	if got := ids(st.List(10)); !reflect.DeepEqual(got, []string{"e", "d", "c"}) {
		t.Errorf("got %v, want the newest three (e, d, c)", got)
	}
}

func TestStoreDelete(t *testing.T) {
	tests := []struct {
		name string
		id   string
		want bool
		left []string
	}{
		{"existing", "b", true, []string{"c", "a"}},
		{"missing", "zzz", false, []string{"c", "b", "a"}},
		{"empty id", "", false, []string{"c", "b", "a"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			st := NewStore()
			base := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
			for i, id := range []string{"a", "b", "c"} {
				st.Add(Session{ID: id, CompletedAt: base.Add(time.Duration(i) * time.Minute)})
			}
			if got := st.Delete(tt.id); got != tt.want {
				t.Errorf("Delete = %v, want %v", got, tt.want)
			}
			if got := ids(st.List(10)); !reflect.DeepEqual(got, tt.left) {
				t.Errorf("remaining = %v, want %v", got, tt.left)
			}
		})
	}
}

func TestStoreConcurrent(t *testing.T) {
	st := NewStore()
	now := time.Now()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		id := strconv.Itoa(i)
		wg.Add(3)
		go func() { defer wg.Done(); st.Add(Session{ID: id, CompletedAt: now}) }()
		go func() { defer wg.Done(); st.List(10) }()
		go func() { defer wg.Done(); st.Delete(id) }()
	}
	wg.Wait()
}
