import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, Mail, Hash, Share, PenLine, Menu } from "lucide-react"
import './bottom-menu.css'

const springConfig = {
  duration: 0.3,
  ease: "easeInOut"
}

export function MenuBar({ items, className = "", ...props }) {
  const [activeIndex, setActiveIndex] = React.useState(null)
  const menuRef = React.useRef(null)
  const [tooltipPosition, setTooltipPosition] = React.useState({ left: 0, width: 0 })
  const tooltipRef = React.useRef(null)

  React.useEffect(() => {
    if (activeIndex !== null && menuRef.current && tooltipRef.current) {
      const menuItem = menuRef.current.children[activeIndex]
      const menuRect = menuRef.current.getBoundingClientRect()
      const itemRect = menuItem.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
    
      const left = itemRect.left - menuRect.left + (itemRect.width - tooltipRect.width) / 2
    
      setTooltipPosition({
        left: Math.max(0, Math.min(left, menuRect.width - tooltipRect.width)),
        width: tooltipRect.width
      })
    }
  }, [activeIndex])

  return (
    <div className={`bottom-menu-container ${className}`} {...props}>
      <AnimatePresence>
        {activeIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={springConfig}
            className="bottom-menu-tooltip-wrapper"
          >
            <motion.div
              ref={tooltipRef}
              className="bottom-menu-tooltip"
              initial={{ x: tooltipPosition.left }}
              animate={{ x: tooltipPosition.left }}
              transition={springConfig}
              style={{ width: "auto" }}
            >
              <p className="bottom-menu-tooltip-text">
                {items[activeIndex].label}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div 
        ref={menuRef}
        className="bottom-menu-bar"
      >
        {items.map((item, index) => {
          const Icon = item.icon
          const isActive = item.isActive
          return (
            <button 
              key={index}
              className={`bottom-menu-item ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={item.action}
            >
              <div className="bottom-menu-icon-wrapper">
                <Icon className="bottom-menu-icon" />
              </div>
              <span className="sr-only">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Export a pre-configured version for our app
export const AppBottomNav = () => {
  const menuItems = [
    { icon: MessageSquare, label: "Messages" },
    { icon: Mail, label: "Inbox" },
    { icon: Hash, label: "Explore" },
    { icon: Share, label: "Share" },
    { icon: PenLine, label: "Write" },
    { icon: Menu, label: "Menu" }
  ]

  return (
    <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
      <MenuBar items={menuItems} />
    </div>
  )
}
