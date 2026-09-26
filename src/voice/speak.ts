/* Confirmaciones habladas con la voz del sistema. */

const PREFERRED = ['es-AR', 'es-UY', 'es-419', 'es-US', 'es-MX', 'es-ES'];

let cached: SpeechSynthesisVoice | null = null;
let cachedFor = '';

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (cached && cachedFor === lang) return cached;
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
  const order = [lang, ...PREFERRED.filter((l) => l !== lang)];
  let found: SpeechSynthesisVoice | null = null;
  for (const l of order) {
    found = voices.find((v) => norm(v) === l) ?? null;
    if (found) break;
  }
  found ??= voices.find((v) => norm(v).startsWith('es')) ?? null;
  if (found) {
    cached = found;
    cachedFor = lang;
  }
  return found;
}

if (ttsSupported()) {
  window.speechSynthesis.onvoiceschanged = () => {
    cached = null;
  };
}

export function speak(text: string, lang: string, hooks: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!ttsSupported() || !text) {
    hooks.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = 1.08;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(guard);
    hooks.onEnd?.();
  };
  u.onend = finish;
  u.onerror = finish;
  // Algunos navegadores no disparan onend: corte de seguridad según el largo del texto.
  const guard = setTimeout(finish, 1500 + text.length * 90);
  hooks.onStart?.();
  synth.speak(u);
}

const WORDS = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
export function numWord(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}
