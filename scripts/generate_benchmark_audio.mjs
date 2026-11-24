import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const ffmpegPath = (await import('@ffmpeg-installer/ffmpeg')).default.path;
const audioDir = path.resolve('temp_render/benchmark_audio');
const publicDir = path.resolve('public');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

console.log('='.repeat(70));
console.log('🎙️ Benchmark Audio Synthesis: Max & Alex Sitcom Dialogue (48kHz)');
console.log('='.repeat(70));

// 1. Synthesize Max Dialogue
const rawMax = path.join(audioDir, 'raw_max.wav');
const finalMax = path.join(audioDir, 'max.wav');

const psMax = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft David Desktop')
$synth.Rate = 1
$synth.SetOutputToWaveFile('${rawMax.replace(/\\/g, '\\\\')}')
$synth.Speak('We do not need sleep, Alex. We have momentum.')
$synth.Dispose()
`;
await execFileAsync('powershell', ['-NoProfile', '-Command', psMax]);

// Pitch shift + EQ for Max (energetic founder tone)
await execFileAsync(ffmpegPath, [
  '-y', '-i', rawMax,
  '-af', 'asetrate=22050*1.12,aresample=48000,equalizer=f=3200:t=q:w=1:g=3.5,loudnorm=I=-16:TP=-1.5:LRA=7',
  '-ar', '48000', '-ac', '2',
  finalMax
]);

// 2. Synthesize Alex Dialogue
const rawAlex = path.join(audioDir, 'raw_alex.wav');
const finalAlex = path.join(audioDir, 'alex.wav');

const psAlex = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft David Desktop')
$synth.Rate = 0
$synth.SetOutputToWaveFile('${rawAlex.replace(/\\/g, '\\\\')}')
$synth.Speak('Momentum does not pass unit tests, Max.')
$synth.Dispose()
`;
await execFileAsync('powershell', ['-NoProfile', '-Command', psAlex]);

// Warm, deadpan tone for Alex
await execFileAsync(ffmpegPath, [
  '-y', '-i', rawAlex,
  '-af', 'asetrate=22050*0.98,aresample=48000,equalizer=f=250:t=q:w=1:g=3,equalizer=f=3800:t=q:w=1.5:g=2,loudnorm=I=-16:TP=-1.5:LRA=7',
  '-ar', '48000', '-ac', '2',
  finalAlex
]);

// Measure durations
const probeDuration = async (file) => {
  const { stderr } = await execFileAsync(ffmpegPath, ['-i', file]).catch(e => ({ stderr: e.stderr || '' }));
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  return m ? (parseFloat(m[1]) * 3600 + parseFloat(m[2]) * 60 + parseFloat(m[3])) : 3.0;
};

const maxDur = await probeDuration(finalMax);
const alexDur = await probeDuration(finalAlex);
console.log(`  ✓ Max line duration : ${maxDur.toFixed(2)}s`);
console.log(`  ✓ Alex line duration: ${alexDur.toFixed(2)}s`);

// 3. Compose Light Comedy Underscore (92 BPM, 10.0 seconds)
const SAMPLE_RATE = 48000;
const totalSamples = 10 * SAMPLE_RATE;
const musicL = new Float32Array(totalSamples);
const musicR = new Float32Array(totalSamples);

function addPluck(timeSec, freq, vol) {
  const start = Math.floor(timeSec * SAMPLE_RATE);
  const dur = Math.floor(0.25 * SAMPLE_RATE);
  for (let i = 0; i < dur && start + i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 9.0);
    const s = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
    musicL[start + i] += s * env * vol * 0.5;
    musicR[start + i] += s * env * vol * 0.5;
  }
}

// Playful pizzicato notes on offbeats
const pizzNotes = [261.63, 329.63, 392.00, 523.25, 440.00, 392.00, 329.63, 293.66];
for (let b = 0; b < 16; b++) {
  const tNote = b * 0.652 + 0.326;
  if (tNote < 9.5) {
    addPluck(tNote, pizzNotes[b % pizzNotes.length], 0.25);
  }
}

const rawScore = path.join(audioDir, 'raw_score.wav');
writeFloat32Wav(rawScore, musicL, musicR, SAMPLE_RATE);

// 4. Mix Master 10s Benchmark Audio
// Max speaks: 0.8s -> 0.8s + maxDur
// Alex speaks: 5.6s -> 5.6s + alexDur
const maxStartMs = 800;
const alexStartMs = 5600;

const masterWav = path.join(publicDir, 'benchmark_audio.wav');
await execFileAsync(ffmpegPath, [
  '-y',
  '-i', rawScore,
  '-i', finalMax,
  '-i', finalAlex,
  '-filter_complex',
  `[1:a]adelay=${maxStartMs}|${maxStartMs},volume=1.4[max];` +
  `[2:a]adelay=${alexStartMs}|${alexStartMs},volume=1.4[alex];` +
  `[0:a]volume=0.45[bg];` +
  `[bg][max][alex]amix=inputs=3:duration=first:dropout_transition=2,volume=1.3,alimiter=limit=0.95`,
  '-t', '10.0',
  '-ar', '48000',
  '-ac', '2',
  masterWav
]);

console.log(`\n✅ Generated Benchmark Master Audio: ${masterWav} (10.0s locked @ 48kHz)`);

function writeFloat32Wav(filePath, lChan, rChan, sRate) {
  const numCh = 2;
  const numSamp = lChan.length;
  const byteRate = sRate * numCh * 2;
  const buf = Buffer.alloc(44 + numSamp * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + numSamp * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numCh, 22);
  buf.writeUInt32LE(sRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(numSamp * 4, 40);
  let off = 44;
  for (let i = 0; i < numSamp; i++) {
    const sL = Math.max(-1, Math.min(1, lChan[i]));
    const sR = Math.max(-1, Math.min(1, rChan[i]));
    buf.writeInt16LE(sL * 32767, off);
    off += 2;
    buf.writeInt16LE(sR * 32767, off);
    off += 2;
  }
  fs.writeFileSync(filePath, buf);
}
