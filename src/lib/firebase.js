import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

// Export a flag so App.jsx can show an error page if config is missing.
export const firebaseConfigError = missingKeys.length > 0
  ? `Missing Firebase config values: ${missingKeys.join(', ')}. Check your .env file (local) or environment variables (deployed host).`
  : null

if (firebaseConfigError) {
  console.error(firebaseConfigError)
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
// Region matches functions/index.js's deployed region — must stay in sync.
export const functions = getFunctions(app, 'us-central1')

// Initialize App Check (reCAPTCHA v3) to protect Firebase resources from abuse.
// Note: You must also register your site and enforce App Check in the Firebase Console.
if (typeof window !== 'undefined') {
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'), // Default testing key - replace with your actual key in production
      isTokenAutoRefreshEnabled: true
    })
  }).catch(err => console.warn('App Check failed to load:', err))
}
