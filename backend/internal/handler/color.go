package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"backend/internal/color"
)

// Colors returns conversions, the nearest CSS name, contrast, harmonies and
// shades for the `hex` query parameter (3 or 6 digits, optional #). The
// result depends only on the input, so it is cacheable.
func Colors(c *gin.Context) {
	rgb, err := color.Parse(c.Query("hex"))
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, color.Describe(rgb))
}
