#!/usr/bin/env node

/**
 * Paper5 Automated Video Production Pipeline
 * Renders 60 FPS / 30 FPS MP4 marketing films directly from HTML/CSS/Web Audio
 * using Playwright (Chrome Compositor) and FFmpeg without screen recording.
 */

import { chromium } from 'playwright-core';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;

// Parse CLI Arguments
const args = process.argv.slice(2);
function getArg(flag, alias, defaultValue) {
  const idx = args.findIndex(a => a === flag || a === alias);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  const match = args.find(a => a.startsWith(`${flag}=`) || (alias && a.startsWith(`${alias}=`)));
  if (match) return match.split('=')[1];
  return defaultValue;
}
const hasFlag = (flag, alias) => args.includes(flag) || (alias && args.includes(alias));

if (hasFlag('--help', '-h')) {
  console.log(`
Paper5 Video Production Engine — Usage:
  node .agents/skills/paper5-video-production/scripts/render.mjs [options]

Options:
  --aspect, -a    Aspect ratio / layout:
                  - 'portrait'  : 1080x1920 (9:16 Instagram Reels / Stories / TikTok) [default]
                  - 'landscape' : 1920x1080 (16:9 YouTube / Website Hero)
                  - 'square'    : 1080x1080 (1:1 Instagram Post / Feed)
  --fps, -f       Frame rate: 60 [default] or 30
  --preview, -p   Fast preview mode (~4 seconds render)
  --out, -o       Output MP4 filename (defaults to exports/paper5-<aspect>-<fps>fps.mp4)
  --quality, -q   Quality CRF: 'high' (CRF 18) [default] or 'standard' (CRF 23)
  --url, -u       Target URL (defaults to http://localhost:5173/product-film.html)
  --help, -h      Show this help message
`);
  process.exit(0);
}

const presetArg = getArg('--preset', null, null);
let aspect = getArg('--aspect', '-a', 'portrait').toLowerCase();
let fps = parseInt(getArg('--fps', '-f', '60'), 10) || 60;
const isPreview = hasFlag('--preview', '-p');
const customDurationArg = getArg('--duration', '-d', null);
const customDuration = customDurationArg ? parseFloat(customDurationArg) : null;
const speedArg = getArg('--speed', '-s', '1.0');
const speed = Math.max(0.25, Math.min(3.0, parseFloat(speedArg) || 1.0));
const quality = getArg('--quality', '-q', 'high').toLowerCase();
const baseUrl = getArg('--url', '-u', 'http://localhost:5173/product-film.html');

// Apply preset configuration
if (presetArg) {
  const p = presetArg.toLowerCase();
  if (p === 'reel' || p === 'instagram' || p === 'portrait') {
    aspect = 'portrait';
    fps = 60;
  } else if (p === 'youtube' || p === 'landscape' || p === '16:9') {
    aspect = 'landscape';
    fps = 60;
  } else if (p === 'square' || p === 'post' || p === '1:1') {
    aspect = 'square';
    fps = 30;
  }
}

// Determine resolutions
let width = 1080;
let height = 1920;
let formatParam = 'portrait';

if (aspect === 'landscape' || aspect === '16:9' || aspect === 'wide') {
  width = 1920;
  height = 1080;
  formatParam = 'landscape';
} else if (aspect === 'square' || aspect === '1:1') {
  width = 1080;
  height = 1080;
  formatParam = 'square';
}

const crf = quality === 'standard' ? '23' : '18';
const defaultOutName = `paper5-${formatParam}-${fps}fps${isPreview ? '-preview' : ''}.mp4`;
const outArg = getArg('--out', '-o', null);
const exportsDir = path.resolve('exports');
const tempDir = path.resolve('temp_render');
const framesDir = path.join(tempDir, 'frames');

if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

// Clean previous temporary frames
fs.readdirSync(framesDir).forEach(f => {
  try { fs.unlinkSync(path.join(framesDir, f)); } catch (_) {}
});

const outputPath = outArg ? path.resolve(outArg) : path.join(exportsDir, defaultOutName);
const tempAudioPath = path.join(tempDir, 'audio.webm');

console.log('='.repeat(70));
console.log('🚀 Paper5 Video Production Engine (Playwright + FFmpeg)');
console.log('='.repeat(70));
console.log(`Resolution : ${width} × ${height} (${formatParam})`);
console.log(`Frame Rate : ${fps} FPS Locked`);
console.log(`Mode       : ${isPreview ? '⚡ Fast Preview (~4s)' : '💎 Full Film Production (Acts 1 -> 7)'}`);
console.log(`Quality    : CRF ${crf} (${quality === 'high' ? 'High Fidelity Broadcast' : 'Standard Web'})`);
console.log(`Output     : ${outputPath}`);
console.log(`FFmpeg     : ${ffmpegPath}`);
console.log('='.repeat(70));

