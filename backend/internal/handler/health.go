package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Pinger checks that a dependency (the database) is reachable.
type Pinger interface {
	PingContext(ctx context.Context) error
}

// Health reports that the service is up and whether the database answers.
func Health(db Pinger) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "database": "unreachable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "database": "ok"})
	}
}
