package handler

import (
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"backend/internal/pomodoro"
)

const (
	minDurationSeconds = 1
	maxDurationSeconds = 4 * 60 * 60
	maxLabelLength     = 100
	futureTolerance    = time.Minute
	dateLayout         = "2006-01-02"
)

type createSessionRequest struct {
	Kind            string  `json:"kind"`
	DurationSeconds int     `json:"durationSeconds"`
	Label           string  `json:"label"`
	CompletedAt     *string `json:"completedAt"`
}

// sessionResponse is the wire form of a session, with the time in the
// server's timezone.
type sessionResponse struct {
	ID              string `json:"id"`
	Kind            string `json:"kind"`
	DurationSeconds int    `json:"durationSeconds"`
	Label           string `json:"label"`
	CompletedAt     string `json:"completedAt"`
}

func toSessionResponse(s pomodoro.Session) sessionResponse {
	return sessionResponse{
		ID:              s.ID,
		Kind:            string(s.Kind),
		DurationSeconds: s.DurationSeconds,
		Label:           s.Label,
		CompletedAt:     s.CompletedAt.In(time.Local).Format(time.RFC3339),
	}
}

// CreatePomodoroSession validates a finished interval and logs it. The clock
// is injected so tests can use a fixed time.
func CreatePomodoroSession(repo pomodoro.Repository, now func() time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createSessionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			badRequest(c, "invalid JSON body")
			return
		}

		kind := pomodoro.Kind(req.Kind)
		if !kind.Valid() {
			badRequest(c, "kind must be one of focus, short_break, long_break")
			return
		}
		if req.DurationSeconds < minDurationSeconds || req.DurationSeconds > maxDurationSeconds {
			badRequest(c, "durationSeconds must be between 1 and 14400")
			return
		}
		label := strings.TrimSpace(req.Label)
		if utf8.RuneCountInString(label) > maxLabelLength {
			badRequest(c, "label must be at most 100 characters")
			return
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

		id, err := pomodoro.NewID()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
			return
		}
		s := pomodoro.Session{
			ID:              id,
			Kind:            kind,
			DurationSeconds: req.DurationSeconds,
			Label:           label,
			CompletedAt:     completedAt,
		}
		if err := repo.Add(c.Request.Context(), s); err != nil {
			log.Printf("pomodoro: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save session"})
			return
		}
		c.JSON(http.StatusCreated, toSessionResponse(s))
	}
}

// ListPomodoroSessions returns the sessions completed on the `date` query
// parameter (YYYY-MM-DD, default today) in the server's timezone, plus the
// day's focus totals.
func ListPomodoroSessions(repo pomodoro.Repository, now func() time.Time) gin.HandlerFunc {
	return func(c *gin.Context) {
		day := now().In(time.Local)
		day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
		if raw, ok := c.GetQuery("date"); ok {
			d, err := time.ParseInLocation(dateLayout, raw, time.Local)
			if err != nil {
				badRequest(c, "date must be in YYYY-MM-DD format")
				return
			}
			day = d
		}
		next := time.Date(day.Year(), day.Month(), day.Day()+1, 0, 0, 0, 0, time.Local)

		sessions, err := repo.Between(c.Request.Context(), day, next)
		if err != nil {
			log.Printf("pomodoro: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load sessions"})
			return
		}
		out := make([]sessionResponse, 0, len(sessions))
		focusCount, focusSeconds := 0, 0
		for _, s := range sessions {
			out = append(out, toSessionResponse(s))
			if s.Kind == pomodoro.Focus {
				focusCount++
				focusSeconds += s.DurationSeconds
			}
		}

		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{
			"date":         day.Format(dateLayout),
			"sessions":     out,
			"focusCount":   focusCount,
			"focusSeconds": focusSeconds,
		})
	}
}
