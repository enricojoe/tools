package lorem

import (
	"reflect"
	"strings"
	"testing"
)

func TestGenerateParagraphs(t *testing.T) {
	r, err := Generate(Options{Unit: Paragraphs, Count: 5, StartWithLorem: true, Seed: 7})
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Paragraphs) != 5 {
		t.Fatalf("got %d paragraphs", len(r.Paragraphs))
	}
	if !strings.HasPrefix(r.Paragraphs[0], Opening+" ") {
		t.Errorf("first paragraph = %q", r.Paragraphs[0])
	}
	if strings.HasPrefix(r.Paragraphs[1], "Lorem ipsum dolor") {
		t.Errorf("only the first paragraph should open with lorem ipsum")
	}
	total := 0
	for _, p := range r.Paragraphs {
		if !strings.HasSuffix(p, ".") || p[0] < 'A' || p[0] > 'Z' {
			t.Errorf("paragraph not a sentence run: %q", p)
		}
		if n := strings.Count(p, ". ") + 1; n < 4 || n > 8 {
			t.Errorf("paragraph has %d sentences", n)
		}
		total += len(strings.Fields(p))
	}
	if r.Words != total {
		t.Errorf("Words = %d, want %d", r.Words, total)
	}
}

func TestGenerateSentences(t *testing.T) {
	r, err := Generate(Options{Unit: Sentences, Count: 1, StartWithLorem: true})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(r.Paragraphs, []string{Opening}) {
		t.Errorf("got %q", r.Paragraphs)
	}

	r, err = Generate(Options{Unit: Sentences, Count: 12, Seed: 3})
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Paragraphs) != 1 || strings.Count(r.Paragraphs[0], ".") != 12 {
		t.Errorf("want 12 sentences in one paragraph, got %q", r.Paragraphs)
	}
	if strings.HasPrefix(r.Paragraphs[0], "Lorem ipsum dolor") {
		t.Error("should not open with lorem ipsum")
	}
}

func TestGenerateWords(t *testing.T) {
	r, err := Generate(Options{Unit: Words, Count: 3, StartWithLorem: true})
	if err != nil {
		t.Fatal(err)
	}
	if r.Paragraphs[0] != "Lorem ipsum dolor." || r.Words != 3 {
		t.Errorf("got %q (%d words)", r.Paragraphs[0], r.Words)
	}

	r, err = Generate(Options{Unit: Words, Count: 2000, Seed: 1})
	if err != nil {
		t.Fatal(err)
	}
	if r.Words != 2000 || len(r.Paragraphs) != 1 {
		t.Errorf("got %d words in %d paragraphs", r.Words, len(r.Paragraphs))
	}
}

func TestGenerateIsDeterministic(t *testing.T) {
	opts := Options{Unit: Paragraphs, Count: 3, Seed: 42}
	a, _ := Generate(opts)
	b, _ := Generate(opts)
	if !reflect.DeepEqual(a, b) {
		t.Error("same seed gave different text")
	}
	opts.Seed = 43
	c, _ := Generate(opts)
	if reflect.DeepEqual(a.Paragraphs, c.Paragraphs) {
		t.Error("different seeds gave the same text")
	}
}

func TestGenerateInvalid(t *testing.T) {
	for _, o := range []Options{
		{Unit: "lines", Count: 1},
		{Unit: Paragraphs, Count: 0},
		{Unit: Paragraphs, Count: 51},
		{Unit: Sentences, Count: 201},
		{Unit: Words, Count: 2001},
	} {
		if _, err := Generate(o); err == nil {
			t.Errorf("%+v: want error", o)
		}
	}
}
