// Package units converts values between units of measurement. Linear units
// carry a factor to their category's base unit; temperature converts through
// kelvin.
package units

import (
	"errors"
	"fmt"
	"math"
)

// MaxValue is the largest magnitude Convert accepts.
const MaxValue = 1e15

var (
	// ErrUnknownCategory means the category id is not in the table.
	ErrUnknownCategory = errors.New("unknown category")
	// ErrUnknownUnit means the unit id is not in the given category.
	ErrUnknownUnit = errors.New("unknown unit")
	// ErrInvalidValue means the value is not finite or exceeds MaxValue.
	ErrInvalidValue = errors.New("value must be a finite number no larger than 1e15 in magnitude")
	// ErrBelowAbsoluteZero means a temperature is colder than absolute zero.
	ErrBelowAbsoluteZero = errors.New("temperature is below absolute zero")
)

// Unit describes one unit. Factor is how many base units one of this unit is;
// it is unused for temperature.
type Unit struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Symbol string  `json:"symbol"`
	Factor float64 `json:"-"`
}

// Category is a group of convertible units, in display order.
type Category struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Units []Unit `json:"units"`
}

// Result is a converted value in one unit.
type Result struct {
	Unit  string  `json:"unit"`
	Value float64 `json:"value"`
}

// Conversion is the outcome of Convert.
type Conversion struct {
	Category string   `json:"category"`
	From     string   `json:"from"`
	Value    float64  `json:"value"`
	Results  []Result `json:"results"`
}

// Categories returns every category in display order. The result must not be
// modified.
func Categories() []Category { return categories }

// Convert converts value from unit `from` to every unit of the category, in
// the category's unit order (including `from` itself).
func Convert(category, from string, value float64) (Conversion, error) {
	cat, ok := find(category)
	if !ok {
		return Conversion{}, fmt.Errorf("%w %q", ErrUnknownCategory, category)
	}
	src, ok := cat.unit(from)
	if !ok {
		return Conversion{}, fmt.Errorf("%w %q for category %q", ErrUnknownUnit, from, category)
	}
	if math.IsNaN(value) || math.Abs(value) > MaxValue {
		return Conversion{}, ErrInvalidValue
	}

	out := Conversion{Category: cat.ID, From: src.ID, Value: value, Results: make([]Result, len(cat.Units))}
	if cat.ID == "temperature" {
		k := toKelvin(src.ID, value)
		if k < -kelvinTolerance {
			return Conversion{}, ErrBelowAbsoluteZero
		}
		for i, u := range cat.Units {
			out.Results[i] = Result{Unit: u.ID, Value: fromKelvin(u.ID, k)}
		}
		return out, nil
	}
	for i, u := range cat.Units {
		out.Results[i] = Result{Unit: u.ID, Value: value * src.Factor / u.Factor}
	}
	return out, nil
}

// kelvinTolerance absorbs float error for inputs exactly at absolute zero.
const kelvinTolerance = 1e-9

func toKelvin(id string, v float64) float64 {
	switch id {
	case "c":
		return v + 273.15
	case "f":
		return (v-32)*5/9 + 273.15
	}
	return v
}

func fromKelvin(id string, k float64) float64 {
	switch id {
	case "c":
		return k - 273.15
	case "f":
		return (k-273.15)*9/5 + 32
	}
	return k
}

func find(id string) (Category, bool) {
	for _, c := range categories {
		if c.ID == id {
			return c, true
		}
	}
	return Category{}, false
}

func (c Category) unit(id string) (Unit, bool) {
	for _, u := range c.Units {
		if u.ID == id {
			return u, true
		}
	}
	return Unit{}, false
}

const (
	usGallon = 3.785411784 // litres
	inch     = 0.0254      // metres
	foot     = 0.3048
	yard     = 0.9144
	mile     = 1609.344
	nmi      = 1852
)

