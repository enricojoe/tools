package qr

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"testing"
)

func generateImage(t *testing.T, content string, size int) image.Image {
	t.Helper()
	b, err := Generate(content, size, LevelM)
	if err != nil {
		t.Fatalf("Generate error = %v", err)
	}
	img, err := png.Decode(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("png.Decode error = %v", err)
	}
	return img
}

func TestDecodeRoundTrip(t *testing.T) {
	tests := []struct {
		name    string
		content string
		size    int
	}{
		{"url", "https://example.com/path?q=1", 256},
		{"short", "hi", 128},
		{"unicode", "héllo wörld 日本語", 300},
		{"long", "The quick brown fox jumps over the lazy dog. 0123456789 0123456789 0123456789", 512},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Decode(generateImage(t, tt.content, tt.size))
			if err != nil {
				t.Fatalf("Decode error = %v", err)
			}
			if got != tt.content {
				t.Fatalf("Decode = %q, want %q", got, tt.content)
			}
		})
	}
}

func TestDecodeEmbedded(t *testing.T) {
	// A QR code covering only part of a larger white canvas, like a photo of one.
	qrImg := generateImage(t, "https://example.com/embedded", 200)
	canvas := image.NewRGBA(image.Rect(0, 0, 1000, 700))
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(600, 300, 800, 500), qrImg, image.Point{}, draw.Src)

	got, err := Decode(canvas)
	if err != nil {
		t.Fatalf("Decode error = %v", err)
	}
	if want := "https://example.com/embedded"; got != want {
		t.Fatalf("Decode = %q, want %q", got, want)
	}
}

func TestDecodeNotFound(t *testing.T) {
	blank := image.NewRGBA(image.Rect(0, 0, 200, 200))
	draw.Draw(blank, blank.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)

	if _, err := Decode(blank); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Decode error = %v, want ErrNotFound", err)
	}
}
