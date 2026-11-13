import { Link } from 'react-router'

/** The app's logo (a toolbox on a sticker tile, same art as `public/favicon.svg`) plus its name. */
export function BrandMark() {
  return (
    <Link to="/" className="brand" aria-label="Tools home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
          <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path className="brand-handle" d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5" />
            <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
            <path d="M3.5 12.5h17" />
          </g>
          <rect className="brand-latch" x="10" y="10.5" width="4" height="4" rx="1.2" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      </span>
      <span className="brand-name">Tools</span>
    </Link>
  )
}
