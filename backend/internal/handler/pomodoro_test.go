package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/pomodoro"
)

// 2026-03-10 20:00 UTC is already 2026-03-11 03:00 in Jakarta (UTC+7).
var pomodoroNow = time.Date(2026, 3, 10, 20, 0, 0, 0, time.UTC)

func pomodoroRouter(t *testing.T) *gin.Engine {
	t.Helper()
	old := time.Local
	time.Local = time.FixedZone("Asia/Jakarta", 7*3600)
	t.Cleanup(func() { time.Local = old })

	gin.SetMode(gin.TestMode)
	store := pomodoro.NewStore()
	now := func() time.Time { return pomodoroNow }
	r := gin.New()
	r.POST("/api/pomodoro/sessions", CreatePomodoroSession(store, now))
	r.GET("/api/pomodoro/sessions", ListPomodoroSessions(store, now))
	return r
}

func postSession(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/pomodoro/sessions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type listBody struct {
	Date     string `json:"date"`
	Sessions []struct {
		ID              string `json:"id"`
		Kind            string `json:"kind"`
		DurationSeconds int    `json:"durationSeconds"`
		Label           string `json:"label"`
		CompletedAt     string `json:"completedAt"`
	} `json:"sessions"`
	FocusCount   int    `json:"focusCount"`
	FocusSeconds int    `json:"focusSeconds"`
	Error        string `json:"error"`
}

func getSessions(t *testing.T, r *gin.Engine, query string) (*httptest.ResponseRecorder, listBody) {
	t.Helper()
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/pomodoro/sessions"+query, nil))
	var got listBody
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode %q: %v", w.Body, err)
	}
	return w, got
}

