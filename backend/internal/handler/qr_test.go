package handler

import (
	"bytes"
	"encoding/json"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func postQR(body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/qr", QR)

	req := httptest.NewRequest(http.MethodPost, "/api/qr", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestQRSuccess(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantSize int
	}{
		{"defaults", `{"content":"https://example.com"}`, 256},
		{"explicit", `{"content":"hello","size":128,"level":"H"}`, 128},
		{"max size", `{"content":"hello","size":1024,"level":"L"}`, 1024},
		{"level Q", `{"content":"hello","level":"Q"}`, 256},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := postQR(tt.body)
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, http.StatusOK, w.Body.String())
			}
			if ct := w.Header().Get("Content-Type"); ct != "image/png" {
				t.Fatalf("content-type = %q, want image/png", ct)
			}
			img, err := png.Decode(bytes.NewReader(w.Body.Bytes()))
			if err != nil {
				t.Fatalf("body is not a valid PNG: %v", err)
			}
			if got := img.Bounds().Dx(); got != tt.wantSize {
				t.Fatalf("width = %d, want %d", got, tt.wantSize)
			}
		})
	}
}

func TestQRBadRequest(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"bad json", `{not json`},
		{"empty body", ``},
		{"missing content", `{"size":256}`},
		{"empty content", `{"content":""}`},
		{"whitespace content", `{"content":"   "}`},
		{"content too long", `{"content":"` + strings.Repeat("a", 2049) + `"}`},
		{"size too small", `{"content":"x","size":127}`},
		{"size too large", `{"content":"x","size":1025}`},
		{"size wrong type", `{"content":"x","size":"big"}`},
		{"bad level", `{"content":"x","level":"Z"}`},
		{"empty level", `{"content":"x","level":""}`},
		{"too large to encode", `{"content":"` + strings.Repeat("a", 2048) + `","level":"H"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := postQR(tt.body)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
			var resp struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("body is not JSON: %v", err)
			}
			if resp.Error == "" {
				t.Fatalf("error message is empty")
			}
		})
	}
}
