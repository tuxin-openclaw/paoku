// 用 WebAudio 现场合成的小音效，不需要任何音频文件。
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('paoku-muted') === '1'; } catch {}

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, to, dur, type = 'sine', vol = 0.15, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  jump: () => tone(320, 720, 0.18, 'triangle', 0.14),
  swipe: () => tone(500, 380, 0.07, 'sine', 0.06),
  fish: (n = 0) => {
    const f = 880 * Math.pow(1.06, Math.min(n, 8));
    tone(f, f, 0.08, 'sine', 0.13);
    tone(f * 1.5, f * 1.5, 0.14, 'sine', 0.11, 0.06);
  },
  crash: () => {
    tone(220, 40, 0.45, 'sawtooth', 0.2);
    tone(90, 30, 0.5, 'square', 0.14);
  },
  milestone: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.12, i * 0.08)),
  start: () => [392, 523, 659].forEach((f, i) => tone(f, f, 0.1, 'triangle', 0.12, i * 0.07)),
  isMuted: () => muted,
  setMuted: (m) => {
    muted = m;
    try { localStorage.setItem('paoku-muted', m ? '1' : '0'); } catch {}
  },
};
