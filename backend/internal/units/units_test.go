package units

import (
	"errors"
	"math"
	"testing"
)

// contract is the unit id table from the API contract.
var contract = map[string][]string{
	"length":      {"mm", "cm", "m", "km", "in", "ft", "yd", "mi", "nmi"},
	"mass":        {"mg", "g", "kg", "t", "oz", "lb", "st"},
	"temperature": {"c", "f", "k"},
	"volume":      {"ml", "l", "m3", "tsp", "tbsp", "floz", "cup", "pt", "qt", "gal"},
	"area":        {"mm2", "cm2", "m2", "ha", "km2", "in2", "ft2", "yd2", "ac", "mi2"},
	"speed":       {"mps", "kmh", "mph", "kn", "fps"},
	"time":        {"ms", "s", "min", "h", "d", "wk", "yr"},
	"data":        {"b", "B", "kB", "MB", "GB", "TB", "KiB", "MiB", "GiB", "TiB"},
	"pressure":    {"pa", "kpa", "bar", "psi", "atm", "mmhg"},
	"energy":      {"j", "kj", "cal", "kcal", "wh", "kwh"},
}

var contractOrder = []string{"length", "mass", "temperature", "volume", "area", "speed", "time", "data", "pressure", "energy"}

func near(a, b float64) bool {
	return math.Abs(a-b) <= 1e-9*math.Max(1, math.Max(math.Abs(a), math.Abs(b)))
}

func result(t *testing.T, c Conversion, unit string) float64 {
	t.Helper()
	for _, r := range c.Results {
		if r.Unit == unit {
			return r.Value
		}
	}
	t.Fatalf("no result for %q", unit)
	return 0
}

func convert(t *testing.T, category, from string, v float64) Conversion {
	t.Helper()
	c, err := Convert(category, from, v)
	if err != nil {
		t.Fatalf("Convert(%s, %s, %v): %v", category, from, v, err)
	}
	return c
}

func TestContractUnitsExist(t *testing.T) {
	cats := Categories()
	if len(cats) != len(contractOrder) {
		t.Fatalf("got %d categories, want %d", len(cats), len(contractOrder))
	}
	for i, id := range contractOrder {
		cat := cats[i]
		if cat.ID != id {
			t.Fatalf("category %d = %q, want %q", i, cat.ID, id)
		}
		want := contract[id]
		if len(cat.Units) != len(want) {
			t.Errorf("%s: %d units, want %d", id, len(cat.Units), len(want))
			continue
		}
		for j, u := range cat.Units {
			if u.ID != want[j] {
				t.Errorf("%s unit %d = %q, want %q", id, j, u.ID, want[j])
			}
			if u.Name == "" || u.Symbol == "" {
				t.Errorf("%s/%s: empty name or symbol", id, u.ID)
			}
			if id != "temperature" && u.Factor <= 0 {
				t.Errorf("%s/%s: factor %v", id, u.ID, u.Factor)
			}
		}
	}
}

func TestIDsUnique(t *testing.T) {
	cats := map[string]bool{}
	for _, cat := range Categories() {
		if cats[cat.ID] {
			t.Errorf("duplicate category %q", cat.ID)
		}
		cats[cat.ID] = true
		seen := map[string]bool{}
		for _, u := range cat.Units {
			if seen[u.ID] {
				t.Errorf("%s: duplicate unit %q", cat.ID, u.ID)
			}
			seen[u.ID] = true
		}
	}
}

func TestResultsFollowUnitOrder(t *testing.T) {
	for _, cat := range Categories() {
		c := convert(t, cat.ID, cat.Units[0].ID, 1)
		if c.Category != cat.ID || c.From != cat.Units[0].ID || c.Value != 1 || len(c.Results) != len(cat.Units) {
			t.Fatalf("%s: unexpected %+v", cat.ID, c)
		}
		for i, r := range c.Results {
			if r.Unit != cat.Units[i].ID {
				t.Errorf("%s: result %d = %q, want %q", cat.ID, i, r.Unit, cat.Units[i].ID)
			}
		}
	}
}

