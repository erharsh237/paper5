import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import logo from '../assets/securiq-logo.png'
import './NotFound.css'

const GRID = ['·', '·', '·', '·', 'not_started', 'hit', '·', '·', '·', 'not_started', '·', '·', '·', '·', '·', '·']

export default function NotFound() {
  const cells = useMemo(() => GRID, [])

  return (
    <div className="nf-wrap">
      <div className="nf-card">
        <img src={logo} alt="Securiq" className="nf-logo" />

        <div className="nf-badge">
          <span className="nf-dot" />
          404 · Overdue
        </div>

        <h1 className="nf-title">This page missed its deadline.</h1>
        <p className="nf-sub">
          Whatever you were looking for was never assigned to this URL.
          Still "not started."
        </p>

        <div className="nf-grid" role="img" aria-label="A 4 by 4 grid representing this missing page, mostly empty with one marked cell">
          {cells.map((c, i) => (
            <div key={i} className={`nf-cell ${c === 'hit' ? 'nf-cell--hit' : ''}`}>
              {c === 'hit' ? '✕' : ''}
            </div>
          ))}
        </div>

        <Link to="/" className="nf-cta">
          Back to the dashboard →
        </Link>

        <div className="nf-footnote mono">assigned by nobody · status: gone</div>
      </div>
    </div>
  )
}
