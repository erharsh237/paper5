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

// Previously this threw synchronously, which happens during module import —
// before ReactDOM ever renders — so the ErrorBoundary couldn't catch it and
// the user just got a blank white screen with a console error. Exporting a
// flag instead lets App.jsx show an actual configuration-error page.
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
