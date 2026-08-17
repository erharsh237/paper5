// tour_completed column does not exist on the users table.
// We use localStorage exclusively for tour state persistence.

export async function hasSeenTour(uid) {
  if (!uid) return true
  const local = localStorage.getItem(`tour_completed_${uid}`)
  return local === 'true'
}

export async function markTourSeen(uid) {
  if (!uid) return
  localStorage.setItem(`tour_completed_${uid}`, 'true')
}

export async function resetTourSeen(uid) {
  if (!uid) return
  localStorage.removeItem(`tour_completed_${uid}`)
}
