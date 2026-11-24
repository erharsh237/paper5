import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Paths
const ffmpegPath = (await import('@ffmpeg-installer/ffmpeg')).default.path;
const audioDir = path.resolve('temp_render/audio');
const publicDir = path.resolve('public');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

console.log('='.repeat(70));
console.log('🎵 Paper5 Startup Chronicles Ep. 01 — Master Audio Production Pipeline');
console.log('='.repeat(70));

// 1. SAPI DIALOGUE CONFIGURATION
// Snappy comedic acting with natural cadence
const dialogueDefs = [
  {
    id: 'narrator_01',
    character: 'Narrator',
    voice: 'Microsoft David Desktop',
    rate: 1, // Snappy documentary pacing
    pitchFilter: 'asetrate=22050*0.96,aresample=48000,equalizer=f=120:t=q:w=1:g=3,equalizer=f=3500:t=q:w=1.5:g=2',
    text: 'Monday morning at Paper5. Sprint 42 was completely on schedule.'
  },
  {
    id: 'max_01',
    character: 'Max',
    voice: 'Microsoft David Desktop',
    rate: 2, // Energetic founder speed
    pitchFilter: 'asetrate=22050*1.12,aresample=48000,equalizer=f=3000:t=q:w=1:g=3.5',
    text: 'Team! One tiny priority before tomorrow\'s launch.'
  },
  {
    id: 'sam_01',
    character: 'Sam',
    voice: 'Microsoft Zira Desktop',
    rate: 1,
    pitchFilter: 'asetrate=22050*1.04,aresample=48000,equalizer=f=2500:t=q:w=1:g=2',
    text: 'Define "tiny", Max.'
  },
  {
    id: 'max_02',
    character: 'Max',
    voice: 'Microsoft David Desktop',
    rate: 2,
    pitchFilter: 'asetrate=22050*1.12,aresample=48000,equalizer=f=3000:t=q:w=1:g=3.5',
    text: 'Zero-downtime cluster security audit. Due by 6 PM today.'
  },
  {
    id: 'alex_01',
    character: 'Alex',
    voice: 'Microsoft David Desktop',
    rate: 1,
    pitchFilter: 'asetrate=22050*1.00,aresample=48000,equalizer=f=200:t=q:w=1:g=2,equalizer=f=4000:t=q:w=1:g=2.5',
    text: 'Wait... 6 PM today?!'
  },
  {
    id: 'alex_02',
    character: 'Alex',
    voice: 'Microsoft David Desktop',
    rate: 0, // Deadpan slow delivery
    pitchFilter: 'asetrate=22050*0.98,aresample=48000,equalizer=f=250:t=q:w=1:g=3',
    text: 'I am going to need way more coffee.'
  },
  {
    id: 'narrator_02',
    character: 'Narrator',
    voice: 'Microsoft David Desktop',
    rate: 1,
    pitchFilter: 'asetrate=22050*0.96,aresample=48000,equalizer=f=120:t=q:w=1:g=3,equalizer=f=3500:t=q:w=1.5:g=2',
    text: 'Everything on paper. Nothing on trust. Paper5.'
  }
];

console.log('\n[1/4] Synthesizing character dialogue with bespoke vocal profiles...');
const speechClips = {};

