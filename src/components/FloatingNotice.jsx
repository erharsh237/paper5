import React, { useState, useEffect } from 'react'
import { Mail, X } from 'lucide-react'
import './FloatingNotice.css'

export function triggerSpamNotice(customMessage) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paper5:show-spam-notice', {
      detail: { message: customMessage || 'Check your junk and spam' }
    }))
  }
}

export default function FloatingNotice() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('Check your junk and spam')

  useEffect(() => {
    let timer = null

    const handleShow = (e) => {
      setMessage(e.detail?.message || 'Check your junk and spam')
      setVisible(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setVisible(false)
      }, 7000)
    }

    window.addEventListener('paper5:show-spam-notice', handleShow)
    return () => {
      window.removeEventListener('paper5:show-spam-notice', handleShow)
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  return (
    <div 
      className="floating-toast-container" 
      role="alert" 
      aria-live="polite"
    >
      <div className="floating-toast-card">
        <div className="floating-toast-icon-wrap">
          <Mail size={18} />
        </div>
        <div className="floating-toast-content">
          <div className="floating-toast-title">{message}</div>
          <div className="floating-toast-desc">
            Verification emails can sometimes land in spam or promotions. Please check both folders.
          </div>
        </div>
        <button 
          type="button" 
          className="floating-toast-close" 
          onClick={() => setVisible(false)}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
