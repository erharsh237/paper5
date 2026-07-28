// Every integration module in this folder exports an object matching this
// shape. These are now real, working implementations (see github.js,
// discord.js, slack.js, vercel.js, googleCalendar.js) — no module-level
// env vars; instead each takes the team's shared config doc and (where
// relevant) the calling user's private credentials doc as explicit
// arguments, since both are loaded and passed down from Integrations.jsx.
//
// export const exampleIntegration = {
//   id: 'example',                        // stable key, used as the Firestore config key
//   name: 'Example',                       // display name
//   description: '...',                    // one-liner for the Integrations page
//   configFields: [{ key, label, placeholder? }],       // team-shared settings, rendered as inputs
//   credentialFields: [{ key, label, type? }],           // per-user private settings, rendered as inputs
//   isConfigured: (config, credentials) => boolean,      // true once enough is filled in to actually call the API
//   actions: {
//     // one method per capability the rest of the app needs, each
//     // signature (config, credentials, ...args) => Promise<result>.
//     // Keep these named after what FounderOS does with them, not what
//     // the vendor API calls them, so swapping providers later doesn't
//     // ripple out to every call site.
//   },
// }
