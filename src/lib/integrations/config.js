import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// Team-shared, non-secret-ish settings (repo names, project IDs, webhook
// URLs). Webhook URLs ARE bearer-token-equivalent — anyone holding one can
// post to the channel — but that matches how Discord/Slack webhooks are
// actually meant to be used by a small trusted team, same trust level as
// this app's sprints/meetings collections.
export function subscribeIntegrationConfig(teamId, callback) {
  return onSnapshot(doc(db, 'integrationConfig', teamId), (snap) => {
    callback(snap.exists() ? snap.data() : {})
  })
}

export async function saveIntegrationConfig(teamId, patch) {
  return setDoc(doc(db, 'integrationConfig', teamId), patch, { merge: true })
}

// Personal API credentials (GitHub/Vercel personal access tokens) tied to
// one person's own account on that service — never team-readable, unlike
// integrationConfig above. Doc id is the owning user's lowercase email.
export function subscribeIntegrationCredentials(email, callback) {
  if (!email) return () => {}
  return onSnapshot(doc(db, 'integrationCredentials', email.toLowerCase()), (snap) => {
    callback(snap.exists() ? snap.data() : {})
  })
}

export async function saveIntegrationCredentials(email, patch) {
  return setDoc(doc(db, 'integrationCredentials', email.toLowerCase()), patch, { merge: true })
}
