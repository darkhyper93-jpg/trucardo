/* Envoltorio de la Web Speech API: escucha continua con reinicio automático,
   descarte de resultados repetidos y pausa mientras la app habla. */

export type ListenState = 'off' | 'starting' | 'listening' | 'hearing' | 'paused';

export interface ListenerEvents {
  onFinal(alternatives: string[]): void;
  onInterim(text: string): void;
  onState(state: ListenState): void;
  onError(message: string, fatal: boolean): void;
}

export interface ListenerOptions {
  lang: string;
  /** true = manos libres; false = una frase por toque. */
  continuous: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecognition = any;

function ctor(): (new () => AnyRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return ctor() !== null;
}

const ERRORS: Record<string, [string, boolean]> = {
  'not-allowed': ['Sin permiso para usar el micrófono. Habilitalo en los permisos del sitio.', true],
  'service-not-allowed': ['El navegador no permite el reconocimiento de voz en este sitio.', true],
  'audio-capture': ['No se encontró un micrófono.', true],
  network: ['Sin conexión: el reconocimiento de voz necesita internet.', false],
  'language-not-supported': ['El idioma elegido no está disponible para reconocer voz.', true],
};

export class VoiceListener {
  private rec: AnyRecognition | null = null;
  private want = false;
  private paused = false;
  private failures = 0;
  private lastStart = 0;
  private lastFinal = { text: '', at: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ev: ListenerEvents,
    private opts: ListenerOptions,
  ) {}

  get active(): boolean {
    return this.want;
  }

  start() {
    this.want = true;
    this.failures = 0;
    this.paused = false;
    this.spawn();
  }

  stop() {
    this.want = false;
    this.clearTimer();
    this.kill();
    this.ev.onState('off');
  }

  /** Mientras la app habla se deja de escuchar, para no oírse a sí misma. */
  pause() {
    if (!this.want || this.paused) return;
    this.paused = true;
    this.clearTimer();
    this.kill();
    this.ev.onState('paused');
  }

  resume() {
    if (!this.want || !this.paused) return;
    this.paused = false;
    this.spawn();
  }

  configure(opts: Partial<ListenerOptions>) {
    this.opts = { ...this.opts, ...opts };
    if (this.want && !this.paused) {
      this.kill();
      this.spawn();
    }
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private kill() {
    const r = this.rec;
    this.rec = null;
    if (r) {
      r.onend = r.onresult = r.onerror = r.onstart = r.onspeechstart = r.onspeechend = null;
      try {
        r.abort();
      } catch {
        /* ya estaba cerrado */
      }
    }
  }

  private spawn() {
    const C = ctor();
    if (!C || this.rec || this.paused || !this.want) return;
    const rec: AnyRecognition = new C();
    rec.lang = this.opts.lang;
    rec.continuous = this.opts.continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    const handled = new Set<number>();

    rec.onstart = () => this.ev.onState('listening');
    rec.onspeechstart = () => this.ev.onState('hearing');
    rec.onspeechend = () => this.ev.onState('listening');
    rec.onresult = (e: any) => {
      if (this.paused) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          if (handled.has(i)) continue;
          handled.add(i);
          const alts: string[] = [];
          for (let j = 0; j < res.length; j++) {
            const t = String(res[j].transcript || '').trim();
            if (t && !alts.includes(t)) alts.push(t);
          }
          if (!alts.length) continue;
          const now = Date.now();
          // Chrome en Android a veces repite el mismo resultado final.
          if (alts[0] === this.lastFinal.text && now - this.lastFinal.at < 2500) continue;
          this.lastFinal = { text: alts[0], at: now };
          this.failures = 0;
          this.ev.onInterim('');
          this.ev.onFinal(alts);
        } else {
          interim += res[0]?.transcript ?? '';
        }
      }
      if (interim) this.ev.onInterim(interim.trim());
    };
    rec.onerror = (e: any) => {
      const code = String(e.error || '');
      if (code === 'no-speech' || code === 'aborted') return;
      const [msg, fatal] = ERRORS[code] ?? [`Error del reconocimiento de voz (${code}).`, false];
      if (fatal) this.want = false;
      this.failures++;
      this.ev.onError(msg, fatal);
    };
    rec.onend = () => {
      this.rec = null;
      if (!this.want || this.paused) {
        if (!this.want) this.ev.onState('off');
        return;
      }
      if (!this.opts.continuous) {
        this.want = false;
        this.ev.onState('off');
        return;
      }
      // Reinicio automático; si se corta enseguida, esperar cada vez un poco más.
      const quick = Date.now() - this.lastStart < 1500;
      const delay = quick || this.failures ? Math.min(8000, 250 * 2 ** Math.min(this.failures + (quick ? 1 : 0), 5)) : 120;
      if (quick) this.failures++;
      this.ev.onState('starting');
      this.clearTimer();
      this.timer = setTimeout(() => this.spawn(), delay);
    };

    this.rec = rec;
    this.ev.onState('starting');
    try {
      this.lastStart = Date.now();
      rec.start();
    } catch {
      this.rec = null;
      this.timer = setTimeout(() => this.spawn(), 500);
    }
  }
}
