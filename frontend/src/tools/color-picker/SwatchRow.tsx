interface SwatchRowProps {
  colors: string[]
  /** The color currently picked, to mark its swatch. */
  current: string
  onPick: (hex: string) => void
}

/** A row of clickable color swatches that set the current color. */
export function SwatchRow({ colors, current, onPick }: SwatchRowProps) {
  return (
    <ul className="cp-swatches">
      {colors.map((hex, i) => (
        <li key={`${hex}-${i}`}>
          <button
            type="button"
            className="cp-swatch"
            style={{ background: hex }}
            aria-label={`Use ${hex}`}
            aria-pressed={hex.toUpperCase() === current.toUpperCase()}
            title={hex.toUpperCase()}
            onClick={() => onPick(hex)}
          />
        </li>
      ))}
    </ul>
  )
}
