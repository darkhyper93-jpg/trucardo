/* Sonidos cortos sintetizados (sin archivos): palito que se apoya al sumar, clic al cantar, aviso de error. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** "Toc": un palito que se apoya sobre la mesa de madera, uno por punto (hasta 6). */
export function place(sticks = 1) {
  const a = audio();
  if (!a) return;
  for (let k = 0; k < Math.min(sticks, 6); k++) {
    const t0 = a.currentTime + k * 0.09;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, 0.06);
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500 + (k % 2) * 250;
    bp.Q.value = 3;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
    src.connect(bp).connect(g).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.06);
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function click() {
  tone(880, 0.08, 'triangle', 0.12);
}

export function errorBlip() {
  tone(220, 0.14, 'sine', 0.18);
  tone(180, 0.18, 'sine', 0.14, 0.1);
}

export function fanfare() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.13));
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no soportado */
  }
}
