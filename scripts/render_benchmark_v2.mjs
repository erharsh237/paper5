#!/usr/bin/env node

/**
 * The Startup Chronicles: Production v2 Animation Benchmark Renderer
 * Deterministic 60 FPS CFR capture of Max & Alex in the redesigned hand-drawn office
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

const fps = 60;
const width = 1080;
const height = 1920;
const durationSec = 10.0;
const totalFrames = Math.ceil(durationSec * fps);

const exportsDir = path.resolve('exports');
const tempDir = path.resolve('temp_render/benchmark_v2_frames');
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Clean frames
fs.readdirSync(tempDir).forEach(f => {
  try { fs.unlinkSync(path.join(tempDir, f)); } catch (_) {}
});

const outputPath = path.join(exportsDir, 'startup-chronicles-benchmark-v2.mp4');
const masterAudioPath = path.resolve('public/benchmark_audio.wav');

console.log('='.repeat(70));
console.log('🎬 THE STARTUP CHRONICLES — BENCHMARK v2 RENDER (REDESIGNED)');
console.log('='.repeat(70));
console.log(`Resolution  : ${width} × ${height} (9:16 Portrait)`);
console.log(`Framerate   : ${fps} FPS Locked Constant Frame Rate`);
console.log(`Total Frames: ${totalFrames} frames`);
console.log(`Audio Master: ${masterAudioPath}`);
console.log(`Target File : ${outputPath}`);
console.log('='.repeat(70));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.js': 'application/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/startup-chronicles-benchmark-v2.html';
  let filePath = path.join(path.resolve('public'), reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3851;
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
console.log(`[1/4] Asset server running on http://127.0.0.1:${PORT}`);

const browserPaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const execPath = browserPaths.find(p => fs.existsSync(p));

console.log('[2/4] Launching compositor...');
const browser = await chromium.launch({
  executablePath: execPath,
  headless: true,
  args: ['--force-color-profile=srgb', '--no-sandbox']
});

const page = await browser.newPage({ viewport: { width, height } });
await page.goto(`http://127.0.0.1:${PORT}/startup-chronicles-benchmark-v2.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => document.fonts.ready);

console.log('\n[3/4] Capturing 600 frames deterministically...');
const t0 = Date.now();
const concatPath = path.join(tempDir, 'frames_concat.txt');
let concatContent = 'ffconcat version 1.0\n';

for (let frame = 0; frame < totalFrames; frame++) {
  const timestamp = frame / fps;
  await page.evaluate(t => window.renderAtTime(t), timestamp);

  const frameFileName = `frame_${String(frame).padStart(6, '0')}.jpg`;
  const frameFilePath = path.join(tempDir, frameFileName);

  await page.screenshot({ path: frameFilePath, type: 'jpeg', quality: 92 });
  const absPath = frameFilePath.replace(/\\/g, '/');
  concatContent += `file '${absPath}'\nduration ${(1 / fps).toFixed(6)}\n`;

  if (frame % 60 === 0 || frame === totalFrames - 1) {
    const elapsed = (Date.now() - t0) / 1000;
    const curFps = frame / (elapsed || 1);
    process.stdout.write(`  Frame ${frame}/${totalFrames} (${(frame / totalFrames * 100).toFixed(1)}%) | ${curFps.toFixed(1)} fps   \r`);
  }
}

const lastFramePath = path.join(tempDir, `frame_${String(totalFrames - 1).padStart(6, '0')}.jpg`).replace(/\\/g, '/');
concatContent += `file '${lastFramePath}'\n`;
fs.writeFileSync(concatPath, concatContent);

console.log(`\n\nCaptured ${totalFrames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
await browser.close();
server.close();

console.log('\n[4/4] Encoding H.264/AAC broadcast master with FFmpeg...');
await execFileAsync(ffmpegPath, [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatPath,
  '-i', masterAudioPath,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-vsync', 'cfr',
  '-r', String(fps),
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-t', '10.0',
  '-movflags', '+faststart',
  outputPath
]);

const stat = fs.statSync(outputPath);
const { stderr: probe } = await execFileAsync(ffmpegPath, ['-i', outputPath]).catch(e => ({ stderr: e.stderr || '' }));

console.log('\n' + '='.repeat(70));
console.log('✅ BENCHMARK v2 RENDER COMPLETE');
console.log('='.repeat(70));
console.log(`Output Video : ${outputPath}`);
console.log(`File Size    : ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
console.log(`Duration     : 10.00s locked`);
console.log(`Framerate    : 60 FPS Locked Constant Frame Rate`);
console.log('Stream Details:');
probe.split('\n').filter(l => l.includes('Duration:') || l.includes('Stream #')).forEach(l => console.log('  ' + l.trim()));
console.log('='.repeat(70) + '\n');
