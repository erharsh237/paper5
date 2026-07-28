import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

// One doc per user, id = lowercase email, so "seen the tour" persists
// across devices/browsers instead of living in localStorage.
function onboardingRef(email) {
  return doc(db, 'onboarding', (email || '').toLowerCase())
}

export async function hasSeenTour(email) {
  if (!email) return true // fail safe: don't force a tour if we can't identify the user
  const snap = await getDoc(onboardingRef(email))
  return snap.exists() && snap.data()?.tourCompleted === true
}

export async function markTourSeen(email) {
  return setDoc(onboardingRef(email), {
    tourCompleted: true,
    completedAt: serverTimestamp(),
  }, { merge: true })
}

export async function resetTourSeen(email) {
  return setDoc(onboardingRef(email), {
    tourCompleted: false,
  }, { merge: true })
}
