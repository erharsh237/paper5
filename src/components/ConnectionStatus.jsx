import { useEffect, useState } from 'react'
import './ConnectionStatus.css'

// Network Information API isn't available in every browser (notably
// Safari/Firefox) — treat its absence as "unknown," never as "slow."
function getEffectiveType() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return conn?.effectiveType || null
}

export default function ConnectionStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [isSlow, setIsSlow] = useState(['slow-2g', '2g'].includes(getEffectiveType()))

  useEffect(() => {
    function handleOnline() { setIsOffline(false) }
    function handleOffline() { setIsOffline(true) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    function handleConnectionChange() {
      setIsSlow(['slow-2g', '2g'].includes(getEffectiveType()))
    }
    conn?.addEventListener?.('change', handleConnectionChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      conn?.removeEventListener?.('change', handleConnectionChange)
    }
  }, [])

  if (isOffline) {
    return (
      <div className="conn-banner conn-banner--offline">
        You're offline. Changes will sync once your connection is back.
      </div>
    )
  }

  if (isSlow) {
    return (
      <div className="conn-banner conn-banner--slow">
        Slow connection detected — things may take longer than usual to load or save.
      </div>
    )
  }

  return null
}
