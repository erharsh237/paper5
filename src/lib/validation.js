// Reusable Email and Password Validation Module for SprintOS

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'tempmail.com', 'yopmail.com',
  'guerrillamail.com', 'dispostable.com', 'trashmail.com', 'getnada.com',
  'throwawaymail.com', 'sharklasers.com', 'tempmailo.com', 'maildrop.cc'
])

/**
 * Validates email format and checks for disposable domains.
 * Returns { valid: boolean, error: string | null }
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' }
  }

  const clean = email.trim().toLowerCase()
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. name@domain.com).' }
  }

  const domain = clean.split('@')[1]
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable or temporary email addresses are not permitted.' }
  }

  return { valid: true, error: null }
}

/**
 * Checks password against security requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * Returns { valid: boolean, errors: string[], requirements: object }
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required.'],
      requirements: {
        minLength: false,
        hasUpper: false,
        hasLower: false,
        hasNumber: false,
        hasSpecial: false,
      }
    }
  }

  const requirements = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }

  const errors = []
  if (!requirements.minLength) errors.push('At least 8 characters long')
  if (!requirements.hasUpper) errors.push('At least one uppercase letter (A-Z)')
  if (!requirements.hasLower) errors.push('At least one lowercase letter (a-z)')
  if (!requirements.hasNumber) errors.push('At least one number (0-9)')
  if (!requirements.hasSpecial) errors.push('At least one special character (!@#$%^&*)')

  return {
    valid: errors.length === 0,
    errors,
    requirements
  }
}
