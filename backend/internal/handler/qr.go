package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"backend/internal/qr"
)

const (
	maxContentBytes = 2048
	minSize         = 128
	maxSize         = 1024
	defaultSize     = 256
	defaultLevel    = "M"
)

type qrRequest struct {
	Content string  `json:"content"`
	Size    *int    `json:"size"`
	Level   *string `json:"level"`
}

// QR validates the request and responds with a QR code PNG for the given content.
func QR(c *gin.Context) {
	var req qrRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		badRequest(c, "content is required")
		return
	}
	if len(req.Content) > maxContentBytes {
		badRequest(c, "content must be at most 2048 bytes")
		return
	}

	size := defaultSize
	if req.Size != nil {
		size = *req.Size
	}
	if size < minSize || size > maxSize {
		badRequest(c, "size must be between 128 and 1024")
		return
	}

	levelStr := defaultLevel
	if req.Level != nil {
		levelStr = *req.Level
	}
	level, err := qr.ParseLevel(levelStr)
	if err != nil {
		badRequest(c, err.Error())
		return
	}

	img, err := qr.Generate(req.Content, size, level)
	if err != nil {
		if errors.Is(err, qr.ErrContentTooLarge) {
			badRequest(c, err.Error())
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate QR code"})
		return
	}

	c.Data(http.StatusOK, "image/png", img)
}

func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": msg})
}
