# Sentinel — Deadline Tracker

Free, serverless, fully responsive deadline tracker for your team. React + Firebase + EmailJS. $0/month for small teams.

## 1. Firebase setup (free Spark plan)

1. Go to https://console.firebase.google.com → **Add project** → name it, disable Analytics if you want (optional).
2. **Build > Authentication** → Get started → enable **Google** sign-in provider.
3. **Build > Firestore Database** → Create database → start in **production mode** → pick a region.
4. Go to **Project settings** (gear icon) → scroll to "Your apps" → click the `</>` web icon → register app → copy the config values.
5. Paste those values into `.env` (copy from `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
6. In Firestore → **Rules**, deploy the production rules from `firestore.rules` in this project. This project uses an **explicit email allowlist** (not domain matching) since the team signs in with personal Gmail addresses — see the setup checklist below for exact steps to add team members to the allowlist.
7. Firestore will ask you to create an index the first time you load deadlines (console error gives you a direct link) — click it, takes ~1 min to build.

## 2. EmailJS setup (free tier, 200 emails/month)

1. Sign up at https://www.emailjs.com
2. **Email Services** → Add new service → choose **Gmail** → connect your Gmail account (OAuth, no password stored in code).
3. **Email Templates** → Create new template. Use these variable names (matching `src/lib/email.js`):
   - `{{to_name}}`, `{{to_email}}`, `{{task_title}}`, `{{task_description}}`, `{{due_date}}`, `{{priority}}`, `{{assigned_by}}`, `{{app_url}}`
   - Example subject: `New deadline assigned: {{task_title}}`
   - Example body:
     ```
     Hi {{to_name}},

     You've been assigned a new deadline by {{assigned_by}}.

     Task: {{task_title}}
     Priority: {{priority}}
     Due: {{due_date}}

     Details:
     {{task_description}}

     View it here: {{app_url}}
     ```
   - **Important**: set the template's "To email" field to `{{to_email}}` in the template settings.
4. **Account** → copy your **Public Key**.
5. Fill in `.env`:
   ```
   VITE_EMAILJS_SERVICE_ID=service_xxxxx
   VITE_EMAILJS_TEMPLATE_ID=template_xxxxx
   VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
   ```

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 4. Deploy free

**Vercel** (recommended):
```bash
npm i -g vercel
vercel
```
Add the same env vars in the Vercel dashboard under Project Settings → Environment Variables.

**Netlify**: drag-drop the `dist/` folder after `npm run build`, or connect the repo — same env vars in Site settings.

## 5. Before pushing to production — checklist

- [ ] **Never commit `.env`** — it's already in `.gitignore`. Only `.env.example` (no real values) goes in git.
- [ ] **Deploy Firestore rules**: copy `firestore.rules` into Firebase Console → Firestore Database → Rules → Publish. This uses an explicit allowlist, field validation, and owner-only delete instead of "any signed-in user can do anything."
- [ ] **Populate the allowlist** — this is the critical step, because your team signs in with personal Gmail rather than a shared company domain:
  1. Firebase Console → Firestore Database → Data tab → **Start collection** → name it `allowedUsers`.
  2. For each team member, **Add document** → set the **Document ID** to their exact Gmail address in lowercase (e.g. `harshpal@gmail.com`) → add any placeholder field (e.g. `addedBy: "you"`) since only the document's existence matters, not its contents.
  3. Anyone who signs in with an email that has no matching document is denied all reads/writes by the rules — Firebase Auth succeeds, but Firestore blocks them.
  4. To revoke someone's access later, delete their document from `allowedUsers`.
  5. This collection is locked (`allow write: if false`) so it can only be edited by you directly in the Firebase Console, never from the app itself.
- [ ] **Deploy Firestore indexes**: `firestore.indexes.json` defines the composite index the app's queries need. If you have the Firebase CLI installed, run `firebase deploy --only firestore:indexes`. Otherwise, load the app once in production — Firestore will show a console error with a direct link to auto-create the missing index.
- [ ] **Set environment variables on your host** (Vercel/Netlify project settings) — same 9 keys as your local `.env`. The app will throw a clear error on load if any Firebase key is missing, rather than a silent failure.
- [ ] **Authorized domains in Firebase Auth**: Firebase Console → Authentication → Settings → Authorized domains → add your production domain (e.g. `tracker.securiq.co`) or Google sign-in will fail there the same way it failed on `localhost` before you added it.
- [ ] **EmailJS origin lock**: EmailJS dashboard → Account → Security → restrict the allowed domains/origins to your production domain only. Without this, anyone who extracts your public EmailJS keys from the JS bundle (trivial via view-source) could send emails through your connected Gmail from a different site.
- [ ] **EmailJS quota**: free tier caps at 200 emails/month. Monitor usage in the EmailJS dashboard; upgrade if your team's deadline volume exceeds that.
- [ ] **Test the full flow in production** after deploying: sign in with an allowlisted email, add a member, create a deadline assigned to yourself, confirm the email arrives, confirm a non-allowlisted Google account is denied access.

## 6. What's already handled

- `.gitignore` excludes `node_modules`, `dist`, all `.env*` variants, editor files, OS files, and Firebase/Vercel/Netlify local caches.
- An error boundary catches unexpected React crashes and shows a reload prompt instead of a blank white screen.
- Firebase config is validated on load — missing env vars throw a descriptive error instead of a cryptic SDK failure.
- The page is marked `noindex, nofollow` since this is an internal tool with no reason to be publicly searchable.

