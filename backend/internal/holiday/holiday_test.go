package holiday

import (
	"slices"
	"testing"
	"time"
)

// TestData guards the hand-written table: every date is real, in its year,
// strictly ascending (so no duplicates), named and typed.
func TestData(t *testing.T) {
	for year, days := range byYear {
		if len(days) == 0 {
			t.Errorf("%d: no holidays", year)
		}
		var prev time.Time
		for i, h := range days {
			d, err := time.Parse(time.DateOnly, h.Date)
			if err != nil {
				t.Errorf("%d[%d]: invalid date %q", year, i, h.Date)
				continue
			}
			if d.Year() != year {
				t.Errorf("%d[%d]: %s is in another year", year, i, h.Date)
			}
			if i > 0 && !d.After(prev) {
				t.Errorf("%d[%d]: %s is not after the previous date", year, i, h.Date)
			}
			prev = d
			if h.Name == "" {
				t.Errorf("%d[%d]: %s has no name", year, i, h.Date)
			}
			if h.Type != National && h.Type != CollectiveLeave {
				t.Errorf("%d[%d]: %s has unknown type %q", year, i, h.Date, h.Type)
			}
		}
	}
}

func TestForYear(t *testing.T) {
	days, ok := ForYear(2026)
	if !ok {
		t.Fatal("ForYear(2026) has no data")
	}
	if days[0] != (Holiday{"2026-01-01", "Tahun Baru 2026 Masehi", National}) {
		t.Errorf("first 2026 holiday = %+v", days[0])
	}

	// The result is a copy: changing it must not touch the table.
	days[0].Name = "changed"
	if again, _ := ForYear(2026); again[0].Name == "changed" {
		t.Error("ForYear returned the shared slice")
	}

	if days, ok := ForYear(1999); ok || days != nil {
		t.Errorf("ForYear(1999) = %v, %v; want nil, false", days, ok)
	}
}

func TestYears(t *testing.T) {
	years := Years()
	if !slices.IsSorted(years) {
		t.Errorf("Years() = %v, not ascending", years)
	}
	if !slices.Contains(years, 2026) || len(years) != len(byYear) {
		t.Errorf("Years() = %v", years)
	}
}
