const fs = require('fs');
const path = require('path');

const srcDirs = [
  path.join(__dirname, '../src/components'),
  path.join(__dirname, '../src/pages')
];

// Functions that now take workspaceId as first param
const targetFuncs = [
  'subscribeDeadlines', 'createDeadline', 'updateDeadline', 'updateDeadlineStatus',
  'addExtraWork', 'subscribeExtraWork', 'submitForReview', 'subscribeEvidence',
  'approveReview', 'rejectReview', 'setBlocked', 'clearBlocked', 'deleteDeadline',
  'subscribeMembers', 'addMember', 'removeMember', 'subscribeSprints', 'createSprint',
  'updateSprint', 'deleteSprint', 'setActiveSprint', 'lockSprint', 'unlockSprint',
  'subscribeMeetings', 'subscribeUpcomingMeetings', 'subscribeEventNotes', 'saveEventNote',
  'deleteEventNote', 'createMeeting', 'updateMeetingNote', 'createNotification',
  'subscribeNotifications', 'markNotificationRead', 'hasSeenTour', 'markTourSeen',
  'resetTourSeen', 'subscribeProfile', 'saveProfile', 'saveAim', 'getProfileOnce',
  'subscribeReflections', 'submitReflection', 'subscribeRoles', 'addRole',
  'useDeadlines'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if this file calls any target function
  const callsTarget = targetFuncs.some(fn => content.includes(fn + '('));
  if (!callsTarget) return;

  console.log(`Refactoring ${filePath}`);

  // 1. Inject import
  const isPages = filePath.includes('pages');
  const importPath = isPages ? '../lib/WorkspaceContext' : '../lib/WorkspaceContext';
  if (!content.includes('WorkspaceContext')) {
    // Add import after last import
    const importRegex = /import .* from '.*';?\n/g;
    let match;
    let lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      lastIndex = importRegex.lastIndex;
    }
    content = content.slice(0, lastIndex) + `import { useWorkspace } from '${importPath}'\n` + content.slice(lastIndex);
  }

  // 2. Inject const { workspaceId } = useWorkspace() into components
  // Find component declarations: export default function X() { or export function X() { or function X() {
  const componentRegex = /(?:export\s+(?:default\s+)?)?function\s+[A-Z][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{/g;
  content = content.replace(componentRegex, (match) => {
    if (content.includes('useWorkspace()')) {
        // Just in case we already injected it in a previous run, don't do it again blindly, 
        // though our check earlier might prevent this if we were careful.
        // Let's just blindly inject if it doesn't have it right after.
        if (!content.substring(content.indexOf(match), content.indexOf(match) + 100).includes('workspaceId')) {
             return match + `\n  const { workspaceId } = useWorkspace();`;
        }
    }
    return match + `\n  const { workspaceId } = useWorkspace();`;
  });

  // 3. Replace function calls
  // This is tricky because params vary.
  // Instead of complex regex for all, we can just replace `fn(` with `fn(workspaceId, `
  // But ONLY for the imported functions, and we must be careful not to replace function definitions or imports.
  // We can look for word boundary, function name, and open paren.
  targetFuncs.forEach(fn => {
    // Regex to match fn( NOT in import statement and NOT function definition
    // It's easier to just replace `fn(` with `fn(workspaceId, ` but exclude `export function fn` and `import { fn`
    const regex = new RegExp(`\\b${fn}\\(`, 'g');
    content = content.replace(regex, (match, offset) => {
      const precedingText = content.slice(Math.max(0, offset - 20), offset);
      if (precedingText.includes('function ') || precedingText.includes('import ')) {
        return match;
      }
      // If it's useDeadlines, we might be calling useDeadlines() or useDeadlines(teamId)
      // Let's handle it
      if (fn === 'hasSeenTour') return match; // Handle manually later if needed
      return `${fn}(workspaceId, `;
    });
  });

  // Special fix for empty args that got workspaceId, 
  // e.g. subscribeRoles(workspaceId, ) -> subscribeRoles(workspaceId)
  content = content.replace(/\(workspaceId,\s+\)/g, '(workspaceId)');

  fs.writeFileSync(filePath, content, 'utf8');
}

srcDirs.forEach(dir => {
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.jsx')) {
      processFile(path.join(dir, file));
    }
  });
});

console.log('Done refactoring UI components.');
