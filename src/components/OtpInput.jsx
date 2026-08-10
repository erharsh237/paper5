import { useRef, useEffect } from 'react'

export default function OtpInput({ 
  value = '', 
  onChange, 
  length = 8, 
  disabled = false, 
  showOtp = false,
  autoFocus = true 
}) {
  const inputsRef = useRef([])

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
      {Array.from({ length }).map((_, i) => (
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
          disabled={disabled}
          autoComplete="one-time-code"
          style={{
            width: '100%',
            height: '46px',
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: '700',
            fontFamily: 'monospace',
            borderRadius: '8px',
            border: digits[i] ? '2px solid #10b981' : '1px solid var(--border-bright, #d1d5db)',
            background: disabled ? 'var(--bg-layer-2, #f3f4f6)' : 'var(--bg-layer-1, #ffffff)',
            color: 'var(--text-primary, #111827)',
            outline: 'none',
            transition: 'all 0.15s ease',
            boxShadow: digits[i] ? '0 0 0 3px rgba(16, 185, 129, 0.12)' : 'none'
          }}
        />
      ))}
    </div>
  )
}
