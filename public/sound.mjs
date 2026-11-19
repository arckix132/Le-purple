// Every sound is synthesised on the fly: no files to download, works offline.
let ctx = null, master = null, noiseBuffer = null, enabled = true;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noise() {
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function tone(freq, start, dur, {type = 'triangle', vol = 0.22, to = null, attack = 0.008} = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function hiss(start, dur, {freq = 2000, q = 0.8, vol = 0.25, sweepTo = null, type = 'bandpass'} = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + start;
  s.buffer = noise();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

// Pentatonic steps so a rising streak always sounds good.
const STEPS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

const SOUNDS = {
  tap() { tone(880, 0, 0.05, {type: 'sine', vol: 0.12}); hiss(0, 0.03, {freq: 4000, vol: 0.08}); },
  chip() { tone(1900, 0, 0.04, {type: 'square', vol: 0.05}); tone(1400, 0.025, 0.06, {type: 'square', vol: 0.04}); hiss(0, 0.05, {freq: 5000, q: 2, vol: 0.12}); },
  deal() { hiss(0, 0.16, {freq: 900, sweepTo: 4200, q: 0.6, vol: 0.22}); },
  flip() { hiss(0, 0.05, {freq: 3000, q: 1.2, vol: 0.32, type: 'highpass'}); tone(220, 0, 0.06, {type: 'sine', vol: 0.12}); },
  heartbeat() { tone(70, 0, 0.16, {type: 'sine', vol: 0.5, to: 45}); tone(70, 0.24, 0.2, {type: 'sine', vol: 0.4, to: 45}); },
  hit(level = 1) {
    const base = Math.min(level, 5);
    tone(STEPS[base - 1], 0, 0.16, {vol: 0.2});
    tone(STEPS[base + 1], 0.07, 0.24, {vol: 0.2});
    tone(STEPS[base + 1] * 2, 0.07, 0.18, {type: 'sine', vol: 0.05});
  },
  purple() {
    [0, 4, 7, 12].forEach((s, i) => tone(392 * 2 ** (s / 12), i * 0.06, 0.4, {vol: 0.16}));
    tone(1568, 0.26, 0.5, {type: 'sine', vol: 0.06});
    hiss(0.2, 0.4, {freq: 7000, q: 3, vol: 0.06});
  },
  miss() {
    tone(330, 0, 0.18, {type: 'sawtooth', vol: 0.09, to: 250});
    tone(247, 0.17, 0.42, {type: 'sawtooth', vol: 0.09, to: 150});
    hiss(0, 0.08, {freq: 300, vol: 0.18, type: 'lowpass'});
  },
  pass() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.3, {vol: 0.17}));
    [1046.5, 1318.5].forEach(f => tone(f, 0.36, 0.7, {type: 'sine', vol: 0.09}));
    hiss(0.3, 0.5, {freq: 8000, q: 4, vol: 0.05});
  },
  win() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => tone(f, i * 0.11, 0.32, {vol: 0.15}));
    tone(1568, 0.8, 1.1, {type: 'sine', vol: 0.08});
  },
  join() { tone(659.25, 0, 0.12, {type: 'sine', vol: 0.15}); tone(987.77, 0.08, 0.2, {type: 'sine', vol: 0.15}); },
};

export function setSound(on) { enabled = on; if (on) audio(); }
export function unlock() { if (enabled) audio(); }
export function play(name, arg, delay = 0) {
  if (!enabled || document.hidden) return;
  const run = () => { if (!audio()) return; try { SOUNDS[name]?.(arg); } catch { /* audio is a bonus */ } };
  delay ? setTimeout(run, delay) : run();
}
export function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* not supported */ } }
