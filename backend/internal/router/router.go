package router

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"backend/internal/handler"
	"backend/internal/pomodoro"
	"backend/internal/stopwatch"
)

// New builds the HTTP router with all API routes registered.
func New(db *sqlx.DB) *gin.Engine {
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
	api.POST("/qr", handler.QR)
	api.POST("/qr/decode", handler.QRDecode)

	return r
}
