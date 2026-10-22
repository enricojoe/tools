package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestServerTime(t *testing.T) {
	tests := []struct {
		name       string
		zone       *time.Location
		at         time.Time
		wantISO    string
		wantTZ     string
		wantOffset int
	}{
		{
			"named zone",
			time.FixedZone("Asia/Jakarta", 7*3600),
			time.Date(2026, 1, 2, 3, 4, 5, 123456789, time.UTC),
			"2026-01-02T10:04:05.123456789+07:00", "Asia/Jakarta", 25200,
		},
		{
			"negative offset",
			time.FixedZone("America/New_York", -5*3600),
			time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			"2026-05-31T19:00:00-05:00", "America/New_York", -18000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			old := time.Local
			time.Local = tt.zone
			t.Cleanup(func() { time.Local = old })

			gin.SetMode(gin.TestMode)
			r := gin.New()
			r.GET("/api/time", ServerTime(func() time.Time { return tt.at }))

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/time", nil))

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
			}
			if got := w.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", got)
			}
			var got struct {
				UnixMs           int64  `json:"unixMs"`
				ISO              string `json:"iso"`
				Timezone         string `json:"timezone"`
				UTCOffsetSeconds int    `json:"utcOffsetSeconds"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
				t.Fatalf("invalid JSON: %v", err)
			}
			if got.UnixMs != tt.at.UnixMilli() {
				t.Errorf("unixMs = %d, want %d", got.UnixMs, tt.at.UnixMilli())
			}
			if got.ISO != tt.wantISO {
				t.Errorf("iso = %q, want %q", got.ISO, tt.wantISO)
			}
			if got.Timezone != tt.wantTZ {
				t.Errorf("timezone = %q, want %q", got.Timezone, tt.wantTZ)
			}
			if got.UTCOffsetSeconds != tt.wantOffset {
				t.Errorf("utcOffsetSeconds = %d, want %d", got.UTCOffsetSeconds, tt.wantOffset)
			}
		})
	}
}