var categories = []Category{
	{ID: "length", Name: "Length", Units: []Unit{
		{"mm", "Millimeter", "mm", 0.001},
		{"cm", "Centimeter", "cm", 0.01},
		{"m", "Meter", "m", 1},
		{"km", "Kilometer", "km", 1000},
		{"in", "Inch", "in", inch},
		{"ft", "Foot", "ft", foot},
		{"yd", "Yard", "yd", yard},
		{"mi", "Mile", "mi", mile},
		{"nmi", "Nautical mile", "nmi", nmi},
	}},
	{ID: "mass", Name: "Mass", Units: []Unit{
		{"mg", "Milligram", "mg", 1e-6},
		{"g", "Gram", "g", 0.001},
		{"kg", "Kilogram", "kg", 1},
		{"t", "Metric ton", "t", 1000},
		{"oz", "Ounce", "oz", 0.45359237 / 16},
		{"lb", "Pound", "lb", 0.45359237},
		{"st", "Stone", "st", 0.45359237 * 14},
	}},
	{ID: "temperature", Name: "Temperature", Units: []Unit{
		{ID: "c", Name: "Celsius", Symbol: "°C"},
		{ID: "f", Name: "Fahrenheit", Symbol: "°F"},
		{ID: "k", Name: "Kelvin", Symbol: "K"},
	}},
	{ID: "volume", Name: "Volume", Units: []Unit{
		{"ml", "Milliliter", "mL", 0.001},
		{"l", "Liter", "L", 1},
		{"m3", "Cubic meter", "m³", 1000},
		{"tsp", "Teaspoon", "tsp", usGallon / 768},
		{"tbsp", "Tablespoon", "tbsp", usGallon / 256},
		{"floz", "Fluid ounce", "fl oz", usGallon / 128},
		{"cup", "Cup", "cup", usGallon / 16},
		{"pt", "Pint", "pt", usGallon / 8},
		{"qt", "Quart", "qt", usGallon / 4},
		{"gal", "Gallon", "gal", usGallon},
	}},
	{ID: "area", Name: "Area", Units: []Unit{
		{"mm2", "Square millimeter", "mm²", 1e-6},
		{"cm2", "Square centimeter", "cm²", 1e-4},
		{"m2", "Square meter", "m²", 1},
		{"ha", "Hectare", "ha", 1e4},
		{"km2", "Square kilometer", "km²", 1e6},
		{"in2", "Square inch", "in²", inch * inch},
		{"ft2", "Square foot", "ft²", foot * foot},
		{"yd2", "Square yard", "yd²", yard * yard},
		{"ac", "Acre", "ac", 4046.8564224},
		{"mi2", "Square mile", "mi²", mile * mile},
	}},
	{ID: "speed", Name: "Speed", Units: []Unit{
		{"mps", "Meter per second", "m/s", 1},
		{"kmh", "Kilometer per hour", "km/h", 1000.0 / 3600},
		{"mph", "Mile per hour", "mph", mile / 3600},
		{"kn", "Knot", "kn", nmi / 3600.0},
		{"fps", "Foot per second", "ft/s", foot},
	}},
	{ID: "time", Name: "Time", Units: []Unit{
		{"ms", "Millisecond", "ms", 0.001},
		{"s", "Second", "s", 1},
		{"min", "Minute", "min", 60},
		{"h", "Hour", "h", 3600},
		{"d", "Day", "d", 86400},
		{"wk", "Week", "wk", 604800},
		{"yr", "Year", "yr", 365 * 86400},
	}},
	{ID: "data", Name: "Data", Units: []Unit{
		{"b", "Bit", "b", 1},
		{"B", "Byte", "B", 8},
		{"kB", "Kilobyte", "kB", 8e3},
		{"MB", "Megabyte", "MB", 8e6},
		{"GB", "Gigabyte", "GB", 8e9},
		{"TB", "Terabyte", "TB", 8e12},
		{"KiB", "Kibibyte", "KiB", 8 * 1 << 10},
		{"MiB", "Mebibyte", "MiB", 8 * 1 << 20},
		{"GiB", "Gibibyte", "GiB", 8 * 1 << 30},
		{"TiB", "Tebibyte", "TiB", 8 * 1 << 40},
	}},
	{ID: "pressure", Name: "Pressure", Units: []Unit{
		{"pa", "Pascal", "Pa", 1},
		{"kpa", "Kilopascal", "kPa", 1000},
		{"bar", "Bar", "bar", 1e5},
		{"psi", "Pound per square inch", "psi", 6894.757293168},
		{"atm", "Atmosphere", "atm", 101325},
		{"mmhg", "Millimeter of mercury", "mmHg", 133.322387415},
	}},
	{ID: "energy", Name: "Energy", Units: []Unit{
		{"j", "Joule", "J", 1},
		{"kj", "Kilojoule", "kJ", 1000},
		{"cal", "Calorie", "cal", 4.184},
		{"kcal", "Kilocalorie", "kcal", 4184},
		{"wh", "Watt-hour", "Wh", 3600},
		{"kwh", "Kilowatt-hour", "kWh", 3.6e6},
	}},
}