// Locate browser binary
const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
];
const browserExecutable = browserPaths.find(p => fs.existsSync(p));

if (!browserExecutable) {
  console.error('❌ Error: No compatible Chromium browser found (Chrome, Edge, or Brave).');
  console.error('Please install Google Chrome or Microsoft Edge.');
  process.exit(1);
}

const targetUrl = `${baseUrl}?format=${formatParam}&render=1&automated=1&speed=${speed}`;
console.log(`\n[1/5] Launching headless compositor at ${targetUrl}...`);

const browser = await chromium.launch({
  executablePath: browserExecutable,
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--force-color-profile=srgb',
    '--enable-gpu-rasterization',
    '--enable-webgl',
    '--no-sandbox'
  ]
});

const page = await browser.newPage({
  viewport: { width, height }
});

const client = await page.context().newCDPSession(page);

// Load target page and await assets
await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => document.fonts.ready);

// Inject clean studio video styling
await page.evaluate(() => {
  document.body.classList.add('video-render-mode');
  const style = document.createElement('style');
  style.id = 'video-render-override-css';
  style.innerHTML = `
    #directorControls, #toastContainer, .director-controls, .toast, .studio-mode-banner {
      display: none !important;
    }
    body {
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      background: radial-gradient(circle at 50% 20%, #151828 0%, #0a0b12 55%, #030407 100%) !important;
    }
  `;
  document.head.appendChild(style);
});

console.log('[2/5] Initializing audio and video capture pipelines...');

// Set up zero-latency in-memory frame capture via CDP Screencast with microsecond presentation timestamps
const capturedFrames = [];
let isCapturingFrames = true;

client.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
  // Acknowledge frame immediately across CDP so the browser compositor never throttles
  client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  if (isCapturingFrames) {
    capturedFrames.push({
      buffer: Buffer.from(data, 'base64'),
      timestamp: metadata && metadata.timestamp ? metadata.timestamp : (Date.now() / 1000)
    });
  }
});

await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 92,
  maxWidth: width,
  maxHeight: height,
  everyNthFrame: 1
});

// Start live audio recording and film playback
await page.evaluate(async () => {
  window.__filmFinished = false;
  await window.FilmAudio.ensureContext();
  await window.FilmAudio.start();

  const track = window.FilmAudio.getMediaStreamTrack();
  if (track) {
    const stream = new MediaStream([track]);
    window.__filmRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    window.__filmAudioChunks = [];
    window.__filmRecorder.ondataavailable = e => {
      if (e.data.size > 0) window.__filmAudioChunks.push(e.data);
    };
    window.__filmRecorder.start(100);
  }

  // Start the film sequence
  window.runFullFilm();
});

const durationLabel = customDuration ? `${customDuration}s Test` : (isPreview ? 'Preview 4.0s' : 'Full Film');
console.log(`[3/5] Recording animation (${durationLabel})...`);
const t0 = Date.now();

if (customDuration) {
  await new Promise(r => setTimeout(r, customDuration * 1000));
} else if (isPreview) {
  // Capture 4.0 seconds for preview
  await new Promise(r => setTimeout(r, 4200));
} else {
  // Wait for film sequence to complete or timeout at 45 seconds
  const maxWaitMs = 45000;
  const pollIntervalMs = 250;
  let elapsed = 0;
  let lastFrameCount = 0;
  let idleCount = 0;

  while (elapsed < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    elapsed += pollIntervalMs;
    const isDone = await page.evaluate(() => window.__filmFinished === true);
    if (isDone) {
      console.log(`  ... [Sync] Film finish signal received at ${(elapsed / 1000).toFixed(1)}s!`);
      await new Promise(r => setTimeout(r, 600));
      break;
    }
    if (elapsed > 16000 && capturedFrames.length === lastFrameCount) {
      idleCount++;
      if (idleCount >= 8) { // 2.0s with no new frames after 16s indicates animation is completed
        console.log(`  ... [Sync] Visual animation completion detected at ${(elapsed / 1000).toFixed(1)}s.`);
        break;
      }
    } else {
      idleCount = 0;
      lastFrameCount = capturedFrames.length;
    }
    if (elapsed % 5000 === 0) {
      console.log(`  ... In progress: ${(elapsed / 1000).toFixed(0)}s elapsed (${capturedFrames.length} frames captured)`);
    }
  }
}

// Stop frame capture
isCapturingFrames = false;
await client.send('Page.stopScreencast');

console.log(`[4/5] Flushing ${capturedFrames.length} frames to disk and building timeline synchronization manifest (${((Date.now() - t0) / 1000).toFixed(1)}s elapsed)...`);

