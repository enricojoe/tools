package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/stopwatch"
)

var stopwatchNow = time.Date(2026, 3, 10, 20, 0, 0, 0, time.UTC)

func stopwatchRouter(t *testing.T) *gin.Engine {
	t.Helper()
	old := time.Local
	time.Local = time.FixedZone("Asia/Jakarta", 7*3600)
	t.Cleanup(func() { time.Local = old })

	gin.SetMode(gin.TestMode)
	store := stopwatch.NewStore()
	now := func() time.Time { return stopwatchNow }
	r := gin.New()
	r.POST("/api/stopwatch/sessions", CreateStopwatchSession(store, now))
	r.GET("/api/stopwatch/sessions", ListStopwatchSessions(store))
	r.DELETE("/api/stopwatch/sessions/:id", DeleteStopwatchSession(store))
	return r
}

type stopwatchBody struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	ElapsedMs   int    `json:"elapsedMs"`
	Laps        []int  `json:"laps"`
	CompletedAt string `json:"completedAt"`
	Error       string `json:"error"`
}

func stopwatchDo(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// onesJSON returns a JSON array of n laps of 1 ms each.
func onesJSON(n int) string {
	return "[" + strings.TrimSuffix(strings.Repeat("1,", n), ",") + "]"
}

func TestCreateStopwatchSession(t *testing.T) {
	const jakartaNow = "2026-03-11T03:00:00+07:00"
	tests := []struct {
		name      string
		body      string
		wantCode  int
		wantLabel string
		wantLaps  []int
		wantAt    string
		wantError string
	}{
		{"defaults completedAt, laps is []", `{"elapsedMs":5000}`, 201, "", []int{}, jakartaNow, ""},
		{"null laps is []", `{"elapsedMs":5000,"laps":null}`, 201, "", []int{}, jakartaNow, ""},
		{"label trimmed", `{"elapsedMs":5000,"label":"  run  "}`, 201, "run", []int{}, jakartaNow, ""},
		{"laps sum equals elapsed", `{"elapsedMs":5000,"laps":[2000,3000]}`, 201, "", []int{2000, 3000}, jakartaNow, ""},
		{"laps sum below elapsed", `{"elapsedMs":5000,"laps":[1000]}`, 201, "", []int{1000}, jakartaNow, ""},
		{"min elapsed", `{"elapsedMs":1}`, 201, "", []int{}, jakartaNow, ""},
		{"max elapsed", `{"elapsedMs":86400000}`, 201, "", []int{}, jakartaNow, ""},
		{"completedAt in server zone", `{"elapsedMs":5000,"completedAt":"2026-03-10T10:00:00Z"}`, 201, "", []int{}, "2026-03-10T17:00:00+07:00", ""},
		{"completedAt within tolerance", `{"elapsedMs":5000,"completedAt":"2026-03-10T20:00:30Z"}`, 201, "", []int{}, "2026-03-11T03:00:30+07:00", ""},
		{"100 char label", `{"elapsedMs":5000,"label":"` + strings.Repeat("é", 100) + `"}`, 201, strings.Repeat("é", 100), []int{}, jakartaNow, ""},
		{"1000 laps", `{"elapsedMs":86400000,"laps":` + onesJSON(1000) + `}`, 201, "", nil, jakartaNow, ""},
		{"missing elapsed", `{}`, 400, "", nil, "", "elapsedMs must be between 1 and 86400000"},
		{"zero elapsed", `{"elapsedMs":0}`, 400, "", nil, "", "elapsedMs must be between 1 and 86400000"},
		{"elapsed too big", `{"elapsedMs":86400001}`, 400, "", nil, "", "elapsedMs must be between 1 and 86400000"},
		{"label too long", `{"elapsedMs":5000,"label":"` + strings.Repeat("a", 101) + `"}`, 400, "", nil, "", "label must be at most 100 characters"},
		{"zero lap", `{"elapsedMs":5000,"laps":[0]}`, 400, "", nil, "", "each lap must be at least 1 ms"},
		{"negative lap", `{"elapsedMs":5000,"laps":[-5]}`, 400, "", nil, "", "each lap must be at least 1 ms"},
		{"laps sum over elapsed", `{"elapsedMs":5000,"laps":[3000,2001]}`, 400, "", nil, "", "laps must not add up to more than elapsedMs"},
		{"too many laps", `{"elapsedMs":86400000,"laps":` + onesJSON(1001) + `}`, 400, "", nil, "", "laps must have at most 1000 entries"},
		{"bad completedAt", `{"elapsedMs":5000,"completedAt":"yesterday"}`, 400, "", nil, "", "completedAt must be an RFC3339 timestamp"},
		{"future completedAt", `{"elapsedMs":5000,"completedAt":"2026-03-10T20:01:01Z"}`, 400, "", nil, "", "completedAt must not be in the future"},
		{"malformed body", `not json`, 400, "", nil, "", "invalid JSON body"},
		{"wrong type", `{"elapsedMs":"5"}`, 400, "", nil, "", "invalid JSON body"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := stopwatchDo(stopwatchRouter(t), http.MethodPost, "/api/stopwatch/sessions", tt.body)
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantCode, w.Body)
			}
			var got stopwatchBody
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("decode %q: %v", w.Body, err)
			}
			if tt.wantCode != 201 {
				if got.Error != tt.wantError {
					t.Errorf("error = %q, want %q", got.Error, tt.wantError)
				}
				return
			}
			if len(got.ID) != 32 || got.Label != tt.wantLabel || got.CompletedAt != tt.wantAt {
				t.Errorf("got %+v, want label %q at %s", got, tt.wantLabel, tt.wantAt)
			}
			if tt.wantLaps != nil && !reflect.DeepEqual(got.Laps, tt.wantLaps) {
				t.Errorf("laps = %v, want %v", got.Laps, tt.wantLaps)
			}
			if got.Laps == nil {
				t.Error("laps decoded as nil, want array")
			}
		})
	}
}

