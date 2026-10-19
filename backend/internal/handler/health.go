package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health reports that the service is up.
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
