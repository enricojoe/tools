package router

import (
	"github.com/gin-gonic/gin"

	"backend/internal/handler"
)

// New builds the HTTP router with all API routes registered.
func New() *gin.Engine {
	r := gin.Default()

	api := r.Group("/api")
	api.GET("/health", handler.Health)

	return r
}
