// Package holiday holds Indonesia's official public holidays (hari libur
// nasional) and collective leave days (cuti bersama), as set each year by the
// joint decree of three ministers (SKB 3 Menteri).
//
// The dates follow lunar and religious calendars and government decisions, so
// they cannot be computed; they are listed by hand per year in data.go.
package holiday

import "slices"

// Type tells a public holiday apart from a collective leave day.
type Type string

const (
	// National is a public holiday (hari libur nasional).
	National Type = "national"
	// CollectiveLeave is a collective leave day (cuti bersama).
	CollectiveLeave Type = "collective_leave"
)

// Holiday is one day off. Holidays spanning several days have one entry per day.
type Holiday struct {
	// Date is the calendar day as YYYY-MM-DD.
	Date string `json:"date"`
	// Name is the official Indonesian name.
	Name string `json:"name"`
	Type Type   `json:"type"`
}

// ForYear returns the year's holidays sorted by date, and whether that year
// has data.
func ForYear(year int) ([]Holiday, bool) {
	days, ok := byYear[year]
	if !ok {
		return nil, false
	}
	return slices.Clone(days), true
}

// Years returns the years that have holiday data, ascending.
func Years() []int {
	years := make([]int, 0, len(byYear))
	for y := range byYear {
		years = append(years, y)
	}
	slices.Sort(years)
	return years
}
