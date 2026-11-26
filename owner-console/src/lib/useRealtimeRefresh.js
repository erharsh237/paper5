import { useEffect, useRef } from 'react'

/**
 * Subscribes a module to the global `owner:realtime-sync` event emitted by App.jsx
 * when Supabase Realtime detects DB changes or on background sync ticks.
 */
export function useRealtimeRefresh(callback, tables = null) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const handler = (e) => {
      const changedTable = e?.detail?.table
      if (Array.isArray(tables) && tables.length > 0 && changedTable && changedTable !== '*') {
        if (!tables.includes(changedTable)) return
      }
      cbRef.current?.()
    }
    window.addEventListener('owner:realtime-sync', handler)
    return () => window.removeEventListener('owner:realtime-sync', handler)
  }, [Array.isArray(tables) ? tables.join(',') : '*'])
}
