package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/color"
)

func colorRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/colors", Colors)
	return r
}

func getColor(r *gin.Engine, query string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/colors"+query, nil))
	return w
}

func decodeColor(t *testing.T, w *httptest.ResponseRecorder) color.Info {
	t.Helper()
	var info color.Info
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil {
		t.Fatalf("bad JSON %q: %v", w.Body, err)
	}
	return info
}

func TestColorsValid(t *testing.T) {
	for _, q := range []string{"?hex=3B82F6", "?hex=%233b82f6", "?hex=3b82f6"} {
		w := getColor(colorRouter(), q)
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, body %s", q, w.Code, w.Body)
		}
		if got := w.Header().Get("Cache-Control"); got != "public, max-age=86400" {
			t.Errorf("%s: Cache-Control = %q", q, got)
		}
		info := decodeColor(t, w)
		if info.Hex != "#3B82F6" || info.RGB != (color.RGB{R: 59, G: 130, B: 246}) || info.Name != "Dodger Blue" {
			t.Errorf("%s: unexpected body %s", q, w.Body)
		}
		if info.Contrast.BestText != "#000000" || len(info.Shades) != 9 || len(info.Harmonies.Tetradic) != 3 {
			t.Errorf("%s: unexpected body %s", q, w.Body)
		}
	}
}

func TestColorsShortHex(t *testing.T) {
	w := getColor(colorRouter(), "?hex=%23FA0")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if info := decodeColor(t, w); info.Hex != "#FFAA00" {
		t.Errorf("hex = %q, want #FFAA00", info.Hex)
	}
}

func TestColorsExactName(t *testing.T) {
	info := decodeColor(t, getColor(colorRouter(), "?hex=ff0000"))
	if info.Name != "Red" || !info.ExactName {
		t.Errorf("name = %q exact = %v", info.Name, info.ExactName)
	}
}

func TestColorsInvalid(t *testing.T) {
	for _, q := range []string{"", "?hex=", "?hex=zzz", "?hex=12345", "?hex=%23GGGGGG", "?hex=1234567"} {
		w := getColor(colorRouter(), q)
		if w.Code != http.StatusBadRequest {
			t.Errorf("%q: status = %d, want 400", q, w.Code)
			continue
		}
		var body struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body.Error == "" {
			t.Errorf("%q: body = %s", q, w.Body)
		}
		if w.Header().Get("Cache-Control") != "" {
			t.Errorf("%q: errors must not be cacheable", q)
		}
	}
}
