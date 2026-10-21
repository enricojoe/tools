package qr

import (
	"bytes"
	"errors"
	"image/png"
	"strings"
	"testing"
)

func TestGenerate(t *testing.T) {
	for _, level := range []Level{LevelL, LevelM, LevelQ, LevelH} {
		b, err := Generate("https://example.com", 200, level)
		if err != nil {
			t.Fatalf("Generate(%s) error = %v", level, err)
		}
		img, err := png.Decode(bytes.NewReader(b))
		if err != nil {
			t.Fatalf("Generate(%s) output is not a PNG: %v", level, err)
		}
		if got := img.Bounds().Dx(); got != 200 {
			t.Fatalf("width = %d, want 200", got)
		}
		if got := img.Bounds().Dy(); got != 200 {
			t.Fatalf("height = %d, want 200", got)
		}
	}
}

func TestGenerateTooLarge(t *testing.T) {
	_, err := Generate(strings.Repeat("a", 2048), 256, LevelH)
	if !errors.Is(err, ErrContentTooLarge) {
		t.Fatalf("error = %v, want ErrContentTooLarge", err)
	}
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		in      string
		want    Level
		wantErr bool
	}{
		{"L", LevelL, false},
		{"M", LevelM, false},
		{"Q", LevelQ, false},
		{"H", LevelH, false},
		{"h", LevelH, false},
		{"X", "", true},
		{"", "", true},
	}
	for _, tt := range tests {
		got, err := ParseLevel(tt.in)
		if (err != nil) != tt.wantErr {
			t.Fatalf("ParseLevel(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
		}
		if got != tt.want {
			t.Fatalf("ParseLevel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
