import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import logo from '../assets/logo.png'
import './NotFound.css'

const GRID = ['·', '·', '·', '·', 'not_started', 'hit', '·', '·', '·', 'not_started', '·', '·', '·', '·', '·', '·']

export default function NotFound() {
  const cells = useMemo(() => GRID, [])

  return (
    <div className="nf-wrap">
      <div className="nf-card glass-panel">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)', marginBottom: '20px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Paper5 <span style={{ opacity: 0.5, fontWeight: 400 }}>| SprintOS</span>
        </div>

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
