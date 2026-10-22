package qr

import (
	"errors"
	"fmt"
	"image"

	"github.com/makiuchi-d/gozxing"
	zxqrcode "github.com/makiuchi-d/gozxing/qrcode"
)

// ErrNotFound is returned when no readable QR code is found in the image.
var ErrNotFound = errors.New("no QR code found in image")

// Decode reads the QR code in img and returns its text content.
// It returns ErrNotFound if the image has no readable QR code.
func Decode(img image.Image) (string, error) {
	bmp, err := gozxing.NewBinaryBitmapFromImage(img)
	if err != nil {
		return "", fmt.Errorf("prepare image: %w", err)
	}

	hints := map[gozxing.DecodeHintType]interface{}{
		gozxing.DecodeHintType_TRY_HARDER: true,
	}
	result, err := zxqrcode.NewQRCodeReader().Decode(bmp, hints)
	if err != nil {
		// A missing, damaged or unreadable code all mean "nothing to read".
		var (
			notFound gozxing.NotFoundException
			checksum gozxing.ChecksumException
			format   gozxing.FormatException
		)
		if errors.As(err, &notFound) || errors.As(err, &checksum) || errors.As(err, &format) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("decode qr: %w", err)
	}
	return result.GetText(), nil
}
