package router

import (
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/handler"
)

// New builds the HTTP router with all API routes registered.
func New() *gin.Engine {
	r := gin.Default()

	api := r.Group("/api")
	api.GET("/health", handler.Health)
	api.GET("/time", handler.ServerTime(time.Now))
	api.GET("/holidays", handler.Holidays(time.Now))
	api.POST("/qr", handler.QR)
	api.POST("/qr/decode", handler.QRDecode)

	return r
}
