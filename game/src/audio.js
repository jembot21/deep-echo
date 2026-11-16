// audio.js — every sound in Deep Echo is synthesised with WebAudio: no audio
// files, nothing to load. A sonar ping sweeps down, salvage chimes, mines burst
// into noise, and a low ambient hum sits under the dive. All entry points are
// safe to call before the first user gesture; the context wakes on `unlock()`.

let ctx = null;
let master = null;
let ambientNodes = null;

function ensureContext() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return true;
}

export function unlockAudio() {
  if (!ensureContext()) return;
  if (ctx.state === 'suspended') ctx.resume();
  startAmbient();
}

function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

function noiseBurst(seconds, volume, cutoff) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

function startAmbient() {
  if (!ctx || ambientNodes) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 52;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(gain.gain);
  osc.connect(gain).connect(master);
  osc.start();
  lfo.start();
  ambientNodes = { osc, gain, lfo };
}

export function playPing() {
  tone(920, 240, 0.7, 'sine', 0.35);
  tone(1380, 360, 0.5, 'sine', 0.12, 0.03);
}

export function playBlip(pitch = 1) {
  tone(520 * pitch, 660 * pitch, 0.09, 'triangle', 0.22);
}

export function playPickup() {
  tone(660, 660, 0.08, 'triangle', 0.25);
  tone(990, 990, 0.14, 'triangle', 0.25, 0.07);
}

export function playExplosion() {
  noiseBurst(0.5, 0.6, 900);
  tone(120, 40, 0.5, 'sine', 0.5);
}

export function playSting() {
  tone(300, 140, 0.18, 'square', 0.18);
}

export function playAlarm() {
  tone(1180, 1180, 0.09, 'sine', 0.16);
  tone(1180, 1180, 0.09, 'sine', 0.16, 0.16);
}

export function playDiveComplete() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.24, i * 0.11));
}

export function playGameOver() {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => tone(f, f * 0.94, 0.3, 'triangle', 0.22, i * 0.16));
}
