import { useEffect, useRef } from 'react'

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6']

export default function PricingConfetti({ targetId = 'launch-offer' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const target = document.getElementById(targetId)
    const canvas = canvasRef.current
    if (!target || !canvas) return

    let rafId = null
    let running = false

    const startAnimation = () => {
      if (running) return
      running = true
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const resize = () => {
        canvas.width = target.offsetWidth || window.innerWidth
        canvas.height = target.offsetHeight || 220
      }
      resize()

      const makeParticle = (initial = false) => ({
        x: Math.random() * canvas.width,
        y: initial ? Math.random() * canvas.height : -12,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.2 + Math.random() * 2.1,
        w: 6 + Math.random() * 5,
        h: 4 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.1,
        opacity: 0.45 + Math.random() * 0.45
      })

      const particles = Array.from({ length: 48 }, () => makeParticle(true))

      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          p.x += p.vx
          p.y += p.vy
          p.rotation += p.vRot
          if (p.y > canvas.height + 16) {
            particles[i] = makeParticle(false)
          }
          ctx.save()
          ctx.globalAlpha = p.opacity
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          ctx.restore()
        }
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startAnimation()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(target)

    return () => {
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [targetId])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  )
}
