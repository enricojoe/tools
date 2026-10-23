package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"backend/internal/stopwatch"
)

const (
	minElapsedMs          = 1
	maxElapsedMs          = 24 * 60 * 60 * 1000
	maxLaps               = 1000
	defaultStopwatchLimit = 50
	maxStopwatchLimit     = 200
)

type createStopwatchRequest struct {
	Label       string  `json:"label"`
	ElapsedMs   int     `json:"elapsedMs"`
	Laps        []int   `json:"laps"`
	CompletedAt *string `json:"completedAt"`
}

// stopwatchResponse is the wire form of a stopwatch session, with the time in
// the server's timezone.
type stopwatchResponse struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	ElapsedMs   int    `json:"elapsedMs"`
	Laps        []int  `json:"laps"`
	CompletedAt string `json:"completedAt"`
}

func toStopwatchResponse(s stopwatch.Session) stopwatchResponse {
	laps := s.Laps
	if laps == nil {
		laps = []int{}
	}
	return stopwatchResponse{
		ID:          s.ID,
		Label:       s.Label,
		ElapsedMs:   s.ElapsedMs,
		Laps:        laps,
		CompletedAt: s.CompletedAt.In(time.Local).Format(time.RFC3339),
	}
}

// CreateStopwatchSession validates a finished stopwatch run and saves it. The
// clock is injected so tests can use a fixed time.
func CreateStopwatchSession(repo stopwatch.Repository, now func() time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createStopwatchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			badRequest(c, "invalid JSON body")
			return
		}

		if req.ElapsedMs < minElapsedMs || req.ElapsedMs > maxElapsedMs {
			badRequest(c, "elapsedMs must be between 1 and 86400000")
			return
		}
		label := strings.TrimSpace(req.Label)
		if utf8.RuneCountInString(label) > maxLabelLength {
			badRequest(c, "label must be at most 100 characters")
			return
		}
		if len(req.Laps) > maxLaps {
			badRequest(c, "laps must have at most 1000 entries")
			return
		}
		lapSum := 0
		for _, lap := range req.Laps {
			if lap < 1 {
				badRequest(c, "each lap must be at least 1 ms")
				return
			}
			lapSum += lap
			if lapSum > req.ElapsedMs {
				badRequest(c, "laps must not add up to more than elapsedMs")
				return
			}
		}

		current := now()
		completedAt := current
		if req.CompletedAt != nil {
			t, err := time.Parse(time.RFC3339, *req.CompletedAt)
			if err != nil {
				badRequest(c, "completedAt must be an RFC3339 timestamp")
				return
			}
			if t.After(current.Add(futureTolerance)) {
				badRequest(c, "completedAt must not be in the future")
				return
			}
			completedAt = t
		}

		id, err := stopwatch.NewID()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
			return
		}
		s := stopwatch.Session{
			ID:          id,
			Label:       label,
			ElapsedMs:   req.ElapsedMs,
			Laps:        append([]int{}, req.Laps...),
			CompletedAt: completedAt,
		}
		repo.Add(s)
		c.JSON(http.StatusCreated, toStopwatchResponse(s))
	}
}

// ListStopwatchSessions returns the newest saved sessions, up to the `limit`
// query parameter (1-200, default 50).
func ListStopwatchSessions(repo stopwatch.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := defaultStopwatchLimit
		if raw, ok := c.GetQuery("limit"); ok {
			n, err := strconv.Atoi(raw)
			if err != nil || n < 1 || n > maxStopwatchLimit {
				badRequest(c, "limit must be an integer between 1 and 200")
				return
			}
			limit = n
		}

		sessions := repo.List(limit)
		out := make([]stopwatchResponse, 0, len(sessions))
		for _, s := range sessions {
			out = append(out, toStopwatchResponse(s))
		}

		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"sessions": out})
	}
}

// DeleteStopwatchSession removes the session named by the :id path parameter.
func DeleteStopwatchSession(repo stopwatch.Repository) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !repo.Delete(c.Param("id")) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