func TestCreateStopwatchLapsNeverNull(t *testing.T) {
	w := stopwatchDo(stopwatchRouter(t), http.MethodPost, "/api/stopwatch/sessions", `{"elapsedMs":5000}`)
	if !strings.Contains(w.Body.String(), `"laps":[]`) {
		t.Errorf("body = %s, want \"laps\":[]", w.Body)
	}
}

func TestListStopwatchSessions(t *testing.T) {
	seed := func(t *testing.T, r *gin.Engine) {
		t.Helper()
		for _, b := range []string{
			`{"elapsedMs":1000,"label":"old","completedAt":"2026-03-10T08:00:00Z"}`,
			`{"elapsedMs":2000,"label":"new","completedAt":"2026-03-10T19:00:00Z"}`,
			`{"elapsedMs":3000,"label":"mid","completedAt":"2026-03-10T12:00:00Z"}`,
		} {
			if w := stopwatchDo(r, http.MethodPost, "/api/stopwatch/sessions", b); w.Code != 201 {
				t.Fatalf("seed: %d %s", w.Code, w.Body)
			}
		}
	}
	tests := []struct {
		name       string
		query      string
		seed       bool
		wantCode   int
		wantLabels []string
	}{
		{"empty is []", "", false, 200, []string{}},
		{"newest first", "", true, 200, []string{"new", "mid", "old"}},
		{"limit", "?limit=2", true, 200, []string{"new", "mid"}},
		{"limit min", "?limit=1", true, 200, []string{"new"}},
		{"limit max", "?limit=200", true, 200, []string{"new", "mid", "old"}},
		{"limit zero", "?limit=0", true, 400, nil},
		{"limit too big", "?limit=201", true, 400, nil},
		{"limit negative", "?limit=-1", true, 400, nil},
		{"limit not a number", "?limit=abc", true, 400, nil},
		{"limit empty", "?limit=", true, 400, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := stopwatchRouter(t)
			if tt.seed {
				seed(t, r)
			}
			w := stopwatchDo(r, http.MethodGet, "/api/stopwatch/sessions"+tt.query, "")
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantCode, w.Body)
			}
			if tt.wantCode != 200 {
				var e stopwatchBody
				if err := json.Unmarshal(w.Body.Bytes(), &e); err != nil || e.Error == "" {
					t.Errorf("want error body, got %s", w.Body)
				}
				return
			}
			if cc := w.Header().Get("Cache-Control"); cc != "no-store" {
				t.Errorf("Cache-Control = %q, want no-store", cc)
			}
			var got struct {
				Sessions []stopwatchBody `json:"sessions"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil || got.Sessions == nil {
				t.Fatalf("decode %q: %v", w.Body, err)
			}
			labels := []string{}
			for _, s := range got.Sessions {
				labels = append(labels, s.Label)
			}
			if !reflect.DeepEqual(labels, tt.wantLabels) {
				t.Errorf("labels = %v, want %v", labels, tt.wantLabels)
			}
		})
	}
}

func TestDeleteStopwatchSession(t *testing.T) {
	r := stopwatchRouter(t)
	w := stopwatchDo(r, http.MethodPost, "/api/stopwatch/sessions", `{"elapsedMs":1000}`)
	var created stopwatchBody
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name     string
		id       string
		wantCode int
	}{
		{"existing", created.ID, http.StatusNoContent},
		{"already deleted", created.ID, http.StatusNotFound},
		{"unknown", "nope", http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := stopwatchDo(r, http.MethodDelete, "/api/stopwatch/sessions/"+tt.id, "")
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d", w.Code, tt.wantCode)
			}
			if tt.wantCode == http.StatusNotFound {
				var e stopwatchBody
				if err := json.Unmarshal(w.Body.Bytes(), &e); err != nil || e.Error == "" {
					t.Errorf("want error body, got %s", w.Body)
				}
			} else if w.Body.Len() != 0 {
				t.Errorf("204 body = %q, want empty", w.Body)
			}
		})
	}

	lw := stopwatchDo(r, http.MethodGet, "/api/stopwatch/sessions", "")
	if !strings.Contains(lw.Body.String(), `"sessions":[]`) {
		t.Errorf("list after delete = %s, want empty", lw.Body)
	}
}
