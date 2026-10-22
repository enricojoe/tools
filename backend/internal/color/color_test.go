package color

import (
	"reflect"
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		in      string
		want    RGB
		wantErr bool
	}{
		{"3B82F6", RGB{59, 130, 246}, false},
		{"#3b82f6", RGB{59, 130, 246}, false},
		{"#fa0", RGB{255, 170, 0}, false},
		{"FFF", RGB{255, 255, 255}, false},
		{"", RGB{}, true},
		{"#", RGB{}, true},
		{"12", RGB{}, true},
		{"#12345", RGB{}, true},
		{"#1234567", RGB{}, true},
		{"#GGGGGG", RGB{}, true},
		{"#+12345", RGB{}, true},
		{"##fff", RGB{}, true},
	}
	for _, tt := range tests {
		got, err := Parse(tt.in)
		if (err != nil) != tt.wantErr {
			t.Errorf("Parse(%q) error = %v, wantErr %v", tt.in, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("Parse(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestConversions(t *testing.T) {
	tests := []struct {
		hex  string
		hsl  HSL
		hsv  HSV
		cmyk CMYK
	}{
		{"#3B82F6", HSL{217, 91, 60}, HSV{217, 76, 96}, CMYK{76, 47, 0, 4}},
		{"#000000", HSL{0, 0, 0}, HSV{0, 0, 0}, CMYK{0, 0, 0, 100}},
		{"#FFFFFF", HSL{0, 0, 100}, HSV{0, 0, 100}, CMYK{0, 0, 0, 0}},
		{"#FF0000", HSL{0, 100, 50}, HSV{0, 100, 100}, CMYK{0, 100, 100, 0}},
		{"#808080", HSL{0, 0, 50}, HSV{0, 0, 50}, CMYK{0, 0, 0, 50}},
		{"#00FF00", HSL{120, 100, 50}, HSV{120, 100, 100}, CMYK{100, 0, 100, 0}},
	}
	for _, tt := range tests {
		c, _ := Parse(tt.hex)
		if got := c.HSL(); got != tt.hsl {
			t.Errorf("%s HSL = %v, want %v", tt.hex, got, tt.hsl)
		}
		if got := c.HSV(); got != tt.hsv {
			t.Errorf("%s HSV = %v, want %v", tt.hex, got, tt.hsv)
		}
		if got := c.CMYK(); got != tt.cmyk {
			t.Errorf("%s CMYK = %v, want %v", tt.hex, got, tt.cmyk)
		}
	}
}

func TestHueWrapsBelow360(t *testing.T) {
	// The hue is about 359.76 degrees, which rounds to 360 and must wrap to 0.
	c := RGB{255, 0, 1}
	if h := c.HSL().H; h != 0 {
		t.Errorf("HSL hue = %d, want 0", h)
	}
	if h := c.HSV().H; h != 0 {
		t.Errorf("HSV hue = %d, want 0", h)
	}
}

func TestHSLRoundTrip(t *testing.T) {
	for _, c := range []RGB{{59, 130, 246}, {0, 0, 0}, {255, 255, 255}, {12, 200, 99}, {200, 10, 10}} {
		if got := c.toHSL().toRGB(); got != c {
			t.Errorf("round trip %v = %v", c, got)
		}
	}
}

func TestName(t *testing.T) {
	tests := []struct {
		hex   string
		name  string
		exact bool
	}{
		{"#FF0000", "Red", true},
		{"#663399", "Rebecca Purple", true},
		{"#F0F8FF", "Alice Blue", true},
		{"#FF0001", "Red", false},
		{"#000001", "Black", false},
		{"#FFFFFE", "White", false},
	}
	for _, tt := range tests {
		c, _ := Parse(tt.hex)
		name, exact := c.Name()
		if name != tt.name || exact != tt.exact {
			t.Errorf("%s Name = %q, %v; want %q, %v", tt.hex, name, exact, tt.name, tt.exact)
		}
	}
}

func TestNamedTable(t *testing.T) {
	if len(named) != 148 {
		t.Errorf("named has %d colors, want 148", len(named))
	}
	seen := map[string]bool{}
	for _, n := range named {
		if seen[n.name] {
			t.Errorf("duplicate name %q", n.name)
		}
		seen[n.name] = true
	}
}

func TestContrast(t *testing.T) {
	tests := []struct {
		hex  string
		want Contrast
	}{
		{"#3B82F6", Contrast{3.68, 5.71, "#000000"}},
		{"#FFFFFF", Contrast{1, 21, "#000000"}},
		{"#000000", Contrast{21, 1, "#FFFFFF"}},
	}
	for _, tt := range tests {
		c, _ := Parse(tt.hex)
		if got := c.Contrast(); got != tt.want {
			t.Errorf("%s Contrast = %v, want %v", tt.hex, got, tt.want)
		}
	}
}

func TestHarmonies(t *testing.T) {
	c, _ := Parse("#FF0000")
	want := Harmonies{
		Complementary:      []string{"#00FFFF"},
		Analogous:          []string{"#FF0080", "#FF8000"},
		Triadic:            []string{"#00FF00", "#0000FF"},
		SplitComplementary: []string{"#00FF80", "#0080FF"},
		Tetradic:           []string{"#80FF00", "#00FFFF", "#8000FF"},
	}
	if got := c.Harmonies(); !reflect.DeepEqual(got, want) {
		t.Errorf("Harmonies = %+v, want %+v", got, want)
	}
}

func TestShades(t *testing.T) {
	c, _ := Parse("#3B82F6")
	got := c.Shades()
	if len(got) != 9 {
		t.Fatalf("len = %d, want 9", len(got))
	}
	prev := 101
	for i, s := range got {
		p, err := Parse(s)
		if err != nil {
			t.Fatalf("shade %q: %v", s, err)
		}
		l := p.HSL().L
		if want := 90 - 10*i; l < want-1 || l > want+1 {
			t.Errorf("shade %d (%s) lightness = %d, want about %d", i, s, l, want)
		}
		if l >= prev {
			t.Errorf("shades not strictly darkening at %s", s)
		}
		prev = l
	}
	gray, _ := Parse("#808080")
	if g := gray.Shades(); g[0] != "#E6E6E6" || g[8] != "#1A1A1A" {
		t.Errorf("gray shades = %v", g)
	}
}

func TestDescribe(t *testing.T) {
	c, _ := Parse("#3B82F6")
	info := Describe(c)
	if info.Hex != "#3B82F6" || info.Name != "Dodger Blue" || info.ExactName || len(info.Shades) != 9 {
		t.Errorf("unexpected info: %+v", info)
	}
}
