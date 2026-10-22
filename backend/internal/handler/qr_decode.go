package handler

import (
	"errors"
	"image"
	_ "image/gif"  // register GIF decoder
	_ "image/jpeg" // register JPEG decoder
	_ "image/png"  // register PNG decoder
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/qr"
)

const (
	maxImageBytes = 10 << 20
	// multipartOverhead leaves room for boundaries and headers around a max-size file.
	multipartOverhead = 1 << 20
)

// QRDecode reads the uploaded image and responds with the text of the QR code in it.
func QRDecode(c *gin.Context) {
	// Cap the body so oversized uploads are rejected without being buffered.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImageBytes+multipartOverhead)

	fh, err := c.FormFile("image")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			badRequest(c, "image must be at most 10 MB")
			return
		}
		badRequest(c, "image is required")
		return
	}
	if fh.Size > maxImageBytes {
		badRequest(c, "image must be at most 10 MB")
		return
	}

	f, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read QR code"})
		return
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		badRequest(c, "unsupported image format (use PNG, JPEG or GIF)")
		return
	}

	content, err := qr.Decode(img)
	if err != nil {
		if errors.Is(err, qr.ErrNotFound) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read QR code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"content": content})
}
