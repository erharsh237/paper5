import { useEffect, useRef } from 'react'

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6']

export default function PricingConfetti({ targetId = 'pricing' }) {
  const canvasRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const target = document.getElementById(targetId)
    const canvas = canvasRef.current
    if (!target || !canvas) return

    const launch = () => {
      if (firedRef.current) return
      firedRef.current = true

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = (canvas.width = target.offsetWidth || window.innerWidth)
      const height = (canvas.height = 360)

      const particles = Array.from({ length: 64 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
        const speed = 4 + Math.random() * 6.5
        return {
          x: width / 2 + (Math.random() - 0.5) * 180,
          y: 90,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          life: 1
        }
      })

      let rafId = null
      const tick = () => {
        ctx.clearRect(0, 0, width, height)
        let alive = false
        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.18
          p.vx *= 0.99
          p.rotation += p.vRot
          p.life -= 0.012
          if (p.life <= 0) continue
          alive = true
          ctx.save()
          ctx.globalAlpha = Math.max(0, p.life)
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55)
          ctx.restore()
        }
        if (alive) {
          rafId = requestAnimationFrame(tick)
        } else {
          ctx.clearRect(0, 0, width, height)
        }
      }
      rafId = requestAnimationFrame(tick)
      return () => {
        if (rafId) cancelAnimationFrame(rafId)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          launch()
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(target)

    return () => observer.disconnect()
  }, [targetId])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '360px',
        pointerEvents: 'none',
        zIndex: 2
      }}
    />
  )
}
