import { useState } from 'react'

export type Theme = 'light' | 'dark'

// Must match the key read by the inline script in index.html.
const THEME_KEY = 'theme'

// index.html sets data-theme before React loads (saved choice, else system preference).
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage blocked (e.g. private mode): the choice lasts for this visit only.
    }
    setTheme(next)
  }

  return { theme, toggleTheme }
}
