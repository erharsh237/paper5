#!/usr/bin/env node

/**
 * Paper5 Startup Chronicles: Episode 01 Production Renderer
 * High-performance deterministic frame rendering via Playwright & Chrome Compositor
 * Built-in zero-dependency HTTP server + FFmpeg 48kHz audio muxer.
 */

import { chromium } from 'playwright-core';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

// Command line arguments
const args = process.argv.slice(2);
const isPreview = args.includes('--preview') || args.includes('-p');
const fps = 60;
const width = 1080;
const height = 1920;

const exportsDir = path.resolve('exports');
const tempDir = path.resolve('temp_render/ep01_frames');
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Clean old frames
fs.readdirSync(tempDir).forEach(f => {
  try { fs.unlinkSync(path.join(tempDir, f)); } catch (_) {}
});

const outputFileName = isPreview
  ? 'startup-chronicles-episode-01-preview.mp4'
  : 'startup-chronicles-episode-01-premium.mp4';
const outputPath = path.join(exportsDir, outputFileName);
const masterAudioPath = path.resolve('public/master_audio_ep01.wav');
const timelinePath = path.resolve('public/timeline-ep01.json');

const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
const fullDurationSec = timelineData.durationSec || 35.0;
// Preview renders 7.0 seconds (Scenes 1 & 2) for rapid quality verification
const durationSec = isPreview ? 7.0 : fullDurationSec;
const totalFrames = Math.ceil(durationSec * fps);

console.log('='.repeat(70));
console.log('🎬 PAPER5 STARTUP CHRONICLES — EPISODE 01 RENDER PIPELINE');
console.log('='.repeat(70));
console.log(`Mode        : ${isPreview ? '⚡ FAST PREVIEW (7.0s)' : '💎 BROADCAST MASTER (Full 35.0s Episode)'}`);
console.log(`Resolution  : ${width} × ${height} (9:16 Portrait Instagram Reel)`);
console.log(`Framerate   : ${fps} FPS Locked Constant Frame Rate`);
console.log(`Total Frames: ${totalFrames} frames`);
console.log(`Audio Master: ${masterAudioPath}`);
console.log(`Target File : ${outputPath}`);
console.log('='.repeat(70));

// Start local static HTTP server
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/startup-chronicles-ep01.html';
  
  let filePath = path.join(path.resolve('public'), reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(path.resolve('.'), reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3847;
await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
console.log(`\n[1/5] Local studio asset server running on http://127.0.0.1:${PORT}`);

// Find Chrome / Edge browser
const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
];
const browserExecutable = browserPaths.find(p => fs.existsSync(p));

if (!browserExecutable) {
  console.error('❌ Chromium browser executable not found.');
  server.close();
  process.exit(1);
}

console.log('[2/5] Launching headless browser compositor...');
const browser = await chromium.launch({
  executablePath: browserExecutable,
  headless: true,
  args: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--force-color-profile=srgb',
    '--enable-gpu-rasterization',
    '--no-sandbox'
  ]
});

const page = await browser.newPage({
  viewport: { width, height }
});

const targetUrl = `http://127.0.0.1:${PORT}/startup-chronicles-ep01.html`;
console.log(`Navigating to ${targetUrl}...`);
await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

// Inject video render styles
await page.evaluate(() => {
  document.body.classList.add('video-render-mode');
  const style = document.createElement('style');
  style.innerHTML = `
    #previewControls, .preview-bar { display: none !important; }
    #viewportStage {
      transform: none !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 1080px !important;
      height: 1920px !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
});

await page.evaluate(() => document.fonts.ready);
// Wait for initial render
await page.evaluate(() => window.renderAtTime(0));

console.log('\n[3/5] Rendering frames deterministically at 60 FPS...');
const t0 = Date.now();

const concatPath = path.join(tempDir, 'frames_concat.txt');
let concatContent = 'ffconcat version 1.0\n';

for (let frame = 0; frame < totalFrames; frame++) {
  const timestamp = frame / fps;
  await page.evaluate(t => window.renderAtTime(t), timestamp);

  const frameFileName = `frame_${String(frame).padStart(6, '0')}.jpg`;
  const frameFilePath = path.join(tempDir, frameFileName);

  await page.screenshot({
    path: frameFilePath,
    type: 'jpeg',
    quality: 92
  });

  const absPath = frameFilePath.replace(/\\/g, '/');
  concatContent += `file '${absPath}'\nduration ${(1 / fps).toFixed(6)}\n`;

  if (frame % 30 === 0 || frame === totalFrames - 1) {
    const elapsedSec = (Date.now() - t0) / 1000;
    const fpsRender = frame / (elapsedSec || 1);
    const etaSec = ((totalFrames - frame) / (fpsRender || 1)).toFixed(0);
    process.stdout.write(`  Frame ${frame}/${totalFrames} (${(frame / totalFrames * 100).toFixed(1)}%) | ${fpsRender.toFixed(1)} fps | ETA: ${etaSec}s   \r`);
  }
}

// Concat demuxer requires repeating last frame entry
const lastFramePath = path.join(tempDir, `frame_${String(totalFrames - 1).padStart(6, '0')}.jpg`).replace(/\\/g, '/');
concatContent += `file '${lastFramePath}'\n`;
fs.writeFileSync(concatPath, concatContent);

console.log(`\n\n[4/5] Captured ${totalFrames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
await browser.close();
server.close();

console.log('\n[5/5] Encoding high-definition H.264/AAC MP4 with FFmpeg...');

const ffmpegArgs = [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatPath,
  '-i', masterAudioPath,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', isPreview ? '22' : '18',
  '-pix_fmt', 'yuv420p',
  '-vsync', 'cfr',
  '-r', String(fps),
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-t', String(durationSec),
  '-movflags', '+faststart',
  outputPath
];

await execFileAsync(ffmpegPath, ffmpegArgs);

// Verify output
const { stderr: probeStderr } = await execFileAsync(ffmpegPath, ['-i', outputPath]).catch(e => ({ stderr: e.stderr || '' }));
const stat = fs.statSync(outputPath);

console.log('\n' + '='.repeat(70));
console.log('✅ EXPORT COMPLETED SUCCESSFULLY');
console.log('='.repeat(70));
console.log(`Output Video : ${outputPath}`);
console.log(`File Size    : ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
console.log(`Duration     : ${durationSec.toFixed(2)}s`);
console.log(`Frame Rate   : ${fps} FPS Locked CFR`);
console.log('Stream Details:');
probeStderr.split('\n')
  .filter(l => l.includes('Duration:') || l.includes('Stream #'))
  .forEach(l => console.log('  ' + l.trim()));
console.log('='.repeat(70) + '\n');
