import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { ThemeToggle } from '../theme/ThemeToggle'
import type { Theme } from '../theme/useTheme'
import { categoryStyle, findTool, groupByCategory, searchTools, TOOLS, type Tool } from '../tools/registry'
import { useStoredState } from './useStoredState'

const TIPS = [
  'Press / anywhere to jump to the search box.',
  'Press [ to tuck the sidebar away, and again to bring it back.',
  'Search, then hit Enter to open the first match.',
  'In the stopwatch, Space starts and pauses and L takes a lap.',
  'Paste an image with Ctrl/Cmd+V in the color picker to grab its colors.',
  'Click any shade or harmony swatch to make it your current color.',
  'Hold a die in the dice roller to keep it between rolls.',
  'Alarms ring on the server clock, so every device agrees on the time.',
  'Each tab shows its tool’s icon, so it’s easy to spot among your tabs.',
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  rail: boolean
  onToggleRail: () => void
  theme: Theme
  onToggleTheme: () => void
  currentTool: Tool | undefined
  recentSlugs: string[]
  searchRef: RefObject<HTMLInputElement | null>
}

export function Sidebar({
  open,
  onClose,
  rail,
  onToggleRail,
  theme,
  onToggleTheme,
  currentTool,
  recentSlugs,
  searchRef,
}: SidebarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // Groups start folded; only the ones opened (or holding the current tool) show their links.
  const [expanded, setExpanded] = useStoredState<string[]>('sidebar-expanded', [])
  const currentCategory = currentTool?.category
  useEffect(() => {
    if (currentCategory) {
      setExpanded((prev) => (prev.includes(currentCategory) ? prev : [...prev, currentCategory]))
    }
  }, [currentCategory, setExpanded])
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null)

  const matches = searchTools(query)
  const groups = groupByCategory(matches)
  const searching = query.trim() !== ''
  const recent = recentSlugs
    .filter((slug) => slug !== currentTool?.slug)
    .map(findTool)
    .filter((t): t is Tool => t !== undefined)
    .slice(0, 3)

  function toggleGroup(category: string) {
    setExpanded(expanded.includes(category) ? expanded.filter((c) => c !== category) : [...expanded, category])
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && matches.length > 0) {
      navigate(`/tools/${matches[0].slug}`)
      setQuery('')
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      document.querySelector<HTMLElement>('#sidebar .nav-group .nav-link')?.focus()
    }
  }

  // Arrow keys move between links, and from the first link back up to the search box.
  function onNavKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const links = [...e.currentTarget.querySelectorAll<HTMLElement>('.nav-link')]
    const i = links.indexOf(document.activeElement as HTMLElement)
    if (i === -1) return
    e.preventDefault()
    const next = links[i + (e.key === 'ArrowDown' ? 1 : -1)]
    if (next) next.focus()
    else if (e.key === 'ArrowUp' && !rail) searchRef.current?.focus()
  }

  // In rail mode labels are hidden, so a tooltip names the link being hovered or focused.
  function showTooltip(target: EventTarget) {
    if (!rail) return
    const el = (target as HTMLElement).closest<HTMLElement>('[data-tip]')
    if (!el) return setTooltip(null)
    const box = el.getBoundingClientRect()
    setTooltip({ label: el.dataset.tip ?? '', top: box.top + box.height / 2 })
  }

  function navLink(t: Tool, key = t.slug) {
    return (
      <NavLink
        key={key}
        to={`/tools/${t.slug}`}
        className="nav-link cat"
        style={categoryStyle(t.category)}
        data-tip={t.name}
        aria-label={rail ? t.name : undefined}
      >
        <span className="nav-icon">
          <Icon name={t.icon} size={16} />
        </span>
        <span className="nav-label">{t.name}</span>
      </NavLink>
    )
  }

  return (
    <aside
      id="sidebar"
      className="sidebar"
      data-open={open}
      data-rail={rail}
      // Close the mobile drawer once a link inside it is followed.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) onClose()
      }}
      onPointerOver={(e) => showTooltip(e.target)}
      onPointerLeave={() => setTooltip(null)}
      onFocus={(e) => showTooltip(e.target)}
      onBlur={() => setTooltip(null)}
      onScroll={() => setTooltip(null)}
    >
      <div className="sidebar-head">
        <BrandMark />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button type="button" className="icon-btn sidebar-close" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="search-wrap">
        {rail ? (
          <button
            type="button"
            className="icon-btn rail-search"
            aria-label="Search tools"
            data-tip="Search ( / )"
            onClick={() => {
              onToggleRail()
              requestAnimationFrame(() => searchRef.current?.focus())
            }}
          >
            <Icon name="search" size={18} />
          </button>
        ) : (
          <label className="search">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Find a tool"
              aria-label="Search tools"
              aria-describedby="sidebar-search-status"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <kbd>/</kbd>
          </label>
        )}
        <p id="sidebar-search-status" className="search-status" aria-live="polite">
          {searching && !rail && matches.length > 0 && (
            <>
              {matches.length} {matches.length === 1 ? 'match' : 'matches'} · <kbd>Enter</kbd> opens{' '}
              <strong>{matches[0].name}</strong>
            </>
          )}
        </p>
      </div>

      <nav className="nav" aria-label="Tools" onKeyDown={onNavKeyDown}>
        <NavLink to="/" end className="nav-link nav-home" data-tip="All tools" aria-label={rail ? 'All tools' : undefined}>
          <span className="nav-icon">
            <Icon name="home" size={16} />
          </span>
          <span className="nav-label">All tools</span>
        </NavLink>

        {!searching && recent.length > 0 && (
          <div className="nav-group nav-recent">
            <p className="nav-heading">
              <Icon name="clock" size={14} />
              <span className="nav-heading-text">Recent</span>
            </p>
            {recent.map((t) => navLink(t, `recent-${t.slug}`))}
          </div>
        )}

        {groups.map(([category, tools]) => {
          const isOpen = searching || rail || expanded.includes(category)
          const id = `nav-group-${category.toLowerCase()}`
          return (
            <div key={category} className="nav-group cat" style={categoryStyle(category)}>
              <button
                type="button"
                className="nav-heading"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => toggleGroup(category)}
                disabled={searching || rail}
              >
                <span className="nav-dot" />
                <span className="nav-heading-text">{category}</span>
                <span className="nav-count">{tools.length}</span>
                <Icon name="chevronDown" size={14} className="nav-chevron" />
              </button>
              {isOpen && (
                <div id={id} className="nav-items">
                  {tools.map((t) => navLink(t))}
                </div>
              )}
            </div>
          )
        })}

        {groups.length === 0 && <p className="nav-empty">Nothing here for “{query}” 🤔</p>}
      </nav>

      <footer className="sidebar-foot">
        <div className="tip-card">
          <p className="tip-title">
            <Icon name="bulb" size={16} />
            Psst, a tip
            <button
              type="button"
              className="icon-btn tip-next"
              aria-label="Show another tip"
              title="Another tip"
              onClick={() => setTipIndex((tipIndex + 1) % TIPS.length)}
            >
              <Icon name="shuffle" size={16} />
            </button>
          </p>
          <p key={tipIndex} className="tip-text">
            {TIPS[tipIndex]}
          </p>
        </div>
        <p className="tool-tally">
          <strong>{TOOLS.length}</strong> tools and counting ✨
        </p>
      </footer>

      {rail && tooltip && (
        <span className="rail-tip" role="presentation" style={{ top: tooltip.top }}>
          {tooltip.label}
        </span>
      )}
    </aside>
  )
}
