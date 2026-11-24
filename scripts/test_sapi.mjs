import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const tempAudioDir = path.resolve('temp_render/audio');
if (!fs.existsSync(tempAudioDir)) fs.mkdirSync(tempAudioDir, { recursive: true });

const testWav = path.join(tempAudioDir, 'test_voice.wav');

const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft David Desktop')
$synth.Rate = 0
$synth.SetOutputToWaveFile('${testWav.replace(/\\/g, '\\\\')}')
$synth.Speak('Monday morning at Paper5. Sprint 42 was completely on schedule.')
$synth.Dispose()
`;

console.log('Testing SAPI voice synthesis...');
const { stdout, stderr } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript]);
console.log('Result file exists:', fs.existsSync(testWav));
if (fs.existsSync(testWav)) {
  console.log('File size:', fs.statSync(testWav).size, 'bytes');
}
