import { useState } from 'react'
import { Link } from 'react-router'
import { Doodles } from '../components/Doodles'
import { Icon } from '../components/Icon'
import { groupByCategory, searchTools } from '../tools/registry'
import './pages.css'

export function HomePage() {
  const [query, setQuery] = useState('')
  const groups = groupByCategory(searchTools(query))

  return (
    <div className="page">
      <title>Tools</title>
      <header className="hero">
        <Doodles />
        <p className="kicker">
          Hey there <span className="wave">👋</span>
        </p>
        <h1>
          What are we{' '}
          <span className="scribble">
            making
            <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
              <path d="M3 14c40-9 90-12 130-8s50 3 64-2" />
            </svg>
          </span>{' '}
          today?
        </h1>
        <p className="lead">A little toolbox of handy helpers. Pick one and get going!</p>
        <label className="search search-lg">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Try “qr” or “link”…"
            aria-label="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      {groups.map(([category, tools]) => (
        <section key={category} className="tool-section" aria-label={category}>
          <h2 className="section-title">
            {category}
            <span className="count">{tools.length}</span>
          </h2>
          <ul className="tool-grid">
            {tools.map((t) => (
              <li key={t.slug}>
                <Link to={`/tools/${t.slug}`} className="tool-card">
                  <span className="tool-icon">
                    <Icon name={t.icon} size={24} />
                  </span>
                  <span className="tool-card-body">
                    <span className="tool-card-title">{t.name}</span>
                    <span className="tool-card-desc">{t.description}</span>
                  </span>
                  <Icon name="arrow" size={18} className="tool-card-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="empty-state">
          Hmm, nothing matches “{query}” 🤔 Try another word?
        </p>
      )}
    </div>
  )
}
