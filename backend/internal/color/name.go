package color

import "math"

type lab struct{ l, a, b float64 }

// toLab converts sRGB to CIE L*a*b* (D65), so distances track perceived
// difference better than plain RGB distance.
func (c RGB) toLab() lab {
	lin := func(v int) float64 {
		s := float64(v) / 255
		if s <= 0.04045 {
			return s / 12.92
		}
		return math.Pow((s+0.055)/1.055, 2.4)
	}
	r, g, b := lin(c.R), lin(c.G), lin(c.B)
	x := (0.4124564*r + 0.3575761*g + 0.1804375*b) / 0.95047
	y := 0.2126729*r + 0.7151522*g + 0.0721750*b
	z := (0.0193339*r + 0.1191920*g + 0.9503041*b) / 1.08883
	f := func(t float64) float64 {
		if t > 216.0/24389 {
			return math.Cbrt(t)
		}
		return (24389.0/27*t + 16) / 116
	}
	fx, fy, fz := f(x), f(y), f(z)
	return lab{116*fy - 16, 500 * (fx - fy), 200 * (fy - fz)}
}

var namedLab = func() []lab {
	out := make([]lab, len(named))
	for i, n := range named {
		out[i] = fromUint(n.hex).toLab()
	}
	return out
}()

// Name returns the nearest CSS named color (CIE76 distance) and whether the
// color is exactly that named color.
func (c RGB) Name() (name string, exact bool) {
	target := c.toLab()
	best, bestDist := 0, math.Inf(1)
	for i, l := range namedLab {
		d := (l.l-target.l)*(l.l-target.l) + (l.a-target.a)*(l.a-target.a) + (l.b-target.b)*(l.b-target.b)
		if d < bestDist {
			best, bestDist = i, d
		}
	}
	return named[best].name, fromUint(named[best].hex) == c
}