func TestRoundTrip(t *testing.T) {
	for _, cat := range Categories() {
		for _, from := range cat.Units {
			start := 12.5
			c := convert(t, cat.ID, from.ID, start)
			for _, r := range c.Results {
				back := convert(t, cat.ID, r.Unit, r.Value)
				if got := result(t, back, from.ID); !near(got, start) {
					t.Errorf("%s: %s -> %s -> %s = %v, want %v", cat.ID, from.ID, r.Unit, from.ID, got, start)
				}
			}
		}
	}
}

func TestKnownValues(t *testing.T) {
	tests := []struct {
		category, from string
		value          float64
		to             string
		want           float64
	}{
		{"length", "mi", 1, "m", 1609.344},
		{"length", "in", 1, "mm", 25.4},
		{"length", "nmi", 1, "m", 1852},
		{"length", "m", 1, "ft", 3.280839895013123},
		{"mass", "lb", 1, "g", 453.59237},
		{"mass", "lb", 1, "oz", 16},
		{"volume", "gal", 1, "l", 3.785411784},
		{"volume", "gal", 1, "cup", 16},
		{"speed", "kn", 1, "mps", 1852.0 / 3600},
		{"speed", "mph", 60, "kmh", 96.56064},
		{"time", "yr", 1, "d", 365},
		{"data", "GiB", 1, "B", 1073741824},
		{"data", "kB", 1, "B", 1000},
		{"data", "B", 1, "b", 8},
		{"pressure", "atm", 1, "pa", 101325},
		{"pressure", "psi", 1, "pa", 6894.757293168},
		{"pressure", "mmhg", 1, "pa", 133.322387415},
		{"energy", "cal", 1, "j", 4.184},
		{"energy", "kwh", 1, "wh", 1000},
		{"area", "ac", 1, "m2", 4046.8564224},
		{"area", "ha", 1, "m2", 10000},
		{"temperature", "c", 0, "f", 32},
		{"temperature", "c", 0, "k", 273.15},
		{"temperature", "c", 100, "f", 212},
		{"temperature", "f", 32, "c", 0},
		{"temperature", "k", 0, "c", -273.15},
		{"temperature", "f", -40, "c", -40},
	}
	for _, tt := range tests {
		c := convert(t, tt.category, tt.from, tt.value)
		if got := result(t, c, tt.to); !near(got, tt.want) {
			t.Errorf("%v %s -> %s = %v, want %v", tt.value, tt.from, tt.to, got, tt.want)
		}
		if got := result(t, c, tt.from); got != tt.value {
			t.Errorf("%s -> itself = %v, want %v", tt.from, got, tt.value)
		}
	}
}

func TestAbsoluteZero(t *testing.T) {
	for _, tt := range []struct {
		from string
		v    float64
	}{{"c", -273.15}, {"f", -459.67}, {"k", 0}} {
		if _, err := Convert("temperature", tt.from, tt.v); err != nil {
			t.Errorf("%s %v at absolute zero: %v", tt.from, tt.v, err)
		}
	}
	for _, tt := range []struct {
		from string
		v    float64
	}{{"c", -273.16}, {"f", -459.68}, {"k", -0.01}, {"c", -1e15}} {
		if _, err := Convert("temperature", tt.from, tt.v); !errors.Is(err, ErrBelowAbsoluteZero) {
			t.Errorf("%s %v: err = %v, want ErrBelowAbsoluteZero", tt.from, tt.v, err)
		}
	}
}

func TestNegativeAllowedForOtherCategories(t *testing.T) {
	c := convert(t, "length", "m", -2)
	if got := result(t, c, "cm"); !near(got, -200) {
		t.Errorf("-2 m in cm = %v", got)
	}
}

func TestErrors(t *testing.T) {
	if _, err := Convert("nope", "m", 1); !errors.Is(err, ErrUnknownCategory) {
		t.Errorf("unknown category: %v", err)
	}
	if _, err := Convert("length", "kg", 1); !errors.Is(err, ErrUnknownUnit) {
		t.Errorf("unknown unit: %v", err)
	}
	for _, v := range []float64{math.NaN(), math.Inf(1), math.Inf(-1), 1e15 * 1.0000001, -2e15} {
		if _, err := Convert("length", "m", v); !errors.Is(err, ErrInvalidValue) {
			t.Errorf("value %v: %v", v, err)
		}
	}
	if _, err := Convert("length", "m", MaxValue); err != nil {
		t.Errorf("MaxValue rejected: %v", err)
	}
}
