# Frontend Lessons

- **Context:** Adding several features (recolor, compare, SVG → JSX) to an existing tool page.
- **Mistake:** Added each feature as its own stacked card: one column ran very long while the other ended early, Recolor repeated the color swatches already shown in Details, and Compare had four cards with mixed controls and a pink table row that read like an error. The user said the UI/UX "felt not good".
- **Correct Pattern:** Before adding a card, fit the feature into what's there: act on existing elements (click a swatch to edit it) instead of repeating them, group related outputs in one tabbed card, keep both columns balanced (and check the phone order), put a view's controls in one toolbar row, show differences compactly and fold long secondary detail. Look at full-page screenshots for balance and repetition, not only for "does it render".

- **Context:** Redesigning the same SVG viewer after the user found the tidied card layout still "meh" and asked to "be more creative".
- **Mistake:** Answered UI feedback by rearranging and trimming generic cards; the result was tidy but had no character, in an app whose look is deliberately playful.
- **Correct Pattern:** When the feedback is about feel, change the concept, not the card order: make the content the hero (a big artboard), put controls where they act (docks on the board, pots next to the art), use direct manipulation and live previews, and carry the app's own visual language (stickers, tilts, offset shadows, toasts). Offer two or three distinct directions with previews before a big rebuild.
