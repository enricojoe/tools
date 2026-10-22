// Hand-drawn decorations for the home hero. Purely visual.
export function Doodles() {
  return (
    <div className="doodles" aria-hidden="true">
      <svg className="doodle doodle-ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" strokeWidth="10" />
      </svg>
      <svg className="doodle doodle-star" viewBox="0 0 100 100">
        <path d="M50 6l12 30 32 2-25 20 9 32-28-18-28 18 9-32L6 38l32-2z" />
      </svg>
      <svg className="doodle doodle-squiggle" viewBox="0 0 160 40">
        <path
          d="M4 20c12-16 24-16 36 0s24 16 36 0 24-16 36 0 24 16 36 0"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
      <svg className="doodle doodle-plus" viewBox="0 0 40 40">
        <path d="M20 4v32M4 20h32" fill="none" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <svg className="doodle doodle-dots" viewBox="0 0 60 60">
        {[10, 30, 50].flatMap((x) =>
          [10, 30, 50].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" />),
        )}
      </svg>
    </div>
  )
}
