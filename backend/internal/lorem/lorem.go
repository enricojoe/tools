// Package lorem generates lorem ipsum placeholder text from a seed, so the
// same options always give the same text.
package lorem

import (
	"fmt"
	"math/rand/v2"
	"strings"
)

// Unit is what Count counts.
type Unit string

const (
	Paragraphs Unit = "paragraphs"
	Sentences  Unit = "sentences"
	Words      Unit = "words"
)

// MaxCount is the largest allowed count per unit.
var MaxCount = map[Unit]int{
	Paragraphs: 50,
	Sentences:  200,
	Words:      2000,
}

// Opening is the classic first sentence used when StartWithLorem is set.
const Opening = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."

var openingWords = strings.Fields("lorem ipsum dolor sit amet consectetur adipiscing elit")

// vocabulary is drawn from Cicero's "De finibus bonorum et malorum", the
// source of the traditional lorem ipsum text.
var vocabulary = strings.Fields(`
a ac accumsan ad adipiscing aenean aliquam aliquet amet ante aptent arcu at
auctor augue bibendum blandit class commodo condimentum congue consectetur
consequat conubia convallis cras cubilia curabitur curae cursus dapibus diam
dictum dictumst dignissim dis dolor donec dui duis efficitur egestas eget
eleifend elementum elit enim erat eros est et etiam eu euismod ex facilisi
facilisis fames faucibus felis fermentum feugiat finibus fringilla fusce
gravida habitant habitasse hac hendrerit himenaeos iaculis id imperdiet in
inceptos integer interdum ipsum justo lacinia lacus laoreet lectus leo libero
ligula litora lobortis lorem luctus maecenas magna magnis malesuada massa
mattis mauris maximus metus mi molestie mollis montes morbi mus nam nascetur
natoque nec neque netus nibh nisi nisl non nostra nulla nullam nunc odio orci
ornare parturient pellentesque penatibus per pharetra phasellus placerat
platea porta porttitor posuere potenti praesent pretium primis proin pulvinar
purus quam quis quisque rhoncus ridiculus risus rutrum sagittis sapien
scelerisque sed sem semper senectus sit sociosqu sodales sollicitudin
suscipit suspendisse taciti tellus tempor tempus tincidunt torquent tortor
tristique turpis ullamcorper ultrices ultricies urna ut varius vehicula vel
velit venenatis vestibulum vitae vivamus viverra volutpat vulputate`)

// Options selects what to generate.
type Options struct {
	Unit           Unit
	Count          int
	StartWithLorem bool
	Seed           uint64
}

// Result is the generated text, split into paragraphs. Sentences and words
// come back as one paragraph.
type Result struct {
	Unit       Unit     `json:"unit"`
	Count      int      `json:"count"`
	Seed       uint64   `json:"seed"`
	Paragraphs []string `json:"paragraphs"`
	Words      int      `json:"words"`
}

// Validate checks the unit and that the count is in its range.
func (o Options) Validate() error {
	maxCount, ok := MaxCount[o.Unit]
	if !ok {
		return fmt.Errorf("unit must be %s, %s or %s", Paragraphs, Sentences, Words)
	}
	if o.Count < 1 || o.Count > maxCount {
		return fmt.Errorf("count must be between 1 and %d for %s", maxCount, o.Unit)
	}
	return nil
}

// Generate builds the text for valid options.
func Generate(o Options) (Result, error) {
	if err := o.Validate(); err != nil {
		return Result{}, err
	}
	g := generator{rng: rand.New(rand.NewPCG(o.Seed, o.Seed^0x9e3779b97f4a7c15))}

	var paragraphs []string
	switch o.Unit {
	case Paragraphs:
		for i := range o.Count {
			paragraphs = append(paragraphs, g.paragraph(o.StartWithLorem && i == 0))
		}
	case Sentences:
		paragraphs = []string{g.sentences(o.Count, o.StartWithLorem)}
	case Words:
		paragraphs = []string{g.words(o.Count, o.StartWithLorem)}
	}

	words := 0
	for _, p := range paragraphs {
		words += len(strings.Fields(p))
	}
	return Result{Unit: o.Unit, Count: o.Count, Seed: o.Seed, Paragraphs: paragraphs, Words: words}, nil
}

type generator struct {
	rng *rand.Rand
}

// between returns a random int in [lo, hi].
func (g generator) between(lo, hi int) int {
	return lo + g.rng.IntN(hi-lo+1)
}

func (g generator) word() string {
	return vocabulary[g.rng.IntN(len(vocabulary))]
}

// sentence is 6–16 words, capitalised, with an occasional comma.
func (g generator) sentence() string {
	n := g.between(6, 16)
	comma := -1
	if n >= 8 && g.rng.IntN(2) == 0 {
		comma = g.between(2, n-4)
	}
	var b strings.Builder
	for i := range n {
		w := g.word()
		if i == 0 {
			w = strings.ToUpper(w[:1]) + w[1:]
		} else {
			b.WriteByte(' ')
		}
		b.WriteString(w)
		if i == comma {
			b.WriteByte(',')
		}
	}
	b.WriteByte('.')
	return b.String()
}

func (g generator) sentences(n int, startWithLorem bool) string {
	out := make([]string, 0, n)
	for i := range n {
		if startWithLorem && i == 0 {
			out = append(out, Opening)
			continue
		}
		out = append(out, g.sentence())
	}
	return strings.Join(out, " ")
}

// paragraph is 4–8 sentences.
func (g generator) paragraph(startWithLorem bool) string {
	return g.sentences(g.between(4, 8), startWithLorem)
}

// words is n lowercase words with a capital first letter and a final period,
// opening with the classic words when asked.
func (g generator) words(n int, startWithLorem bool) string {
	out := make([]string, 0, n)
	for i := range n {
		if startWithLorem && i < len(openingWords) {
			out = append(out, openingWords[i])
			continue
		}
		out = append(out, g.word())
	}
	out[0] = strings.ToUpper(out[0][:1]) + out[0][1:]
	return strings.Join(out, " ") + "."
}
