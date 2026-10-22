package color

import "math"

const (
	white = "#FFFFFF"
	black = "#000000"
)

// Contrast holds WCAG 2 contrast ratios against white and black text.
type Contrast struct {
	White    float64 `json:"white"`
	Black    float64 `json:"black"`
	BestText string  `json:"bestText"`
}

// Harmonies lists hex colors found by rotating the hue in HSL while keeping
// saturation and lightness.
type Harmonies struct {
	Complementary      []string `json:"complementary"`
	Analogous          []string `json:"analogous"`
	Triadic            []string `json:"triadic"`
	SplitComplementary []string `json:"splitComplementary"`
	Tetradic           []string `json:"tetradic"`
}

// Info is everything known about one color.
type Info struct {
	Hex       string    `json:"hex"`
	RGB       RGB       `json:"rgb"`
	HSL       HSL       `json:"hsl"`
	HSV       HSV       `json:"hsv"`
	CMYK      CMYK      `json:"cmyk"`
	Name      string    `json:"name"`
	ExactName bool      `json:"exactName"`
	Contrast  Contrast  `json:"contrast"`
	Harmonies Harmonies `json:"harmonies"`
	Shades    []string  `json:"shades"`
}

// Describe computes the full Info for a color.
func Describe(c RGB) Info {
	name, exact := c.Name()
	return Info{
		Hex:       c.Hex(),
		RGB:       c,
		HSL:       c.HSL(),
		HSV:       c.HSV(),
		CMYK:      c.CMYK(),
		Name:      name,
		ExactName: exact,
		Contrast:  c.Contrast(),
		Harmonies: c.Harmonies(),
		Shades:    c.Shades(),
	}
}

// luminance is the WCAG 2 relative luminance.
func (c RGB) luminance() float64 {
	lin := func(v int) float64 {
		s := float64(v) / 255
		if s <= 0.03928 {
			return s / 12.92
		}
		return math.Pow((s+0.055)/1.055, 2.4)
	}
	return 0.2126*lin(c.R) + 0.7152*lin(c.G) + 0.0722*lin(c.B)
}

func ratio(l1, l2 float64) float64 {
	if l1 < l2 {
		l1, l2 = l2, l1
	}
	return (l1 + 0.05) / (l2 + 0.05)
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// Contrast returns the WCAG 2 ratios against white and black and which of the
// two reads better as text on this color.
func (c RGB) Contrast() Contrast {
	l := c.luminance()
	w, b := ratio(1, l), ratio(0, l)
	best := black
	if w > b {
		best = white
	}
	return Contrast{White: round2(w), Black: round2(b), BestText: best}
}

func (x hsl) rotated(deg float64) string {
	return hsl{x.h + deg, x.s, x.l}.toRGB().Hex()
}

// Harmonies returns the classic hue-rotation color schemes.
func (c RGB) Harmonies() Harmonies {
	x := c.toHSL()
	return Harmonies{
		Complementary:      []string{x.rotated(180)},
		Analogous:          []string{x.rotated(-30), x.rotated(30)},
		Triadic:            []string{x.rotated(120), x.rotated(240)},
		SplitComplementary: []string{x.rotated(150), x.rotated(210)},
		Tetradic:           []string{x.rotated(90), x.rotated(180), x.rotated(270)},
	}
}

// Shades returns nine colors at lightness 90, 80, ..., 10 with the same hue
// and saturation, light to dark.
func (c RGB) Shades() []string {
	x := c.toHSL()
	out := make([]string, 0, 9)
	for l := 90; l >= 10; l -= 10 {
		out = append(out, hsl{x.h, x.s, float64(l) / 100}.toRGB().Hex())
	}
	return out
}
