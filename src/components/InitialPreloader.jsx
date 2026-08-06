import { useState, useEffect } from 'react'
import { Cardio } from 'ldrs/react'
import 'ldrs/react/Cardio.css'

export default function InitialPreloader({ children }) {
  const [loading, setLoading] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    // Allow website to render in the background before fading out the loader screen
    const timer = setTimeout(() => {
      setFadingOut(true)
      const removeTimer = setTimeout(() => {
        setLoading(false)
      }, 400)
      return () => clearTimeout(removeTimer)
    }, 700)

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Website renders in background */}
      {children}

      {/* Fullscreen preloader overlay */}
      {loading && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: 'var(--bg-surface, #ffffff)',
            color: 'var(--text-primary, #111827)',
            transition: 'opacity 0.35s ease, visibility 0.35s ease',
            opacity: fadingOut ? 0 : 1,
            pointerEvents: fadingOut ? 'none' : 'all',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em', color: 'var(--text-primary, #111827)' }}>
              Paper5 <span style={{ opacity: 0.6, fontWeight: 400 }}>| SprintOS</span>
            </span>
          </div>

          <Cardio
            size="50"
            stroke="4"
            speed="2"
            color="var(--accent-signal, #10b981)"
          />

          <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '11px', color: 'var(--text-tertiary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
            Loading Workspace...
          </span>
        </div>
      )}
    </>
  )
}
