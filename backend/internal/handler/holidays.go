package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/holiday"
)

const (
	minYear = 1
	maxYear = 9999
)

// Holidays returns Indonesia's public holidays and collective leave days for
// the `year` query parameter, defaulting to the current year on the injected
// clock. A year without data gets an empty list; `availableYears` says which
// years have data so the client can tell "no data" from "no holidays".
func Holidays(now func() time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		year := now().In(time.Local).Year()
		if raw, ok := c.GetQuery("year"); ok {
			y, err := strconv.Atoi(raw)
			if err != nil || y < minYear || y > maxYear {
				badRequest(c, "year must be a number between 1 and 9999")
				return
			}
			year = y
		}

		days, _ := holiday.ForYear(year)
		if days == nil {
			days = []holiday.Holiday{}
		}
		c.JSON(http.StatusOK, gin.H{
			"year":           year,
			"holidays":       days,
			"availableYears": holiday.Years(),
		})
	}
}
