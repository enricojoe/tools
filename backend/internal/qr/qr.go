// Package qr generates QR code PNG images. It is the only package that
// imports the underlying QR library.
package qr

import (
	"errors"
	"fmt"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

// Level is a QR error-correction level.
type Level string

// Supported error-correction levels.
const (
	LevelL Level = "L"
	LevelM Level = "M"
	LevelQ Level = "Q"
	LevelH Level = "H"
)

// ErrContentTooLarge is returned when content does not fit in a QR code at the requested level.
var ErrContentTooLarge = errors.New("content is too large to encode at this error-correction level")

// ParseLevel converts a string such as "M" into a Level. It returns an error for unknown levels.
func ParseLevel(s string) (Level, error) {
	switch l := Level(strings.ToUpper(s)); l {
	case LevelL, LevelM, LevelQ, LevelH:
		return l, nil
	}
	return "", errors.New("level must be one of L, M, Q, H")
}

func (l Level) recovery() qrcode.RecoveryLevel {
	switch l {
	case LevelL:
		return qrcode.Low
	case LevelQ:
		return qrcode.High
	case LevelH:
		return qrcode.Highest
	default:
		return qrcode.Medium
	}
}

// Generate renders content as a square PNG of size x size pixels.
// It returns ErrContentTooLarge if the content cannot be encoded.
func Generate(content string, size int, level Level) ([]byte, error) {
	png, err := qrcode.Encode(content, level.recovery(), size)
	if err != nil {
		if strings.Contains(err.Error(), "content too long") {
			return nil, ErrContentTooLarge
		}
		return nil, fmt.Errorf("encode qr: %w", err)
	}
	return png, nil
}
