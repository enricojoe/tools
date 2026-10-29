package router

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"backend/internal/handler"
	"backend/internal/pomodoro"
	"backend/internal/stopwatch"
)

// New builds the HTTP router with all API routes registered. When staticDir is
// set, the built frontend in it is served for every other path.
func New(db *sqlx.DB, staticDir string) *gin.Engine {
	r := gin.Default()
	sessions := pomodoro.NewPostgresRepository(db)
	stopwatchSessions := stopwatch.NewStore()

	api := r.Group("/api")
	api.GET("/health", handler.Health(db))
	api.GET("/time", handler.ServerTime(time.Now))
	api.GET("/holidays", handler.Holidays(time.Now))
	api.POST("/pomodoro/sessions", handler.CreatePomodoroSession(sessions, time.Now))
	api.GET("/pomodoro/sessions", handler.ListPomodoroSessions(sessions, time.Now))
	api.POST("/stopwatch/sessions", handler.CreateStopwatchSession(stopwatchSessions, time.Now))
	api.GET("/stopwatch/sessions", handler.ListStopwatchSessions(stopwatchSessions))
	api.DELETE("/stopwatch/sessions/:id", handler.DeleteStopwatchSession(stopwatchSessions))
	api.GET("/colors", handler.Colors)
	api.GET("/units", handler.Units)
	api.GET("/units/convert", handler.ConvertUnits)
	api.POST("/qr", handler.QR)
	api.POST("/qr/decode", handler.QRDecode)

	if staticDir != "" {
		r.NoRoute(serveFrontend(staticDir))
	}
	return r
}

// serveFrontend serves files from dir and falls back to index.html, so
// client-side routes like /tools/qr-code load the app. Unknown /api paths
// stay a JSON 404.
func serveFrontend(dir string) gin.HandlerFunc {
	index := filepath.Join(dir, "index.html")
	return func(c *gin.Context) {
		p := path.Clean("/" + c.Request.URL.Path)
		if p == "/api" || strings.HasPrefix(p, "/api/") ||
			(c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		file := filepath.Join(dir, filepath.FromSlash(p))
		if info, err := os.Stat(file); err == nil && info.Mode().IsRegular() {
			if strings.HasPrefix(p, "/assets/") {
				// Vite puts a content hash in these file names.
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.File(file)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.File(index)
	}
}
