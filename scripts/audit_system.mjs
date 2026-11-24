import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const checkPrograms = [
  'blender', 'krita', 'inkscape', 'gimp', 'ffmpeg', 'python', 'node', 'magick', 'cairosvg'
];

console.log('--- PATH Tools ---');
for (const p of checkPrograms) {
  try {
    const { stdout } = await execFileAsync('where', [p]);
    console.log(`[FOUND PATH] ${p}: ${stdout.trim().split('\r\n')[0]}`);
  } catch (e) {
    // not in path
  }
}

console.log('\n--- Directory Scan ---');
const scanRoots = [
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Users\\Paras Koul\\AppData\\Local\\Programs'
];

for (const root of scanRoots) {
  if (fs.existsSync(root)) {
    try {
      const items = fs.readdirSync(root);
      for (const item of items) {
        if (/blender|krita|opentoonz|tahoma|adobe|inkscape|gimp|spine|dragonframe|obs|canva/i.test(item)) {
          console.log(`[FOUND APP] ${path.join(root, item)}`);
        }
      }
    } catch (_) {}
  }
}
