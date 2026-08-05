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

/**
 * Validates username format, length, allowed characters, and reserved names.
 * Returns { valid: boolean, error: string | null }
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required.' }
  }

  const clean = username.trim()

  if (clean.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' }
  }

  if (clean.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters.' }
  }

  const validRegex = /^[a-zA-Z0-9_-]+$/
  if (!validRegex.test(clean)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores (_), and hyphens (-).' }
  }

  const startEndRegex = /^[a-zA-Z0-9].*[a-zA-Z0-9]$/
  if (clean.length > 1 && !startEndRegex.test(clean)) {
    return { valid: false, error: 'Username must start and end with a letter or number.' }
  }

  if (/([_-])\1/.test(clean)) {
    return { valid: false, error: 'Username cannot contain consecutive underscores or hyphens.' }
  }

  const RESERVED_USERNAMES = new Set([
    // Admin / Auth variations & typos
    'admin', 'administrator', 'asdmin', 'admn', 'adm', 'addmin', 'admiin', 'superadmin', 'sysadmin', 
    'siteadmin', 'webmaster', 'mod', 'moderator', 'owner', 'founder', 'ceo', 'cto', 'cfo', 'coo', 'tech',
    'root', 'support', 'help', 'billing', 'security', 'api', 'system', 'auth', 'oauth', 'login', 'signup',
    'null', 'undefined', 'void', 'bot', 'robot', 'service', 'official',

    // Generic placeholder names
    'user', 'users', 'test', 'tester', 'testing', 'testuser', 'guest', 'demo', 'sample', 
    'account', 'anon', 'anonymous', 'temp', 'temporary', 'member', 'client', 'customer', 
    'person', 'name', 'username', 'profile', 'someone', 'nobody', 'anyone', 'everyone',

    // Keyboard mash & low-effort strings
    'qwerty', 'asdf', 'asdfgh', 'zxcv', '123456', 'abc', 'abcd', '1234', '12345', '0000', '1111',

    // Brand & Application terms
    'paper5', 'sprintos', 'sprint-os', 'paper5app', 'paper5team', 'paper5support'
  ])

  const lower = clean.toLowerCase()
  if (RESERVED_USERNAMES.has(lower)) {
    return { valid: false, error: 'This username is reserved or too generic and cannot be used.' }
  }

  // Check if username is purely a generic word + digits (e.g., user123, test99, admin007, demo1)
  if (/^(user|admin|asdmin|admn|test|demo|guest|temp|account|sample|qwerty|asdf)[0-9_]*$/i.test(clean)) {
    return { valid: false, error: 'Generic usernames (like user, admin, test, demo) are not permitted.' }
  }

  return { valid: true, error: null }
}