for (const def of dialogueDefs) {
  const rawWav = path.join(audioDir, `raw_${def.id}.wav`);
  const finalWav = path.join(audioDir, `${def.id}.wav`);

  const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('${def.voice}')
$synth.Rate = ${def.rate}
$synth.SetOutputToWaveFile('${rawWav.replace(/\\/g, '\\\\')}')
$synth.Speak('${def.text.replace(/'/g, "''")}')
$synth.Dispose()
`;

  await execFileAsync('powershell', ['-NoProfile', '-Command', psScript]);

  // Apply vocal profile EQ & sample rate conversion to 48kHz stereo
  const filters = def.pitchFilter;
  await execFileAsync(ffmpegPath, [
    '-y', '-i', rawWav,
    '-af', `${filters},loudnorm=I=-16:TP=-1.5:LRA=7`,
    '-ar', '48000',
    '-ac', '2',
    finalWav
  ]);

  // Probe exact duration
  const { stderr } = await execFileAsync(ffmpegPath, ['-i', finalWav]).catch(e => ({ stderr: e.stderr || '' }));
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const durSec = match ? (parseFloat(match[1]) * 3600 + parseFloat(match[2]) * 60 + parseFloat(match[3])) : 2.5;
  speechClips[def.id] = {
    ...def,
    file: finalWav,
    durationSec: durSec
  };
  console.log(`  ✓ ${def.character.padEnd(8)}: "${def.id}" (${durSec.toFixed(2)}s) -> ${def.text}`);
}

// 2. COMPUTE NON-OVERLAPPING MASTER SCENE TIMELINE (AUDIO-FIRST)
console.log('\n[2/4] Calibrating Master Scene Timings to actual speech durations...');

// Buffer gaps
const introPadding = 0.4;
const lineGap = 0.45;

const tNarrator1_start = introPadding;
const tNarrator1_end = tNarrator1_start + speechClips['narrator_01'].durationSec;

// Scene 1: Morning Standup -> ends 0.4s after narrator finishes
const scene1_end = tNarrator1_end + 0.4;

// Scene 2: The Idea Drop
const tMax1_start = scene1_end + 0.2;
const tMax1_end = tMax1_start + speechClips['max_01'].durationSec;
const tSam1_start = tMax1_end + lineGap;
const tSam1_end = tSam1_start + speechClips['sam_01'].durationSec;
const scene2_end = tSam1_end + 0.5;

// Scene 3: The Task Assignment
const tMax2_start = scene2_end + 0.3;
const tMax2_end = tMax2_start + speechClips['max_02'].durationSec;
const scene3_end = tMax2_end + 0.6;

// Scene 4: The Notification Ping
const tAlex1_start = scene3_end + 0.4;
const tAlex1_end = tAlex1_start + speechClips['alex_01'].durationSec;
const scene4_end = tAlex1_end + 0.3;

// Scene 5: The Comedic Reaction (Alex deadpan beat & silence)
// Silence starts immediately after Alex asks "Wait... 6 PM today?!"
const silenceStart = scene4_end;
// Alex pauses, looks at task, eyes widen, head tilts, drops shoulders, slow turn to camera, deadpan blinks
const tAlex2_start = silenceStart + 2.4;
const tAlex2_end = tAlex2_start + speechClips['alex_02'].durationSec;
const silenceEnd = tAlex2_end + 0.6;
const scene5_end = silenceEnd;

// Scene 6: Paper5 Resolution & Brand Reveal
const tNarrator2_start = scene5_end + 0.4;
const tNarrator2_end = tNarrator2_start + speechClips['narrator_02'].durationSec;
const totalDurationSec = Math.ceil(tNarrator2_end + 1.6);

console.log(`  Scene 1 (Morning Standup)   : 0.00s -> ${scene1_end.toFixed(2)}s`);
console.log(`  Scene 2 (The Idea Drop)     : ${scene1_end.toFixed(2)}s -> ${scene2_end.toFixed(2)}s`);
console.log(`  Scene 3 (Task Assignment)   : ${scene2_end.toFixed(2)}s -> ${scene3_end.toFixed(2)}s`);
console.log(`  Scene 4 (Notification Ping) : ${scene3_end.toFixed(2)}s -> ${scene4_end.toFixed(2)}s`);
console.log(`  Scene 5 (Comedic Reaction)  : ${scene4_end.toFixed(2)}s -> ${scene5_end.toFixed(2)}s (Comedic silence: ${silenceStart.toFixed(2)}s - ${silenceEnd.toFixed(2)}s)`);
console.log(`  Scene 6 (Brand Resolution)  : ${scene5_end.toFixed(2)}s -> ${totalDurationSec.toFixed(2)}s`);
console.log(`  Total Master Duration       : ${totalDurationSec.toFixed(2)}s locked`);

// 3. SYNTHESIZE 92 BPM LIGHT ORCHESTRAL COMEDY SCORE (PCM 48kHz Stereo)
console.log('\n[3/4] Synthesizing bespoke 92 BPM Light Orchestral Comedy Score...');

const SAMPLE_RATE = 48000;
const BPM = 92;
const beatSec = 60 / BPM;
const barSec = beatSec * 4;
const totalSamples = Math.ceil(totalDurationSec * SAMPLE_RATE);

const musicLeft = new Float32Array(totalSamples);
const musicRight = new Float32Array(totalSamples);

function isSilent(time) {
  return time >= silenceStart && time < silenceEnd;
}

function addNote(bufferL, bufferR, startSec, durSec, freq, type, volume, pan = 0.0) {
  const startSample = Math.floor(startSec * SAMPLE_RATE);
  const noteSamples = Math.floor(durSec * SAMPLE_RATE);
  const endSample = Math.min(totalSamples, startSample + noteSamples);
  if (startSample >= totalSamples) return;

  const gainL = volume * (0.5 - pan * 0.5);
  const gainR = volume * (0.5 + pan * 0.5);

  for (let i = startSample; i < endSample; i++) {
    const t = (i - startSample) / SAMPLE_RATE;
    const progress = t / durSec;
    let env = 1.0;

    if (type === 'pizz') {
      env = Math.exp(-progress * 7.5);
    } else if (type === 'piano') {
      const attack = Math.min(1.0, t / 0.008);
      env = attack * (0.7 * Math.exp(-progress * 2.8) + 0.3 * Math.exp(-progress * 6.0));
    } else if (type === 'marimba') {
      const attack = Math.min(1.0, t / 0.003);
      env = attack * Math.exp(-progress * 9.0);
    } else if (type === 'flute') {
      const attack = Math.min(1.0, t / 0.02);
      const release = progress > 0.75 ? Math.max(0.0, 1.0 - (progress - 0.75) / 0.25) : 1.0;
      env = attack * release;
    } else if (type === 'bass') {
      const attack = Math.min(1.0, t / 0.01);
      env = attack * Math.exp(-progress * 4.0);
    }

    let sample = 0;
    if (type === 'pizz') {
      sample = Math.sin(2 * Math.PI * freq * t) * 0.6
             + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25
             + Math.sin(2 * Math.PI * freq * 3 * t) * 0.12
             + Math.sin(2 * Math.PI * freq * 4 * t) * 0.03;
    } else if (type === 'piano') {
      sample = Math.sin(2 * Math.PI * freq * t) * 0.55
             + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25
             + Math.sin(2 * Math.PI * freq * 3 * t) * 0.12
             + Math.sin(2 * Math.PI * freq * 4 * t) * 0.05
             + Math.sin(2 * Math.PI * freq * 5 * t) * 0.03;
    } else if (type === 'marimba') {
      sample = Math.sin(2 * Math.PI * freq * t) * 0.75
             + Math.sin(2 * Math.PI * freq * 3.8 * t) * 0.20
             + Math.sin(2 * Math.PI * freq * 9.2 * t) * 0.05;
    } else if (type === 'flute') {
      const vibrato = 1.0 + 0.015 * Math.sin(2 * Math.PI * 5.2 * t);
      sample = Math.sin(2 * Math.PI * freq * vibrato * t) * 0.85
             + Math.sin(2 * Math.PI * freq * 2 * vibrato * t) * 0.15;
    } else if (type === 'bass') {
      sample = Math.sin(2 * Math.PI * freq * t) * 0.7
             + Math.sin(2 * Math.PI * freq * 2 * t) * 0.25
             + Math.sin(2 * Math.PI * freq * 3 * t) * 0.05;
    }

    bufferL[i] += sample * env * gainL;
    bufferR[i] += sample * env * gainR;
  }
}

const noteFreqs = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50
};

const numBars = Math.ceil(totalDurationSec / barSec);
const barHarmonies = [
  { root: noteFreqs.C2, bass: noteFreqs.C3, chord: [noteFreqs.C4, noteFreqs.E4, noteFreqs.G4] }, // Bar 0: C Maj
  { root: noteFreqs.F2, bass: noteFreqs.F3, chord: [noteFreqs.C4, noteFreqs.F4, noteFreqs.A4] }, // Bar 1: F Maj
  { root: noteFreqs.A2, bass: noteFreqs.A3, chord: [noteFreqs.C4, noteFreqs.E4, noteFreqs.A4] }, // Bar 2: A Min
  { root: noteFreqs.G2, bass: noteFreqs.G3, chord: [noteFreqs.B3, noteFreqs.D4, noteFreqs.G4] }, // Bar 3: G Maj
  { root: noteFreqs.D2, bass: noteFreqs.D3, chord: [noteFreqs.D4, noteFreqs.F4, noteFreqs.A4] }, // Bar 4: D Min
  { root: noteFreqs.G2, bass: noteFreqs.G3, chord: [noteFreqs.B3, noteFreqs.F4, noteFreqs.G4] }, // Bar 5: G7
  { root: noteFreqs.E2, bass: noteFreqs.E3, chord: [noteFreqs.E4, noteFreqs.G4, noteFreqs.B4] }, // Bar 6: E Min
  { root: noteFreqs.F2, bass: noteFreqs.F3, chord: [noteFreqs.F4, noteFreqs.A4, noteFreqs.C5] }, // Bar 7: F Maj
  { root: noteFreqs.C2, bass: noteFreqs.C3, chord: [noteFreqs.E4, noteFreqs.G4, noteFreqs.C5] }, // Bar 8: C Maj
  { root: noteFreqs.F2, bass: noteFreqs.F3, chord: [noteFreqs.F4, noteFreqs.A4, noteFreqs.C5] }, // Bar 9: F Maj
  { root: noteFreqs.G2, bass: noteFreqs.G3, chord: [noteFreqs.G4, noteFreqs.B4, noteFreqs.D5] }, // Bar 10: G Maj
  { root: noteFreqs.C2, bass: noteFreqs.C3, chord: [noteFreqs.C4, noteFreqs.E4, noteFreqs.G4, noteFreqs.C5] } // Bar 11: C Maj finale
];

for (let barIdx = 0; barIdx < numBars; barIdx++) {
  const barStart = barIdx * barSec;
  const harmony = barHarmonies[barIdx % barHarmonies.length];

  // Upright bass
  const tBass1 = barStart;
  const tBass2 = barStart + beatSec * 2;
  if (!isSilent(tBass1)) addNote(musicLeft, musicRight, tBass1, beatSec * 0.9, harmony.root, 'bass', 0.40, -0.15);
  if (!isSilent(tBass2)) addNote(musicLeft, musicRight, tBass2, beatSec * 0.9, harmony.bass, 'bass', 0.36, -0.15);

  // Piano chords
  [0, 1.5, 3].forEach(b => {
    const tPiano = barStart + b * beatSec;
    if (!isSilent(tPiano)) {
      harmony.chord.forEach((note, nIdx) => {
        addNote(musicLeft, musicRight, tPiano + nIdx * 0.012, beatSec * 1.2, note, 'piano', 0.20, 0.2);
      });
    }
  });

  // Pizzicato bounce (offbeats)
  for (let s = 0; s < 8; s++) {
    const tPizz = barStart + s * (beatSec / 2);
    if (!isSilent(tPizz)) {
      const note = harmony.chord[s % harmony.chord.length];
      const vol = (s % 2 === 1) ? 0.28 : 0.16;
      addNote(musicLeft, musicRight, tPizz, 0.26, note, 'pizz', vol, -0.35);
    }
  }

  // Marimba accents
  if (barIdx % 2 === 1) {
    [0.5, 2.0, 2.75, 3.5].forEach((st, idx) => {
      const tMar = barStart + st * beatSec;
      if (!isSilent(tMar)) {
        const mFreq = harmony.chord[(idx + 1) % harmony.chord.length] * 2;
        addNote(musicLeft, musicRight, tMar, 0.20, mFreq, 'marimba', 0.22, 0.35);
      }
    });
  }

  // Flute flourishes
  if ([1, 3, 5, 9].includes(barIdx)) {
    [harmony.chord[0] * 2, harmony.chord[1] * 2, harmony.chord[2] * 2].forEach((fFreq, fIdx) => {
      const tFlute = barStart + (2.5 + fIdx * 0.35) * beatSec;
      if (!isSilent(tFlute)) {
        addNote(musicLeft, musicRight, tFlute, 0.30, fFreq, 'flute', 0.24, 0.05);
      }
    });
  }
}

const musicRawWav = path.join(audioDir, 'score_raw.wav');
writeFloat32ToWav(musicRawWav, musicLeft, musicRight, SAMPLE_RATE);

const musicProcessedWav = path.join(audioDir, 'score_processed.wav');
await execFileAsync(ffmpegPath, [
  '-y', '-i', musicRawWav,
  '-af', 'volume=0.82,lowpass=f=12000,highpass=f=45',
  '-ar', '48000',
  '-ac', '2',
  musicProcessedWav
]);

// 4. SYNTHESIZE BESPOKE SFX STEMS
// 4a. Keyboard typing
const typingBufferL = new Float32Array(SAMPLE_RATE * 2);
const typingBufferR = new Float32Array(SAMPLE_RATE * 2);
for (let c = 0; c < 14; c++) {
  const tClick = c * 0.11 + (Math.random() * 0.03);
  const clickSample = Math.floor(tClick * SAMPLE_RATE);
  for (let s = 0; s < 300; s++) {
    const noise = (Math.random() * 2 - 1) * Math.exp(-s / 40);
    if (clickSample + s < typingBufferL.length) {
      typingBufferL[clickSample + s] += noise * 0.18;
      typingBufferR[clickSample + s] += noise * 0.18;
    }
  }
}
const sfxTypingWav = path.join(audioDir, 'sfx_typing.wav');
writeFloat32ToWav(sfxTypingWav, typingBufferL, typingBufferR, SAMPLE_RATE);

// 4b. Modal open chime
const modalBufferL = new Float32Array(SAMPLE_RATE * 1);
const modalBufferR = new Float32Array(SAMPLE_RATE * 1);
addNote(modalBufferL, modalBufferR, 0.02, 0.45, 587.33, 'marimba', 0.35, -0.2);
addNote(modalBufferL, modalBufferR, 0.10, 0.65, 880.00, 'marimba', 0.42, 0.2);
const sfxModalWav = path.join(audioDir, 'sfx_modal.wav');
writeFloat32ToWav(sfxModalWav, modalBufferL, modalBufferR, SAMPLE_RATE);

// 4c. Notification ping
const pingBufferL = new Float32Array(SAMPLE_RATE * 1.5);
const pingBufferR = new Float32Array(SAMPLE_RATE * 1.5);
addNote(pingBufferL, pingBufferR, 0.0, 1.2, 1174.66, 'piano', 0.45, 0.25);
addNote(pingBufferL, pingBufferR, 0.0, 0.8, 1760.00, 'marimba', 0.30, 0.3);
const sfxPingWav = path.join(audioDir, 'sfx_ping.wav');
writeFloat32ToWav(sfxPingWav, pingBufferL, pingBufferR, SAMPLE_RATE);

// 4d. Clock tick (comically loud tick-tock during silence)
const clockBufferL = new Float32Array(SAMPLE_RATE * 2);
const clockBufferR = new Float32Array(SAMPLE_RATE * 2);
[0.1, 0.75, 1.4].forEach((tTick, idx) => {
  const tickSample = Math.floor(tTick * SAMPLE_RATE);
  const freq = (idx % 2 === 0) ? 1400 : 1000;
  for (let s = 0; s < 400; s++) {
    const tone = Math.sin(2 * Math.PI * freq * (s / SAMPLE_RATE)) * Math.exp(-s / 60);
    if (tickSample + s < clockBufferL.length) {
      clockBufferL[tickSample + s] += tone * 0.32;
      clockBufferR[tickSample + s] += tone * 0.32;
    }
  }
});
const sfxClockWav = path.join(audioDir, 'sfx_clock.wav');
writeFloat32ToWav(sfxClockWav, clockBufferL, clockBufferR, SAMPLE_RATE);

// 4e. Comedic double eye-blink pop
const blinkBufferL = new Float32Array(SAMPLE_RATE * 1);
const blinkBufferR = new Float32Array(SAMPLE_RATE * 1);
addNote(blinkBufferL, blinkBufferR, 0.05, 0.12, 659.25, 'pizz', 0.36, -0.1);
addNote(blinkBufferL, blinkBufferR, 0.22, 0.12, 880.00, 'pizz', 0.40, 0.1);
const sfxBlinkWav = path.join(audioDir, 'sfx_blink.wav');
writeFloat32ToWav(sfxBlinkWav, blinkBufferL, blinkBufferR, SAMPLE_RATE);

// 4f. Buffer resolution & finale shimmer
const finaleBufferL = new Float32Array(SAMPLE_RATE * 3);
const finaleBufferR = new Float32Array(SAMPLE_RATE * 3);
[523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
  addNote(finaleBufferL, finaleBufferR, idx * 0.08, 1.8, freq, 'marimba', 0.38, (idx - 1.5) * 0.2);
});
const sfxFinaleWav = path.join(audioDir, 'sfx_finale.wav');
writeFloat32ToWav(sfxFinaleWav, finaleBufferL, finaleBufferR, SAMPLE_RATE);

// 5. MASTER TIMELINE DATA STRUCTURE
const masterTimeline = {
  version: '2.0.0',
  title: 'Paper5 — Startup Chronicles (Episode 01: The 6 PM Deadline)',
  fps: 60,
  resolution: { width: 1080, height: 1920, aspect: '9:16' },
  durationSec: totalDurationSec,
  silenceWindow: { start: silenceStart, end: silenceEnd },
  scenes: [
    {
      id: 'scene_01',
      name: 'Morning Standup',
      startTime: 0.0,
      endTime: scene1_end,
      camera: { x: 0, y: 0, zoom: 1.0 },
      characters: {
        max: { state: 'idle_confident', x: 260, y: 1280 },
        alex: { state: 'desk_typing', x: 820, y: 1320 },
        sam: { state: 'sipping_coffee', x: 120, y: 1300 },
        mia: { state: 'tablet_review', x: 420, y: 1310 }
      },
      dialogue: [
        { id: 'narrator_01', start: tNarrator1_start, end: tNarrator1_end, text: speechClips['narrator_01'].text }
      ]
    },
    {
      id: 'scene_02',
      name: 'The Idea Drop',
      startTime: scene1_end,
      endTime: scene2_end,
      camera: { x: -120, y: -40, zoom: 1.15 },
      characters: {
        max: { state: 'speaking_gesturing', x: 300, y: 1260 },
        sam: { state: 'eyebrow_raise', x: 140, y: 1300 }
      },
      dialogue: [
        { id: 'max_01', start: tMax1_start, end: tMax1_end, text: speechClips['max_01'].text },
        { id: 'sam_01', start: tSam1_start, end: tSam1_end, text: speechClips['sam_01'].text }
      ]
    },
    {
      id: 'scene_03',
      name: 'The Task Assignment',
      startTime: scene2_end,
      endTime: scene3_end,
      camera: { x: 0, y: -70, zoom: 1.25 },
      characters: {
        max: { state: 'submitting_deadline', x: 280, y: 1250 }
      },
      dialogue: [
        { id: 'max_02', start: tMax2_start, end: tMax2_end, text: speechClips['max_02'].text }
      ],
      modal: {
        title: 'Pen-test report — Paper5 core',
        assignee: 'Alex Rivera',
        priority: 'High',
        due: '18:00 today',
        openTime: scene2_end + 0.3
      }
    },
    {
      id: 'scene_04',
      name: 'The Notification Ping',
      startTime: scene3_end,
      endTime: scene4_end,
      camera: { x: 240, y: -50, zoom: 1.35 },
      characters: {
        alex: { state: 'flow_coding_to_shock', x: 540, y: 1320 }
      },
      dialogue: [
        { id: 'alex_01', start: tAlex1_start, end: tAlex1_end, text: speechClips['alex_01'].text }
      ],
      toast: {
        text: 'New deadline assigned: Pen-test report (Due 18:00)',
        pingTime: scene3_end + 0.2
      }
    },
    {
      id: 'scene_05',
      name: 'The Comedic Reaction',
      startTime: scene4_end,
      endTime: scene5_end,
      camera: { x: 0, y: -40, zoom: 1.55 },
      characters: {
        alex: {
          state: 'deadpan_camera_turn',
          x: 540,
          y: 1280,
          reactionKeyframes: [
            { time: silenceStart + 0.2, action: 'eyes_widen', pupilScale: 1.4 },
            { time: silenceStart + 0.6, action: 'head_tilt', degrees: -6 },
            { time: silenceStart + 1.0, action: 'shoulders_drop', weightShiftY: 18 },
            { time: silenceStart + 1.4, action: 'turn_to_camera', headAngle: 0 },
            { time: silenceStart + 1.8, action: 'deadpan_blink_1' },
            { time: silenceStart + 2.2, action: 'deadpan_blink_2' }
          ]
        }
      },
      dialogue: [
        { id: 'alex_02', start: tAlex2_start, end: tAlex2_end, text: speechClips['alex_02'].text }
      ]
    },
    {
      id: 'scene_06',
      name: 'Paper5 Resolution & Brand Reveal',
      startTime: scene5_end,
      endTime: totalDurationSec,
      camera: { x: 0, y: 0, zoom: 1.0 },
      characters: {
        alex: { state: 'relieved_smile', x: 380, y: 1320 },
        max: { state: 'thumbs_up', x: 700, y: 1320 }
      },
      dialogue: [
        { id: 'narrator_02', start: tNarrator2_start, end: tNarrator2_end, text: speechClips['narrator_02'].text }
      ],
      brand: {
        logoTime: scene5_end + 0.5,
        confettiTime: scene5_end + 0.7,
        url: 'https://paper5.co',
        tagline: 'Everything on paper. Nothing on trust.'
      }
    }
  ]
};

const timelinePath = path.join(publicDir, 'timeline-ep01.json');
fs.writeFileSync(timelinePath, JSON.stringify(masterTimeline, null, 2));
console.log(`  ✓ Written Master Timeline: ${timelinePath}`);

// 6. ASSEMBLE MULTI-TRACK AUDIO MIXDOWN
console.log('\n[6/6] Mixing multi-track dialogue, score, and SFX at 48kHz stereo...');

const masterWavPath = path.join(publicDir, 'master_audio_ep01.wav');
const mixInputs = ['-i', musicProcessedWav];
const filterParts = [];
let inputIdx = 1;

const dOffsets = [
  { id: 'narrator_01', startMs: Math.round(tNarrator1_start * 1000) },
  { id: 'max_01', startMs: Math.round(tMax1_start * 1000) },
  { id: 'sam_01', startMs: Math.round(tSam1_start * 1000) },
  { id: 'max_02', startMs: Math.round(tMax2_start * 1000) },
  { id: 'alex_01', startMs: Math.round(tAlex1_start * 1000) },
  { id: 'alex_02', startMs: Math.round(tAlex2_start * 1000) },
  { id: 'narrator_02', startMs: Math.round(tNarrator2_start * 1000) }
];

for (const d of dOffsets) {
  mixInputs.push('-i', path.join(audioDir, `${d.id}.wav`));
  filterParts.push(`[${inputIdx}]adelay=${d.startMs}|${d.startMs},volume=1.4[d${inputIdx}]`);
  inputIdx++;
}

const sfxCues = [
  { file: sfxModalWav, startMs: Math.round((scene2_end + 0.3) * 1000), vol: 0.8 },
  { file: sfxTypingWav, startMs: Math.round((scene2_end + 0.8) * 1000), vol: 0.6 },
  { file: sfxPingWav, startMs: Math.round((scene3_end + 0.2) * 1000), vol: 1.1 },
  { file: sfxClockWav, startMs: Math.round((silenceStart + 0.3) * 1000), vol: 0.9 },
  { file: sfxBlinkWav, startMs: Math.round((silenceStart + 1.8) * 1000), vol: 0.7 },
  { file: sfxFinaleWav, startMs: Math.round((scene5_end + 0.5) * 1000), vol: 0.9 }
];

for (const s of sfxCues) {
  mixInputs.push('-i', s.file);
  filterParts.push(`[${inputIdx}]adelay=${s.startMs}|${s.startMs},volume=${s.vol}[sfx${inputIdx}]`);
  inputIdx++;
}

const mergeLabels = ['[0:a]'];
for (let i = 1; i <= dOffsets.length; i++) mergeLabels.push(`[d${i}]`);
for (let i = dOffsets.length + 1; i < inputIdx; i++) mergeLabels.push(`[sfx${i}]`);

const filterComplex = `${filterParts.join(';')};${mergeLabels.join('')}amix=inputs=${inputIdx}:duration=first:dropout_transition=2,volume=1.25,alimiter=limit=0.96`;

await execFileAsync(ffmpegPath, [
  '-y',
  ...mixInputs,
  '-filter_complex', filterComplex,
  '-ar', '48000',
  '-ac', '2',
  masterWavPath
]);

const { stderr: masterStderr } = await execFileAsync(ffmpegPath, ['-i', masterWavPath]).catch(e => ({ stderr: e.stderr || '' }));
const durMatch = masterStderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
const finalDur = durMatch ? `${durMatch[1]}:${durMatch[2]}:${durMatch[3]}` : `${totalDurationSec}s`;

console.log('\n' + '='.repeat(70));
console.log('✅ MASTER AUDIO STEMS COMPLETED');
console.log('='.repeat(70));
console.log(`Master Audio File : ${masterWavPath}`);
console.log(`Sample Rate       : 48,000 Hz Locked Stereo PCM`);
console.log(`Total Duration    : ${finalDur}`);
console.log(`Authoritative Sync: public/timeline-ep01.json`);
console.log('='.repeat(70) + '\n');

function writeFloat32ToWav(filePath, leftChannel, rightChannel, sampleRate) {
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = leftChannel.length;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sL = Math.max(-1.0, Math.min(1.0, leftChannel[i]));
    const sR = Math.max(-1.0, Math.min(1.0, rightChannel[i]));
    buffer.writeInt16LE(sL < 0 ? sL * 32768 : sL * 32767, offset);
    offset += 2;
    buffer.writeInt16LE(sR < 0 ? sR * 32768 : sR * 32767, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}
