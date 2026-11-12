import { Link } from 'react-router-dom'
import SEOHead from '../components/SEOHead'
import { getDomainConfig, getMainUrl } from '../lib/domain'
import './NotFound.css'

export default function NotFound() {
  const { isAppSubdomain } = getDomainConfig()

  return (
    <div className="lost-404-page">
      <SEOHead
        title="404 — Are you lost? | Paper5"
        description="The page you were looking for is not found. Return to Paper5 home."
        noIndex
      />

      <div className="lost-404-container">
        {/* Top Header Split: "Are you" on the left, "lost?" on the right */}
        <div className="lost-404-topbar">
          <span className="lost-404-heading-left">Are you</span>
          <span className="lost-404-heading-right">lost?</span>
        </div>

        {/* Centerpiece 4 [0-polygon] 4 row */}
        <div className="lost-404-stage">
          <div className="lost-digit lost-digit-left">4</div>

          <div className="lost-center-icon-wrap" role="img" aria-label="Geometric 404 block with locator dot">
            {/* Geometric pixel block representing the '0' */}
            <svg
              className="lost-center-svg"
              viewBox="0 0 200 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Stepped blocky polygon outer shell */}
              <path
                d="M75 10 H145 V50 H175 V130 H155 V150 H175 V180 H145 V200 H75 V180 H45 V150 H20 V90 H45 V50 H75 V10 Z"
                fill="#09090b"
                className="lost-poly-outer"
              />
              {/* Stepped inner white cutout */}
              <path
                d="M75 42 H135 V85 H145 V145 H125 V168 H75 V145 H52 V85 H75 V42 Z"
                fill="#ffffff"
                className="lost-poly-inner"
              />
              {/* Accent magenta / hot pink focal circle dot */}
              <circle
                cx="136"
                cy="110"
                r="18"
                fill="#e11d48"
                className="lost-focal-dot"
              />
            </svg>
          </div>

          <div className="lost-digit lost-digit-right">4</div>
        </div>

        {/* Bottom Framing Brackets & Action Area */}
        <div className="lost-404-bottom">
          <span className="lost-bracket lost-bracket-left">[</span>

          <div className="lost-action-center">
            <p className="lost-desc">The page you were looking for is not found.</p>

            {isAppSubdomain ? (
              <a href={getMainUrl('/')} className="lost-cta-btn">
                <span className="lost-cta-plus">+</span>
                <span>GO BACK HOME</span>
              </a>
            ) : (
              <Link to="/" className="lost-cta-btn">
                <span className="lost-cta-plus">+</span>
                <span>GO BACK HOME</span>
              </Link>
            )}
          </div>

          <span className="lost-bracket lost-bracket-right">]</span>
        </div>
      </div>
    </div>
  )
}
