package handler

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"backend/internal/qr"
)

func postDecode(t *testing.T, field, filename string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	if field != "" {
		fw, err := mw.CreateFormFile(field, filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := fw.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/qr/decode", QRDecode)

	req := httptest.NewRequest(http.MethodPost, "/api/qr/decode", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func qrPNG(t *testing.T, content string) []byte {
	t.Helper()
	b, err := qr.Generate(content, 256, qr.LevelM)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// qrJPEG pastes a QR code onto a larger white canvas and encodes it as JPEG.
func qrJPEG(t *testing.T, content string) []byte {
	t.Helper()
	qrImg, err := png.Decode(bytes.NewReader(qrPNG(t, content)))
	if err != nil {
		t.Fatal(err)
	}
	canvas := image.NewRGBA(image.Rect(0, 0, 800, 600))
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(300, 200, 556, 456), qrImg, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, canvas, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func blankPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 200, 200))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestQRDecode(t *testing.T) {
	tests := []struct {
		name        string
		field       string
		filename    string
		data        []byte
		wantStatus  int
		wantContent string
		wantError   string
	}{
		{"png", "image", "qr.png", qrPNG(t, "https://example.com"), http.StatusOK, "https://example.com", ""},
		{"jpeg in larger canvas", "image", "photo.jpg", qrJPEG(t, "hello camera"), http.StatusOK, "hello camera", ""},
		{"format detected by content not name", "image", "qr.txt", qrPNG(t, "by content"), http.StatusOK, "by content", ""},
		{"missing field", "", "", nil, http.StatusBadRequest, "", "image is required"},
		{"wrong field name", "file", "qr.png", qrPNG(t, "x"), http.StatusBadRequest, "", "image is required"},
		{"not an image", "image", "notes.txt", []byte("just some text"), http.StatusBadRequest, "", "unsupported image format (use PNG, JPEG or GIF)"},
		{"oversized body", "image", "big.png", make([]byte, maxImageBytes+multipartOverhead+1), http.StatusBadRequest, "", "image must be at most 10 MB"},
		{"oversized file", "image", "big.png", make([]byte, maxImageBytes+1), http.StatusBadRequest, "", "image must be at most 10 MB"},
		{"no qr code", "image", "blank.png", blankPNG(t), http.StatusUnprocessableEntity, "", "no QR code found in image"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := postDecode(t, tt.field, tt.filename, tt.data)
			if w.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tt.wantStatus, w.Body.String())
			}
			var resp struct {
				Content string `json:"content"`
				Error   string `json:"error"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("body is not JSON: %v", err)
			}
			if resp.Content != tt.wantContent {
				t.Fatalf("content = %q, want %q", resp.Content, tt.wantContent)
			}
			if resp.Error != tt.wantError {
				t.Fatalf("error = %q, want %q", resp.Error, tt.wantError)
			}
		})
	}
}
