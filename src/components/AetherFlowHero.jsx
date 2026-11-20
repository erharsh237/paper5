import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'
import './AetherFlowHero.css'

export default function AetherFlowHero({
  onGetStarted = () => {},
  onExplore = () => {}
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrameId
    let particles = []
    const mouse = { x: null, y: null, radius: 200 }

    const isDarkMode = () => {
      return document.documentElement.getAttribute('data-theme') === 'dark'
    }

    class Particle {
      constructor(x, y, directionX, directionY, size, color) {
        this.x = x
        this.y = y
        this.directionX = directionX
        this.directionY = directionY
        this.size = size
        this.color = color
      }

      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false)
        ctx.fillStyle = this.color
        ctx.fill()
      }

      update() {
        if (this.x > canvas.width || this.x < 0) {
          this.directionX = -this.directionX
        }
        if (this.y > canvas.height || this.y < 0) {
          this.directionY = -this.directionY
        }

        // Mouse collision & repulsion
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x
          const dy = mouse.y - this.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < mouse.radius + this.size) {
            const forceDirectionX = dx / distance
            const forceDirectionY = dy / distance
            const force = (mouse.radius - distance) / mouse.radius
            this.x -= forceDirectionX * force * 4.5
            this.y -= forceDirectionY * force * 4.5
          }
        }

        this.x += this.directionX
        this.y += this.directionY
        this.draw()
      }
    }

    function init() {
      particles = []
      const dark = isDarkMode()
      const numberOfParticles = Math.min(110, Math.max(35, (canvas.height * canvas.width) / 10000))

      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2.2 + 1
        const x = Math.random() * (canvas.width - size * 4) + size * 2
        const y = Math.random() * (canvas.height - size * 4) + size * 2
        const directionX = Math.random() * 0.45 - 0.225
        const directionY = Math.random() * 0.45 - 0.225

        const color = dark
          ? 'rgba(192, 132, 252, 0.85)'
          : 'rgba(99, 102, 241, 0.75)'

        particles.push(new Particle(x, y, directionX, directionY, size, color))
      }
    }

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth
      canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight
      init()
    }
    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    const connect = () => {
      const dark = isDarkMode()
      const maxDist = (canvas.width / 7.5) * (canvas.height / 7.5)

      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x
          const dy = particles[a].y - particles[b].y
          const distance = dx * dx + dy * dy

          if (distance < maxDist) {
            const opacityValue = 1 - distance / 22000

            const dx_mouse = mouse.x ? particles[a].x - mouse.x : 9999
            const dy_mouse = mouse.y ? particles[a].y - mouse.y : 9999
            const mouseDist = Math.sqrt(dx_mouse * dx_mouse + dy_mouse * dy_mouse)

            if (mouse.x && mouseDist < mouse.radius) {
              ctx.strokeStyle = dark
                ? `rgba(255, 255, 255, ${opacityValue * 0.95})`
                : `rgba(79, 70, 229, ${opacityValue * 0.85})`
            } else {
              ctx.strokeStyle = dark
                ? `rgba(192, 132, 252, ${opacityValue * 0.35})`
                : `rgba(99, 102, 241, ${opacityValue * 0.28})`
            }

            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particles[a].x, particles[a].y)
            ctx.lineTo(particles[b].x, particles[b].y)
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const dark = isDarkMode()

      // Fill canvas background with Paper5 theme color
      ctx.fillStyle = dark ? '#09090b' : '#f4f1ed'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        particles[i].update()
      }
      connect()
    }

    const handleMouseMove = (event) => {
      mouse.x = event.clientX
      mouse.y = event.clientY
    }

    const handleMouseOut = () => {
      mouse.x = null
      mouse.y = null
    }

    const handleTouchMove = (event) => {
      if (event.touches.length > 0) {
        mouse.x = event.touches[0].clientX
        mouse.y = event.touches[0].clientY
      }
    }

    const handleTouchEnd = () => {
      mouse.x = null
      mouse.y = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)

    init()
    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 24,
      filter: 'blur(6px)',
      scale: 0.95,
    },
    visible: (customDelay) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      scale: 1,
      transition: {
        duration: 0.65,
        delay: customDelay,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  }

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.18 + 0.3,
        duration: 0.75,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  }

  return (
    <section id="hero" className="aether-hero-container hero-section">
      {/* Interactive Canvas Background */}
      <canvas ref={canvasRef} className="aether-canvas" />

      {/* Foreground Content */}
      <div className="aether-content">
        <h1 
          className="aether-headline" 
          aria-label="Your team. Your work. One place to make it happen."
        >
          <span className="aether-headline-row1">
            <motion.span custom={0.12} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">Your</motion.span>{' '}
            <motion.span custom={0.22} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">team.</motion.span>{' '}
            <motion.span custom={0.34} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">Your</motion.span>{' '}
            <motion.span custom={0.44} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">work.</motion.span>
          </span>
          <span className="aether-headline-row2">
            <motion.span custom={0.58} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">One</motion.span>{' '}
            <motion.span custom={0.68} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">place</motion.span>{' '}
            <motion.span custom={0.78} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">to</motion.span>{' '}
            <motion.span custom={0.88} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">make</motion.span>{' '}
            <motion.span custom={0.98} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">it</motion.span>{' '}
            <motion.span custom={1.08} variants={wordVariants} initial="hidden" animate="visible" className="aether-word">happen.</motion.span>
          </span>
        </h1>

        <motion.p
          custom={2}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="aether-subtext"
        >
          Bring your people, projects, and daily tasks together. Stay organized, work in sync, and move forward faster with Paper5.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="aether-cta-row"
        >
          <button
            className="aether-btn-primary"
            onClick={onGetStarted}
          >
            <span>Get Started</span>
            <ArrowRight size={16} />
          </button>
          <a
            href="#problem"
            onClick={onExplore}
            className="aether-btn-ghost"
          >
            <span>Explore Platform</span>
          </a>
        </motion.div>

        <motion.div
          custom={3.5}
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="aether-hero-trust-badges"
        >
          <span>Free during launch</span>
          <span className="dot-sep" aria-hidden="true">•</span>
          <span>No credit card required</span>
        </motion.div>
      </div>
    </section>
  )
}
