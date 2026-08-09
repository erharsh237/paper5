import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

/**
 * Cloudflare Turnstile Invisible Anti-Bot Challenge Token Component
 * ─────────────────────────────────────────────────────────────────
 * Generates high-entropy single-use anti-bot challenge tokens before form submission.
 * Uses Cloudflare's official test sitekey (1x00000000000000000000AA) by default,
 * which can be overridden by VITE_TURNSTILE_SITE_KEY in production.
 */
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA'

const Turnstile = forwardRef(({ onSuccess, onError, onExpire, action = 'submit' }, ref) => {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current)
        } catch {
          // ignore reset errors
        }
      }
    }
  }))

  useEffect(() => {
    let isMounted = true

    const renderWidget = () => {
      if (!containerRef.current || widgetIdRef.current !== null || !window.turnstile) return

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          size: 'invisible',
          callback: (token) => {
            if (isMounted && onSuccess) onSuccess(token)
          },
          'error-callback': (err) => {
            if (isMounted && onError) onError(err)
          },
          'expired-callback': () => {
            if (isMounted && onExpire) onExpire()
          }
        })
      } catch (err) {
        console.warn('[Turnstile] Render error:', err)
      }
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      const existingScript = document.getElementById('cf-turnstile-script')
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = 'cf-turnstile-script'
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = () => {
          if (isMounted) renderWidget()
        }
        document.head.appendChild(script)
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) renderWidget()
        })
      }
    }

    return () => {
      isMounted = false
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore removal errors
        }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, action, onSuccess, onError, onExpire])

  return <div ref={containerRef} style={{ display: 'none' }} />
})

Turnstile.displayName = 'Turnstile'

export default Turnstile
