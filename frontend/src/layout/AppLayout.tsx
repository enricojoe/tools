import { useEffect, useRef, useState } from 'react'
import { Outlet, useMatch } from 'react-router'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { ThemeToggle } from '../theme/ThemeToggle'
import { useTheme } from '../theme/useTheme'
import { findTool } from '../tools/registry'
import { Sidebar } from './Sidebar'
import { useMediaQuery } from './useMediaQuery'
import { useStoredState } from './useStoredState'
import { useToolFavicon } from './useToolFavicon'
import './AppLayout.css'

const RECENT_LIMIT = 4

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [railChoice, setRail] = useStoredState('sidebar-rail', false)
  // The icon-only rail is a desktop thing; below 900px the sidebar is a drawer.
  const isDesktop = useMediaQuery('(min-width: 901px)')
  const rail = railChoice && isDesktop
  const [recent, setRecent] = useStoredState<string[]>('recent-tools', [])
  const searchRef = useRef<HTMLInputElement>(null)
  const { theme, toggleTheme } = useTheme()

  const currentTool = findTool(useMatch('/tools/:slug')?.params.slug)
  useToolFavicon(currentTool)

  // Remember the tools opened most recently, newest first.
  const slug = currentTool?.slug
  useEffect(() => {
    if (slug) setRecent((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, RECENT_LIMIT))
  }, [slug, setRecent])

  // "/" focuses tool search, "[" toggles the desktop rail, Escape closes the mobile drawer.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = target.closest('input, textarea, select, [contenteditable]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setMenuOpen(true)
        setRail(false)
        // Wait a frame so the search box exists and the drawer is visible on mobile.
        requestAnimationFrame(() => searchRef.current?.focus())
      } else if (e.key === '[' && isDesktop && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setRail((r) => !r)
      } else if (e.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDesktop, setRail])

  return (
    <div className="shell" data-rail={rail}>
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
        <BrandMark />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <div className="backdrop" data-open={menuOpen} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        rail={rail}
        onToggleRail={() => setRail((r) => !r)}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentTool={currentTool}
        recentSlugs={recent}
        searchRef={searchRef}
      />

      {/* Sits on the sidebar's right edge; outside the sidebar so its scroll area can't clip it. */}
      <button
        type="button"
        className="rail-toggle"
        aria-controls="sidebar"
        aria-expanded={!rail}
        aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
        title={`${rail ? 'Expand' : 'Collapse'} sidebar ( [ )`}
        onClick={() => setRail((r) => !r)}
      >
        <Icon name={rail ? 'chevronRight' : 'chevronLeft'} size={16} />
      </button>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
