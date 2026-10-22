// Package color derives everything the Color Picker needs from one color:
// other color models, the nearest CSS color name, WCAG contrast, harmonies
// and shades. All of it is pure math, so results can be cached freely.
package color

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// ErrInvalidHex is returned by Parse for anything that is not a 3 or 6 digit
// hex color.
var ErrInvalidHex = errors.New("hex must be 3 or 6 hexadecimal digits, with an optional leading #")

// RGB is a color in the sRGB space, 0-255 per channel.
type RGB struct {
	R int `json:"r"`
	G int `json:"g"`
	B int `json:"b"`
}

// HSL is hue (0-359), saturation and lightness (0-100), rounded to integers.
type HSL struct {
	H int `json:"h"`
	S int `json:"s"`
	L int `json:"l"`
}

// HSV is hue (0-359), saturation and value (0-100), rounded to integers.
type HSV struct {
	H int `json:"h"`
	S int `json:"s"`
	V int `json:"v"`
}

// CMYK holds cyan, magenta, yellow and key (black), 0-100 each.
type CMYK struct {
	C int `json:"c"`
	M int `json:"m"`
	Y int `json:"y"`
	K int `json:"k"`
}

// Parse reads "#RGB" or "#RRGGBB" (the # is optional, case does not matter).
func Parse(s string) (RGB, error) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "#")
	if len(s) == 3 {
		s = string([]byte{s[0], s[0], s[1], s[1], s[2], s[2]})
	}
	if len(s) != 6 {
		return RGB{}, ErrInvalidHex
	}
	for i := 0; i < len(s); i++ {
		if !isHexDigit(s[i]) {
			return RGB{}, ErrInvalidHex
		}
	}
	v, err := strconv.ParseUint(s, 16, 32)
	if err != nil {
		return RGB{}, ErrInvalidHex
	}
	return fromUint(uint32(v)), nil
}

func isHexDigit(b byte) bool {
	return b >= '0' && b <= '9' || b >= 'a' && b <= 'f' || b >= 'A' && b <= 'F'
}

func fromUint(v uint32) RGB {
	return RGB{R: int(v >> 16 & 0xFF), G: int(v >> 8 & 0xFF), B: int(v & 0xFF)}
}

// Hex returns the color as uppercase "#RRGGBB".
func (c RGB) Hex() string {
	return fmt.Sprintf("#%02X%02X%02X", c.R, c.G, c.B)
}

// hsl is the unrounded form used internally so that chained conversions do
// not accumulate rounding error. h is in degrees [0, 360), s and l in [0, 1].
type hsl struct{ h, s, l float64 }

func (c RGB) toHSL() hsl {
	r, g, b := float64(c.R)/255, float64(c.G)/255, float64(c.B)/255
	maxC, minC := math.Max(r, math.Max(g, b)), math.Min(r, math.Min(g, b))
	l := (maxC + minC) / 2
	d := maxC - minC
	if d == 0 {
		return hsl{0, 0, l}
	}
	s := d / (1 - math.Abs(2*l-1))
	return hsl{hueOf(r, g, b, maxC, d), s, l}
}

// hueOf returns the hue in degrees [0, 360) shared by HSL and HSV.
func hueOf(r, g, b, maxC, d float64) float64 {
	var h float64
	switch maxC {
	case r:
		h = math.Mod((g-b)/d, 6)
	case g:
		h = (b-r)/d + 2
	default:
		h = (r-g)/d + 4
	}
	h *= 60
	if h < 0 {
		h += 360
	}
	return h
}

func (x hsl) toRGB() RGB {
	h := math.Mod(x.h, 360)
	if h < 0 {
		h += 360
	}
	c := (1 - math.Abs(2*x.l-1)) * x.s
	m := x.l - c/2
	hp := h / 60
	t := c * (1 - math.Abs(math.Mod(hp, 2)-1))
	var r, g, b float64
	switch {
	case hp < 1:
		r, g, b = c, t, 0
	case hp < 2:
		r, g, b = t, c, 0
	case hp < 3:
		r, g, b = 0, c, t
	case hp < 4:
		r, g, b = 0, t, c
	case hp < 5:
		r, g, b = t, 0, c
	default:
		r, g, b = c, 0, t
	}
	return RGB{channel(r + m), channel(g + m), channel(b + m)}
}

func channel(v float64) int {
	return int(math.Round(math.Min(1, math.Max(0, v)) * 255))
}

func pct(v float64) int { return int(math.Round(v * 100)) }

// hue rounds a hue to 0-359 (a hue that rounds up to 360 wraps to 0).
func hue(h float64) int { return int(math.Round(h)) % 360 }

// HSL converts to hue/saturation/lightness.
func (c RGB) HSL() HSL {
	x := c.toHSL()
	return HSL{hue(x.h), pct(x.s), pct(x.l)}
}

// HSV converts to hue/saturation/value.
func (c RGB) HSV() HSV {
	r, g, b := float64(c.R)/255, float64(c.G)/255, float64(c.B)/255
	maxC, minC := math.Max(r, math.Max(g, b)), math.Min(r, math.Min(g, b))
	d := maxC - minC
	var h, s float64
	if d != 0 {
		h = hueOf(r, g, b, maxC, d)
	}
	if maxC != 0 {
		s = d / maxC
	}
	return HSV{hue(h), pct(s), pct(maxC)}
}

// CMYK converts to cyan/magenta/yellow/key.
func (c RGB) CMYK() CMYK {
	r, g, b := float64(c.R)/255, float64(c.G)/255, float64(c.B)/255
	k := 1 - math.Max(r, math.Max(g, b))
	if k == 1 {
		return CMYK{0, 0, 0, 100}
	}
	return CMYK{
		C: pct((1 - r - k) / (1 - k)),
		M: pct((1 - g - k) / (1 - k)),
		Y: pct((1 - b - k) / (1 - k)),
		K: pct(k),
	}
}
