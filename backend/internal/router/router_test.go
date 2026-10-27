package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestServeFrontend(t *testing.T) {
	dir := t.TempDir()
	write := func(name, body string) {
		t.Helper()
		file := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(file, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", "<app>")
	write("favicon.svg", "<svg>")
	write("assets/index-abc123.js", "js")

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/health", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.NoRoute(serveFrontend(dir))

	tests := []struct {
		name, method, path string
		wantCode           int
		wantBody           string
		wantCache          string
	}{
		{"root", http.MethodGet, "/", http.StatusOK, "<app>", "no-cache"},
		{"client route", http.MethodGet, "/tools/qr-code", http.StatusOK, "<app>", "no-cache"},
		{"static file", http.MethodGet, "/favicon.svg", http.StatusOK, "<svg>", ""},
		{"hashed asset", http.MethodGet, "/assets/index-abc123.js", http.StatusOK, "js", "public, max-age=31536000, immutable"},
		{"directory", http.MethodGet, "/assets", http.StatusOK, "<app>", "no-cache"},
		{"api route", http.MethodGet, "/api/health", http.StatusOK, "ok", ""},
		{"unknown api route", http.MethodGet, "/api/nope", http.StatusNotFound, `{"error":"not found"}`, ""},
		{"api root", http.MethodGet, "/api", http.StatusNotFound, `{"error":"not found"}`, ""},
		{"non-GET", http.MethodPost, "/tools/qr-code", http.StatusNotFound, `{"error":"not found"}`, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, nil))

			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d", w.Code, tt.wantCode)
			}
			if body := strings.TrimSpace(w.Body.String()); body != tt.wantBody {
				t.Errorf("body = %q, want %q", body, tt.wantBody)
			}
			if got := w.Header().Get("Cache-Control"); got != tt.wantCache {
				t.Errorf("Cache-Control = %q, want %q", got, tt.wantCache)
			}
		})
	}
}

func TestServeFrontendStaysInDir(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "dist")
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<app>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "secret.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Call the handler directly: the router would reject the path before it.
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.URL.Path = "/../secret.txt"
	serveFrontend(dir)(c)

	if body := w.Body.String(); strings.Contains(body, "secret") {
		t.Fatalf("body = %q, served a file outside the folder", body)
	}
}