const concatPath = path.join(tempDir, 'frames_concat.txt');
let concatContent = 'ffconcat version 1.0\n';

for (let i = 0; i < capturedFrames.length; i++) {
  const frameNum = String(i).padStart(6, '0');
  const frameFileName = `frame_${frameNum}.jpg`;
  const absFramePath = path.join(framesDir, frameFileName).replace(/\\/g, '/');
  fs.writeFileSync(path.join(framesDir, frameFileName), capturedFrames[i].buffer);

  let duration = 1 / fps;
  if (i < capturedFrames.length - 1) {
    const delta = capturedFrames[i + 1].timestamp - capturedFrames[i].timestamp;
    duration = (delta > 0.001 && delta < 2.5) ? delta : (1 / fps);
  }
  concatContent += `file '${absFramePath}'\nduration ${duration.toFixed(6)}\n`;
}

if (capturedFrames.length > 0) {
  const lastNum = String(capturedFrames.length - 1).padStart(6, '0');
  const absLastFramePath = path.join(framesDir, `frame_${lastNum}.jpg`).replace(/\\/g, '/');
  concatContent += `file '${absLastFramePath}'\n`;
}
fs.writeFileSync(concatPath, concatContent);

const frameCount = capturedFrames.length;

// Finalize audio recorder in page
const audioBase64 = await page.evaluate(async () => {
  window.FilmAudio.stop();
  if (!window.__filmRecorder) return null;

  window.__filmRecorder.stop();
  await new Promise(r => window.__filmRecorder.onstop = r);

  const blob = new Blob(window.__filmAudioChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  return new Promise(resolve => {
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
});

await browser.close();

let hasAudio = false;
let audioDurationSec = 0;
let cleanedAudioPath = tempAudioPath;

if (audioBase64) {
  fs.writeFileSync(tempAudioPath, Buffer.from(audioBase64, 'base64'));
  hasAudio = fs.statSync(tempAudioPath).size > 1024;
  if (hasAudio) {
    try {
      // Remux WebM to PCM WAV to guarantee 100% accurate stream duration and avoid missing header chunks
      const wavPath = path.join(tempDir, 'audio_fixed.wav');
      await execFileAsync(ffmpegPath, ['-y', '-i', tempAudioPath, '-c:a', 'pcm_s16le', wavPath]);
      if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
        cleanedAudioPath = wavPath;
        const probe = await execFileAsync(ffmpegPath, ['-i', wavPath]).catch(e => ({ stderr: e.stderr || '' }));
        const match = probe.stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          audioDurationSec = parseFloat(match[1]) * 3600 + parseFloat(match[2]) * 60 + parseFloat(match[3]);
        }
      }
    } catch (_) {}
  }
}

const actualElapsedSec = (Date.now() - t0) / 1000;
const finalDurationSec = (audioDurationSec > 0.5) ? audioDurationSec : (customDuration || actualElapsedSec);

console.log(`\nTimeline Synchronization Lock:`);
console.log(`  Frames Captured : ${frameCount} frames`);
console.log(`  Audio Duration  : ${finalDurationSec.toFixed(2)}s`);
console.log(`  Timecode Stream : Precise variable timestamp manifest -> Locked ${fps} FPS Constant Output`);

// Mux video and audio with FFmpeg using timestamp concat demuxer
console.log('[5/5] Encoding high-definition MP4 via FFmpeg...');
const ffmpegArgs = [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatPath
];

if (hasAudio) {
  ffmpegArgs.push('-i', cleanedAudioPath);
  ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
}

ffmpegArgs.push(
  '-vsync', 'cfr',
  '-r', String(fps),
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'fast',
  '-crf', crf,
  '-movflags', '+faststart'
);

if (hasAudio) {
  ffmpegArgs.push('-shortest');
}

ffmpegArgs.push(outputPath);

await execFileAsync(ffmpegPath, ffmpegArgs);

// Cleanup temporary frames and audio
try {
  fs.readdirSync(framesDir).forEach(f => fs.unlinkSync(path.join(framesDir, f)));
  fs.rmdirSync(framesDir);
  if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
} catch (_) {}

// Verify output MP4 metadata
const { stderr } = await execFileAsync(ffmpegPath, ['-i', outputPath]).catch(e => ({ stderr: e.stderr || '' }));
const stat = fs.statSync(outputPath);

console.log('\n' + '='.repeat(70));
console.log('✅ EXPORT COMPLETED SUCCESSFULLY');
console.log('='.repeat(70));
console.log(`File Path  : ${outputPath}`);
console.log(`File Size  : ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

console.log('\nStream Verification:');
stderr.split('\n')
  .filter(l => l.includes('Duration:') || l.includes('Stream #'))
  .forEach(l => console.log('  ' + l.trim()));
console.log('='.repeat(70) + '\n');
