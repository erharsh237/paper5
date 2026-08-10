import { useRef, useEffect, useState } from 'react'

export default function OtpInput({ 
  value = '', 
  onChange, 
  length = 8, 
  disabled = false, 
  showOtp = false,
  autoFocus = true 
}) {
  const inputsRef = useRef([])
  const [focusedIndex, setFocusedIndex] = useState(null)

  // Ensure value is padded or array of chars
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  useEffect(() => {
    if (autoFocus && !disabled && inputsRef.current[0]) {
      inputsRef.current[0].focus()
    }
  }, [autoFocus, disabled])

  const handleDigitChange = (index, val) => {
    // Sanitize digits only
    const cleanDigits = val.replace(/\D/g, '')
    if (!cleanDigits) {
      // Emptying character
      const newDigits = [...digits]
      newDigits[index] = ''
      onChange(newDigits.join(''))
      return
    }

    if (cleanDigits.length > 1) {
      // User pasted multiple digits
      const pasted = cleanDigits.slice(0, length)
      onChange(pasted)
      const nextFocus = Math.min(pasted.length, length - 1)
      if (inputsRef.current[nextFocus]) {
        inputsRef.current[nextFocus].focus()
      }
      return
    }

    // Single digit entry
    const newDigits = [...digits]
    newDigits[index] = cleanDigits
    const combined = newDigits.join('')
    onChange(combined)

    // Advance focus to next box
    if (index < length - 1 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is empty, move back and delete previous
        const newDigits = [...digits]
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        if (inputsRef.current[index - 1]) {
          inputsRef.current[index - 1].focus()
        }
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1].focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1].focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pastedData) {
      onChange(pastedData)
      const nextFocus = Math.min(pastedData.length, length - 1)
      if (inputsRef.current[nextFocus]) {
        inputsRef.current[nextFocus].focus()
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', width: '100%', margin: '8px 0 16px 0' }}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = Boolean(digits[i])
        const isFocused = focusedIndex === i

        let borderColor = '#334155' // High-contrast Slate-700 dark border
        let bg = '#ffffff'
        let shadow = '0 2px 4px rgba(0, 0, 0, 0.08)'

        if (isFocused) {
          borderColor = '#10b981' // Green focus
          shadow = '0 0 0 3px rgba(16, 185, 129, 0.3)'
        } else if (isFilled) {
          borderColor = '#10b981' // Green filled
          shadow = '0 0 0 2px rgba(16, 185, 129, 0.15)'
        }

        if (disabled) {
          bg = '#f1f5f9'
          borderColor = '#94a3b8'
          shadow = 'none'
        }

        return (
          <input
            key={i}
            ref={el => (inputsRef.current[i] = el)}
            type={showOtp ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i] || ''}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex(null)}
            disabled={disabled}
            autoComplete="one-time-code"
            style={{
              width: '100%',
              height: '48px',
              textAlign: 'center',
              fontSize: '20px',
              fontWeight: '800',
              fontFamily: 'monospace',
              borderRadius: '8px',
              border: `2px solid ${borderColor}`,
              background: bg,
              color: '#0f172a',
              outline: 'none',
              transition: 'all 0.15s ease',
              boxShadow: shadow,
              boxSizing: 'border-box'
            }}
          />
        )
      })}
    </div>
  )
}
