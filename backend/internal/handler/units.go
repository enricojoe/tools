package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"backend/internal/units"
)

// Units lists every unit category and its units in display order. The table
// is static, so the response is cacheable.
func Units(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, gin.H{"categories": units.Categories()})
}

// ConvertUnits converts the `value` query parameter from unit `from` to every
// unit in `category`. The result depends only on the input, so it is
// cacheable.
func ConvertUnits(c *gin.Context) {
	raw := c.Query("value")
	if raw == "" {
		badRequest(c, "value is required")
		return
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		badRequest(c, "value must be a number")
		return
	}
	result, err := units.Convert(c.Query("category"), c.Query("from"), value)
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, result)
}