func TestCreatePomodoroSession(t *testing.T) {
	tests := []struct {
		name      string
		body      string
		wantCode  int
		wantLabel string
		wantAt    string // expected completedAt in Jakarta time
		wantError string
	}{
		{"defaults completedAt to now", `{"kind":"focus","durationSeconds":1500}`, http.StatusCreated, "", "2026-03-11T03:00:00+07:00", ""},
		{"label is trimmed", `{"kind":"short_break","durationSeconds":300,"label":"  stretch  "}`, http.StatusCreated, "stretch", "2026-03-11T03:00:00+07:00", ""},
		{"completedAt converted to server zone", `{"kind":"long_break","durationSeconds":900,"completedAt":"2026-03-10T10:00:00Z"}`, http.StatusCreated, "", "2026-03-10T17:00:00+07:00", ""},
		{"min duration", `{"kind":"focus","durationSeconds":1}`, http.StatusCreated, "", "2026-03-11T03:00:00+07:00", ""},
		{"max duration", `{"kind":"focus","durationSeconds":14400}`, http.StatusCreated, "", "2026-03-11T03:00:00+07:00", ""},
		{"100 characters label", `{"kind":"focus","durationSeconds":60,"label":"` + strings.Repeat("é", 100) + `"}`, http.StatusCreated, strings.Repeat("é", 100), "2026-03-11T03:00:00+07:00", ""},
		{"within future tolerance", `{"kind":"focus","durationSeconds":60,"completedAt":"2026-03-10T20:01:00Z"}`, http.StatusCreated, "", "2026-03-11T03:01:00+07:00", ""},
		{"bad kind", `{"kind":"nap","durationSeconds":60}`, http.StatusBadRequest, "", "", "kind must be one of focus, short_break, long_break"},
		{"missing kind", `{"durationSeconds":60}`, http.StatusBadRequest, "", "", "kind must be one of focus, short_break, long_break"},
		{"zero duration", `{"kind":"focus","durationSeconds":0}`, http.StatusBadRequest, "", "", "durationSeconds must be between 1 and 14400"},
		{"missing duration", `{"kind":"focus"}`, http.StatusBadRequest, "", "", "durationSeconds must be between 1 and 14400"},
		{"negative duration", `{"kind":"focus","durationSeconds":-5}`, http.StatusBadRequest, "", "", "durationSeconds must be between 1 and 14400"},
		{"duration too large", `{"kind":"focus","durationSeconds":14401}`, http.StatusBadRequest, "", "", "durationSeconds must be between 1 and 14400"},
		{"label too long", `{"kind":"focus","durationSeconds":60,"label":"` + strings.Repeat("a", 101) + `"}`, http.StatusBadRequest, "", "", "label must be at most 100 characters"},
		{"unparseable completedAt", `{"kind":"focus","durationSeconds":60,"completedAt":"yesterday"}`, http.StatusBadRequest, "", "", "completedAt must be an RFC3339 timestamp"},
		{"completedAt in the future", `{"kind":"focus","durationSeconds":60,"completedAt":"2026-03-10T20:01:01Z"}`, http.StatusBadRequest, "", "", "completedAt must not be in the future"},
		{"invalid JSON", `{`, http.StatusBadRequest, "", "", "invalid JSON body"},
		{"wrong type", `{"kind":"focus","durationSeconds":"60"}`, http.StatusBadRequest, "", "", "invalid JSON body"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := postSession(pomodoroRouter(t), tt.body)
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantCode, w.Body)
			}
			var got struct {
				sessionResponse
				Error string `json:"error"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.Error != tt.wantError {
				t.Errorf("error = %q, want %q", got.Error, tt.wantError)
			}
			if tt.wantCode != http.StatusCreated {
				return
			}
			if len(got.ID) != 32 {
				t.Errorf("id = %q, want 32 hex chars", got.ID)
			}
			if got.Label != tt.wantLabel {
				t.Errorf("label = %q, want %q", got.Label, tt.wantLabel)
			}
			if got.CompletedAt != tt.wantAt {
				t.Errorf("completedAt = %q, want %q", got.CompletedAt, tt.wantAt)
			}
		})
	}
}

func TestListPomodoroSessions(t *testing.T) {
	// Jakarta day boundaries: 2026-03-10 runs from 2026-03-09T17:00Z to
	// 2026-03-10T17:00Z.
	seed := []string{
		`{"kind":"focus","durationSeconds":1500,"completedAt":"2026-03-10T16:59:59Z"}`,      // 03-10 23:59:59 Jakarta
		`{"kind":"focus","durationSeconds":1500,"completedAt":"2026-03-10T17:00:00Z"}`,      // 03-11 00:00:00 Jakarta
		`{"kind":"short_break","durationSeconds":300,"completedAt":"2026-03-10T18:00:00Z"}`, // 03-11 01:00 Jakarta
		`{"kind":"focus","durationSeconds":600,"completedAt":"2026-03-10T17:30:00Z"}`,       // 03-11 00:30 Jakarta (out of order)
		`{"kind":"focus","durationSeconds":900,"completedAt":"2026-03-09T16:59:59Z"}`,       // 03-09 23:59:59 Jakarta
		`{"kind":"focus","durationSeconds":900,"completedAt":"2026-03-09T17:00:00Z"}`,       // 03-10 00:00:00 Jakarta
	}

	tests := []struct {
		name      string
		query     string
		wantCode  int
		wantDate  string
		wantKinds []string
		wantCount int
		wantSecs  int
		wantError string
	}{
		{"default date is today in server zone", "", http.StatusOK, "2026-03-11", []string{"focus", "focus", "short_break"}, 2, 2100, ""},
		{"explicit date, start boundary", "?date=2026-03-10", http.StatusOK, "2026-03-10", []string{"focus", "focus"}, 2, 2400, ""},
		{"previous date", "?date=2026-03-09", http.StatusOK, "2026-03-09", []string{"focus"}, 1, 900, ""},
		{"day without sessions", "?date=2026-01-01", http.StatusOK, "2026-01-01", nil, 0, 0, ""},
		{"not a date", "?date=tomorrow", http.StatusBadRequest, "", nil, 0, 0, "date must be in YYYY-MM-DD format"},
		{"empty date", "?date=", http.StatusBadRequest, "", nil, 0, 0, "date must be in YYYY-MM-DD format"},
		{"impossible date", "?date=2026-02-30", http.StatusBadRequest, "", nil, 0, 0, "date must be in YYYY-MM-DD format"},
		{"wrong layout", "?date=10-03-2026", http.StatusBadRequest, "", nil, 0, 0, "date must be in YYYY-MM-DD format"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := pomodoroRouter(t)
			for _, body := range seed {
				if w := postSession(r, body); w.Code != http.StatusCreated {
					t.Fatalf("seed %s: status %d (%s)", body, w.Code, w.Body)
				}
			}

			w, got := getSessions(t, r, tt.query)
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantCode, w.Body)
			}
			if got.Error != tt.wantError {
				t.Errorf("error = %q, want %q", got.Error, tt.wantError)
			}
			if tt.wantCode != http.StatusOK {
				return
			}
			if cc := w.Header().Get("Cache-Control"); cc != "no-store" {
				t.Errorf("Cache-Control = %q, want no-store", cc)
			}
			if got.Date != tt.wantDate {
				t.Errorf("date = %q, want %q", got.Date, tt.wantDate)
			}
			if len(got.Sessions) != len(tt.wantKinds) {
				t.Fatalf("got %d sessions, want %d (%s)", len(got.Sessions), len(tt.wantKinds), w.Body)
			}
			for i, s := range got.Sessions {
				if s.Kind != tt.wantKinds[i] {
					t.Errorf("sessions[%d].kind = %q, want %q", i, s.Kind, tt.wantKinds[i])
				}
				if i > 0 && s.CompletedAt < got.Sessions[i-1].CompletedAt {
					t.Errorf("sessions not ascending: %q before %q", got.Sessions[i-1].CompletedAt, s.CompletedAt)
				}
			}
			if got.FocusCount != tt.wantCount || got.FocusSeconds != tt.wantSecs {
				t.Errorf("focus = %d/%ds, want %d/%ds", got.FocusCount, got.FocusSeconds, tt.wantCount, tt.wantSecs)
			}
		})
	}
}

func TestListPomodoroSessionsEmptyIsArray(t *testing.T) {
	r := pomodoroRouter(t)
	w, _ := getSessions(t, r, "")
	if !strings.Contains(w.Body.String(), `"sessions":[]`) {
		t.Errorf("body = %s, want sessions to be []", w.Body)
	}
}

func TestPomodoroFocusTotalsIgnoreBreaks(t *testing.T) {
	r := pomodoroRouter(t)
	for _, body := range []string{
		`{"kind":"short_break","durationSeconds":300}`,
		`{"kind":"long_break","durationSeconds":900}`,
		`{"kind":"focus","durationSeconds":1500}`,
	} {
		postSession(r, body)
	}
	_, got := getSessions(t, r, "")
	if len(got.Sessions) != 3 || got.FocusCount != 1 || got.FocusSeconds != 1500 {
		t.Errorf("got %d sessions, focus %d/%ds; want 3 sessions, focus 1/1500s", len(got.Sessions), got.FocusCount, got.FocusSeconds)
	}
}

// failingRepo is a pomodoro.Repository whose database is down.
type failingRepo struct{}

func (failingRepo) Add(context.Context, pomodoro.Session) error { return errors.New("db down") }
func (failingRepo) Between(context.Context, time.Time, time.Time) ([]pomodoro.Session, error) {
	return nil, errors.New("db down")
}

func TestPomodoroRepositoryErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := func() time.Time { return pomodoroNow }
	r := gin.New()
	r.POST("/api/pomodoro/sessions", CreatePomodoroSession(failingRepo{}, now))
	r.GET("/api/pomodoro/sessions", ListPomodoroSessions(failingRepo{}, now))

	if w := postSession(r, `{"kind":"focus","durationSeconds":1500}`); w.Code != http.StatusInternalServerError ||
		w.Body.String() != `{"error":"could not save session"}` {
		t.Errorf("POST = %d %s, want 500 could not save session", w.Code, w.Body)
	}
	if w, got := getSessions(t, r, ""); w.Code != http.StatusInternalServerError || got.Error != "could not load sessions" {
		t.Errorf("GET = %d %s, want 500 could not load sessions", w.Code, w.Body)
	}
}
