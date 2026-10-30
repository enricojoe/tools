package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/lorem"
)

func getLorem(path string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/lorem", Lorem)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func decodeLorem(t *testing.T, w *httptest.ResponseRecorder) lorem.Result {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	var body lorem.Result
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("bad JSON: %v", err)
	}
	return body
}

func TestLoremDefaults(t *testing.T) {
	w := getLorem("/api/lorem")
	body := decodeLorem(t, w)
	if body.Unit != lorem.Paragraphs || body.Count != 3 || len(body.Paragraphs) != 3 {
		t.Fatalf("unexpected body %s", w.Body)
	}
	if body.Paragraphs[0][:len(lorem.Opening)] != lorem.Opening {
		t.Errorf("should open with lorem ipsum: %q", body.Paragraphs[0])
	}
	if got := w.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q", got)
	}
}

func TestLoremSeeded(t *testing.T) {
	path := "/api/lorem?unit=words&count=12&startWithLorem=false&seed=4294967295"
	w := getLorem(path)
	a := decodeLorem(t, w)
	if a.Unit != lorem.Words || a.Count != 12 || a.Words != 12 || a.Seed != 4294967295 {
		t.Fatalf("unexpected body %s", w.Body)
	}
	if got := w.Header().Get("Cache-Control"); got != "public, max-age=86400" {
		t.Errorf("Cache-Control = %q", got)
	}
	if b := decodeLorem(t, getLorem(path)); b.Paragraphs[0] != a.Paragraphs[0] {
		t.Error("same seed gave different text")
	}
}

func TestLoremInvalid(t *testing.T) {
	for _, q := range []string{
		"unit=lines",
		"count=abc",
		"count=0",
		"unit=paragraphs&count=51",
		"unit=words&count=2001",
		"startWithLorem=maybe",
		"seed=-1",
		"seed=4294967296",
	} {
		w := getLorem("/api/lorem?" + q)
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", q, w.Code)
			continue
		}
		var body map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body["error"] == "" {
			t.Errorf("%s: body %s", q, w.Body)
		}
	}
}
