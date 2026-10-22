package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestHolidays(t *testing.T) {
	// 2026-12-31 17:30 UTC is already 2027 in Jakarta, so the default year
	// must follow the server's local zone.
	at := time.Date(2026, 12, 31, 17, 30, 0, 0, time.UTC)

	tests := []struct {
		name      string
		query     string
		wantCode  int
		wantYear  int
		wantFirst string // date of the first holiday; "" means an empty list
		wantError string
	}{
		{"default year", "", http.StatusOK, 2027, "2027-01-01", ""},
		{"given year", "?year=2025", http.StatusOK, 2025, "2025-01-01", ""},
		{"year without data", "?year=2030", http.StatusOK, 2030, "", ""},
		{"not a number", "?year=abc", http.StatusBadRequest, 0, "", "year must be a number between 1 and 9999"},
		{"empty", "?year=", http.StatusBadRequest, 0, "", "year must be a number between 1 and 9999"},
		{"too large", "?year=10000", http.StatusBadRequest, 0, "", "year must be a number between 1 and 9999"},
		{"zero", "?year=0", http.StatusBadRequest, 0, "", "year must be a number between 1 and 9999"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			old := time.Local
			time.Local = time.FixedZone("Asia/Jakarta", 7*3600)
			t.Cleanup(func() { time.Local = old })

			gin.SetMode(gin.TestMode)
			r := gin.New()
			r.GET("/api/holidays", Holidays(func() time.Time { return at }))

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/holidays"+tt.query, nil))

			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantCode, w.Body)
			}
			var got struct {
				Year     int `json:"year"`
				Holidays []struct {
					Date string `json:"date"`
					Name string `json:"name"`
					Type string `json:"type"`
				} `json:"holidays"`
				AvailableYears []int  `json:"availableYears"`
				Error          string `json:"error"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("invalid JSON: %v", err)
			}

			if tt.wantError != "" {
				if got.Error != tt.wantError {
					t.Errorf("error = %q, want %q", got.Error, tt.wantError)
				}
				return
			}
			if got.Year != tt.wantYear {
				t.Errorf("year = %d, want %d", got.Year, tt.wantYear)
			}
			if got.Holidays == nil {
				t.Fatal("holidays is missing or null, want an array")
			}
			if tt.wantFirst == "" {
				if len(got.Holidays) != 0 {
					t.Errorf("holidays = %v, want empty", got.Holidays)
				}
			} else if len(got.Holidays) == 0 || got.Holidays[0].Date != tt.wantFirst {
				t.Errorf("first holiday = %v, want date %s", got.Holidays, tt.wantFirst)
			} else if h := got.Holidays[0]; h.Name == "" || h.Type != "national" {
				t.Errorf("first holiday = %+v, want a named national holiday", h)
			}
			if len(got.AvailableYears) == 0 {
				t.Error("availableYears is empty")
			}
		})
	}
}
