import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// To run this script, you must have a service account key JSON file.
// Usage: node scripts/migrate-to-multitenant.js --key path/to/serviceAccountKey.json [--dry-run]

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keyArgIndex = args.indexOf('--key');

if (keyArgIndex === -1 || !args[keyArgIndex + 1]) {
  console.error("Usage: node migrate-to-multitenant.js --key path/to/serviceAccountKey.json [--dry-run]");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(args[keyArgIndex + 1], 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const DEFAULT_WORKSPACE_ID = 'default-workspace';
const DEFAULT_WORKSPACE_NAME = 'Default Workspace';

// Collections to migrate to subcollections
const collectionsToMigrate = [
  'deadlines',
  'sprints',
  'meetings',
  'reflections',
  'roles',
  'notifications',
  'integrationConfig',
  'teamSettings',
  'integrationCredentials',
  'onboarding',
  'profiles'
];

async function migrate() {
  console.log(`Starting migration... Dry run: ${dryRun}`);

  if (!dryRun) {
    // Create the default workspace
    console.log(`Creating default workspace: ${DEFAULT_WORKSPACE_ID}`);
    await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID).set({
      name: DEFAULT_WORKSPACE_NAME,
      createdAt: new Date(),
      billing: {
        status: 'active', // or 'free' based on your decision
        planId: 'legacy_free'
      }
    });
  }

  // 1. Migrate Users & Members
  console.log("Migrating users from allowedUsers and existing members collection...");
  const allowedUsersSnap = await db.collection('allowedUsers').get();
  const adminsSnap = await db.collection('admins').get();
  const adminsSet = new Set(adminsSnap.docs.map(doc => doc.id.toLowerCase()));
  
  // Create user docs and members
  for (const doc of allowedUsersSnap.docs) {
    const email = doc.id.toLowerCase();
    const role = adminsSet.has(email) || ['erharsh237@gmail.com', 'kanishkaldh@gmail.com', 'shrutisinha2205@gmail.com'].includes(email) ? 'admin' : 'member';
    
    // In legacy, we only had email for auth. If users exist in Firebase Auth, they have UIDs.
    // For this script, we assume uid === email or we must fetch by email.
    // WARNING: This script uses email as the user ID for simplicity if UID mapping is not available.
    // If you have Firebase Auth UIDs, you should map them here!
    const userId = email; // Replace this with Auth UID lookup if possible.

    console.log(`- User: ${email}, Role: ${role}`);
    
    if (!dryRun) {
      // Create userWorkspaces lookup
      await db.collection('userWorkspaces').doc(userId).collection('workspaces').doc(DEFAULT_WORKSPACE_ID).set({
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME,
        role: role
      });

      // Create workspace member
      await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID).collection('members').doc(userId).set({
        role: role,
        joinedAt: new Date(),
        email: email
      });
    }
  }
  
  // Note: We need at least one owner. Let's make erharsh237@gmail.com the owner as an example.
  if (!dryRun) {
    await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID).collection('members').doc('erharsh237@gmail.com').update({
      role: 'owner'
    });
    await db.collection('userWorkspaces').doc('erharsh237@gmail.com').collection('workspaces').doc(DEFAULT_WORKSPACE_ID).update({
      role: 'owner'
    });
  }

  // 2. Migrate Domain Collections
  for (const collectionName of collectionsToMigrate) {
    console.log(`Migrating collection: ${collectionName}...`);
    const snap = await db.collection(collectionName).get();
    console.log(`  Found ${snap.size} documents.`);
    
    let migratedCount = 0;
    
    for (const doc of snap.docs) {
      if (!dryRun) {
        // Deep copy subcollections if any (e.g. deadlines/evidence)
        if (collectionName === 'deadlines') {
          const evidenceSnap = await doc.ref.collection('evidence').get();
          for (const evDoc of evidenceSnap.docs) {
            await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID)
                    .collection('deadlines').doc(doc.id)
                    .collection('evidence').doc(evDoc.id).set(evDoc.data());
          }
          
          const extraWorkSnap = await doc.ref.collection('extraWork').get();
          for (const ewDoc of extraWorkSnap.docs) {
            await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID)
                    .collection('deadlines').doc(doc.id)
                    .collection('extraWork').doc(ewDoc.id).set(ewDoc.data());
          }
        }
        
        // Copy main document
        await db.collection('workspaces').doc(DEFAULT_WORKSPACE_ID).collection(collectionName).doc(doc.id).set(doc.data());
      }
      migratedCount++;
    }
    
    console.log(`  Migrated ${migratedCount} documents.`);
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);
