import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Icon } from '../components/Icon'
import { ThemeToggle } from '../theme/ThemeToggle'
import { useTheme } from '../theme/useTheme'
import { groupByCategory, searchTools } from '../tools/registry'
import './AppLayout.css'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { theme, toggleTheme } = useTheme()

  const groups = groupByCategory(searchTools(query))

  // "/" focuses tool search; Escape closes the mobile drawer.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setMenuOpen(true)
        // Wait a frame so the drawer is visible (and focusable) on mobile.
        requestAnimationFrame(() => searchRef.current?.focus())
      } else if (e.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Icon name="logo" size={18} />
          </span>
          Tools
        </Link>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <div
        className="backdrop"
        data-open={menuOpen}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="sidebar"
        className="sidebar"
        data-open={menuOpen}
        // Close the mobile drawer once a link inside it is followed.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setMenuOpen(false)
        }}
      >
        <div className="sidebar-head">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Icon name="logo" size={18} />
            </span>
            Tools
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            type="button"
            className="icon-btn sidebar-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Find a tool"
            aria-label="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </label>

        <nav className="nav" aria-label="Tools">
          <NavLink to="/" end className="nav-link">
            <Icon name="home" size={18} />
            All tools
          </NavLink>

          {groups.map(([category, tools]) => (
            <div key={category} className="nav-group">
              <p className="nav-heading">{category}</p>
              {tools.map((t) => (
                <NavLink key={t.slug} to={`/tools/${t.slug}`} className="nav-link">
                  <Icon name={t.icon} size={18} />
                  {t.name}
                </NavLink>
              ))}
            </div>
          ))}

          {groups.length === 0 && <p className="nav-empty">Nothing here for "{query}" 🤔</p>}
        </nav>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
