package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/units"
)

func unitsRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/units", Units)
	r.GET("/api/units/convert", ConvertUnits)
	return r
}

func getUnits(path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	unitsRouter().ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func TestUnitsList(t *testing.T) {
	w := getUnits("/api/units")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Header().Get("Cache-Control"); got != "public, max-age=86400" {
		t.Errorf("Cache-Control = %q", got)
	}
	var body struct {
		Categories []units.Category `json:"categories"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("bad JSON: %v", err)
	}
	if len(body.Categories) != 10 || body.Categories[0].ID != "length" || body.Categories[0].Name != "Length" {
		t.Fatalf("unexpected categories: %s", w.Body)
	}
	if u := body.Categories[0].Units[2]; u.ID != "m" || u.Name != "Meter" || u.Symbol != "m" {
		t.Errorf("unexpected unit %+v", u)
	}
	var raw map[string][]map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if _, leaked := raw["categories"][0]["units"].([]any)[0].(map[string]any)["Factor"]; leaked {
		t.Error("factor must not be exposed")
	}
}

func TestConvertUnitsValid(t *testing.T) {
	w := getUnits("/api/units/convert?category=length&from=mi&value=1")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	if got := w.Header().Get("Cache-Control"); got != "public, max-age=86400" {
		t.Errorf("Cache-Control = %q", got)
	}
	var body units.Conversion
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("bad JSON: %v", err)
	}
	if body.Category != "length" || body.From != "mi" || body.Value != 1 || len(body.Results) != 9 {
		t.Fatalf("unexpected body %s", w.Body)
	}
	found := false
	for _, r := range body.Results {
		if r.Unit == "m" {
			found = true
			if r.Value != 1609.344 {
				t.Errorf("1 mi = %v m", r.Value)
			}
		}
	}
	if !found {
		t.Error("no m result")
	}
}

func TestConvertUnitsTemperature(t *testing.T) {
	w := getUnits("/api/units/convert?category=temperature&from=c&value=0")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	var body units.Conversion
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	want := map[string]float64{"c": 0, "f": 32, "k": 273.15}
	for _, r := range body.Results {
		if r.Value != want[r.Unit] {
			t.Errorf("0 C in %s = %v, want %v", r.Unit, r.Value, want[r.Unit])
		}
	}
}

func TestConvertUnitsInvalid(t *testing.T) {
	base := "/api/units/convert?"
	for _, q := range []string{
		"",
		"category=length&from=m",
		"from=m&value=1",
		"category=nope&from=m&value=1",
		"category=length&value=1",
		"category=length&from=kg&value=1",
		"category=length&from=m&value=",
		"category=length&from=m&value=abc",
		"category=length&from=m&value=NaN",
		"category=length&from=m&value=Inf",
		"category=length&from=m&value=-Inf",
		"category=length&from=m&value=1e16",
		"category=length&from=m&value=-1e16",
		"category=temperature&from=c&value=-300",
	} {
		w := getUnits(base + q)
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
