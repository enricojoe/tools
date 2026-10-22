package handler

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// ServerTime returns a handler reporting the server's clock. The clock is
// injected so tests can use a fixed time.
func ServerTime(now func() time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Read the clock once so every field describes the same instant.
		t := now().In(time.Local)
		abbr, offset := t.Zone()

		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{
			"unixMs":           t.UnixMilli(),
			"iso":              t.Format(time.RFC3339Nano),
			"timezone":         zoneName(t, abbr),
			"utcOffsetSeconds": offset,
		})
	}
}

// zoneName prefers an IANA name (the location, or the TZ env var when the
// location is just "Local"), falling back to the zone abbreviation.
func zoneName(t time.Time, abbr string) string {
	if name := t.Location().String(); name != "Local" && name != "" {
		return name
	}
	if tz := os.Getenv("TZ"); tz != "" {
		if _, err := time.LoadLocation(tz); err == nil {
			return tz
		}
	}
	return abbr
}
