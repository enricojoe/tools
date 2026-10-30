package handler

import (
	"math/rand/v2"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"backend/internal/lorem"
)

const (
	defaultLoremUnit  = lorem.Paragraphs
	defaultLoremCount = 3
	maxLoremSeed      = 1<<32 - 1
)

// Lorem generates lorem ipsum text from the `unit`, `count`, `startWithLorem`
// and `seed` query parameters. A seeded result never changes, so it is
// cacheable; without a seed a random one is picked and returned.
func Lorem(c *gin.Context) {
	opts := lorem.Options{Unit: defaultLoremUnit, Count: defaultLoremCount, StartWithLorem: true}

	if raw := c.Query("unit"); raw != "" {
		opts.Unit = lorem.Unit(raw)
	}
	if raw := c.Query("count"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			badRequest(c, "count must be a whole number")
			return
		}
		opts.Count = n
	}
	if raw := c.Query("startWithLorem"); raw != "" {
		b, err := strconv.ParseBool(raw)
		if err != nil {
			badRequest(c, "startWithLorem must be true or false")
			return
		}
		opts.StartWithLorem = b
	}
	seeded := false
	if raw := c.Query("seed"); raw != "" {
		s, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || s > maxLoremSeed {
			badRequest(c, "seed must be a whole number between 0 and 4294967295")
			return
		}
		opts.Seed, seeded = s, true
	} else {
		opts.Seed = rand.Uint64N(maxLoremSeed + 1)
	}

	result, err := lorem.Generate(opts)
	if err != nil {
		badRequest(c, err.Error())
		return
	}
	if seeded {
		c.Header("Cache-Control", "public, max-age=86400")
	} else {
		c.Header("Cache-Control", "no-store")
	}
	c.JSON(http.StatusOK, result)
}
