const fs = require('fs');
const path = require('path');
const pagesDir = path.join('src', 'pages');

const filesToUpdate = [
  { file: 'MyDashboard.jsx', title: '| My tasks' },
  { file: 'Dashboard.jsx', title: '| Deadline Tracker' },
  { file: 'Analytics.jsx', title: '| Analytics' },
  { file: 'Integrations.jsx', title: '| Integrations' },
  { file: 'Meeting.jsx', title: '| Meeting' },
  { file: 'Profile.jsx', title: '| My profile' },
  { file: 'Settings.jsx', title: '| Settings' }
];

filesToUpdate.forEach(({file, title}) => {
  const filePath = path.join(pagesDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('const { workspaceId } = useWorkspace()')) {
      content = content.replace('const { workspaceId } = useWorkspace()', 'const { workspaceId, workspace } = useWorkspace()');
    } else if (content.includes('const { workspaceId, isAdmin, isOwner } = useWorkspace()')) {
      content = content.replace('const { workspaceId, isAdmin, isOwner } = useWorkspace()', 'const { workspaceId, workspace, isAdmin, isOwner } = useWorkspace()');
    }

    const searchString = `Paper5 <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>${title}</span>`;
    const replacement = `Paper5 <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? \`| \${workspace.name}\` : ''}</span>`;
    
    content = content.replace(searchString, replacement);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
  }
});
