import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('p5_visitor_id')
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2, 9)
    sessionStorage.setItem('p5_visitor_id', id)
  }
  return id
}

export function useLivePresenceTracker() {
  const location = useLocation()
  const { user } = useAuth()
  const channelRef = useRef(null)
  const visitorIdRef = useRef(getOrCreateVisitorId())

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return

    let cancelled = false
    const visitorId = visitorIdRef.current
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent)
    const refHost = document.referrer ? (new URL(document.referrer, window.location.origin).hostname || 'Direct') : 'Direct'

    const payload = {
      visitorId,
      userId: user?.id || null,
      email: user?.email || 'Anonymous Visitor',
      name: user?.displayName || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Visitor'),
      page: location.pathname || '/',
      referrer: refHost,
      device: isMobile ? 'Mobile' : 'Desktop',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Defer presence tracking so it never blocks page load or initial render
    const timer = setTimeout(() => {
      if (cancelled) return

      if (!channelRef.current) {
        const channel = supabase.channel('paper5-live-visitors', {
          config: { presence: { key: visitorId } }
        })

        channel
          .on('presence', { event: 'sync' }, () => {})
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && !cancelled) {
              try {
                await channel.track(payload)
              } catch (e) {
                console.warn('Presence track error:', e)
              }
            }
          })

        channelRef.current = channel
      } else {
        channelRef.current.track(payload).catch(() => {})
      }
    }, 2500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [location.pathname, user?.id, user?.email])

  useEffect(() => {
    const handleUnload = () => {
      if (channelRef.current) {
        channelRef.current.untrack()
        supabase.removeChannel(channelRef.current)
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      if (channelRef.current) {
        channelRef.current.untrack()
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])
}
