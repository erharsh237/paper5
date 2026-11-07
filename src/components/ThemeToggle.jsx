import { useTheme } from '../lib/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import './ThemeToggle.css'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle-switch ${isDark ? 'is-dark' : 'is-light'} ${className}`}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-track-icon track-sun" aria-hidden="true">
          <Sun size={12} />
        </span>
        <span className="theme-toggle-track-icon track-moon" aria-hidden="true">
          <Moon size={12} />
        </span>
        <span className="theme-toggle-thumb" aria-hidden="true">
          {isDark ? (
            <Moon size={13} className="thumb-icon moon-icon" />
          ) : (
            <Sun size={13} className="thumb-icon sun-icon" />
          )}
        </span>
      </span>
      <span className="theme-toggle-tooltip" role="tooltip">
        {isDark ? 'Light mode' : 'Dark mode'}
      </span>
    </button>
  )
}
