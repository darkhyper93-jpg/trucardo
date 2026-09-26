import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction } from '../game/engine';
import type { LogEntry, MatchState, Team } from '../game/types';
import { click, errorBlip, fanfare, place, vibrate } from '../lib/sound';
import { resolveIntent, withTeam } from '../voice/interpret';
import { parse, type Intent } from '../voice/parser';
import { VoiceListener, speechSupported, type ListenState } from '../voice/recognizer';
import { numWord, speak } from '../voice/speak';
import { store } from './store';

export interface Ask {
  intent: Intent;
  rest: Intent[];
  question: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'points' | 'error' | 'info';
  undoable: boolean;
}

export interface Heard {
  text: string;
  result: string;
  ok: boolean;
}

type Source = 'voice' | 'touch';

let toastSeq = 0;

/** Qué tan bien "cierra" una alternativa del reconocedor con el estado actual. */
function scoreAlternative(state: MatchState, intents: Intent[]): number {
  let s = state;
  let score = 0;
  for (const intent of intents) {
    const r = resolveIntent(s, intent);
    if (r.kind === 'action') {
      const out = applyAction(s, r.action);
      if (out.ok) {
        score += 3;
        s = out.state;
      }
    } else if (r.kind === 'ask' || r.kind === 'undo') score += 1;
  }
  return score;
}

function spokenSummary(entries: LogEntry[], state: MatchState, mode: 'puntos' | 'todo'): string {
  const names = state.settings.names;
  const parts: string[] = [];
  if (mode === 'todo')
    parts.push(...entries.filter((e) => e.kind === 'call' || e.kind === 'answer' || e.kind === 'hand').map((e) => e.text));
  const pts = entries.filter((e) => e.kind === 'points' && e.team !== undefined);
  for (const e of pts) {
    const n = e.pts ?? 0;
    parts.push(n > 0 ? `${numWord(n)} para ${names[e.team!]}` : `menos ${numWord(-n)} a ${names[e.team!]}`);
  }
  const infos = entries.filter((e) => e.kind === 'info' && !e.text.startsWith('('));
  if (pts.length && state.winner === null) parts.push(`${names[0]} ${state.score[0]}, ${names[1]} ${state.score[1]}`);
  parts.push(...infos.map((e) => e.text.replace(/[¡!]/g, '')));
  return parts.join('. ');
}

function toastFor(entries: LogEntry[]): Omit<Toast, 'id'> | null {
  if (!entries.length) return null;
  const pts = entries.filter((e) => e.kind === 'points');
  const win = entries.find((e) => e.kind === 'info' && e.text.startsWith('¡'));
  if (win) return { text: win.text, tone: 'points', undoable: true };
  if (pts.length) return { text: pts.map((e) => e.text).join(' · '), tone: 'points', undoable: true };
  const main = [...entries].reverse().find((e) => e.kind !== 'info') ?? entries[entries.length - 1];
  return { text: main.text, tone: 'ok', undoable: true };
}

export function useController() {
  const [ask, setAskState] = useState<Ask | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [interim, setInterim] = useState('');
  const [listen, setListen] = useState<ListenState>('off');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const askRef = useRef<Ask | null>(null);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerRef = useRef<VoiceListener | null>(null);

  const setAsk = useCallback((a: Ask | null) => {
    askRef.current = a;
    setAskState(a);
    if (askTimer.current) clearTimeout(askTimer.current);
    if (a) askTimer.current = setTimeout(() => setAsk(null), 20000);
  }, []);

  const showToast = useCallback((t: Omit<Toast, 'id'> | null) => {
    if (t) setToast({ ...t, id: ++toastSeq });
  }, []);

  const say = useCallback((text: string) => {
    const { prefs } = store.get();
    if (prefs.tts === 'off' || !text) return;
    const l = listenerRef.current;
    speak(text, prefs.lang, {
      onStart: () => l?.pause(),
      onEnd: () => setTimeout(() => l?.resume(), 350),
    });
  }, []);

  const feedback = useCallback(
    (entries: LogEntry[], errors: string[], source: Source, question?: string) => {
      const { prefs, state } = store.get();
      if (!state) return;
      const hasPoints = entries.some((e) => e.kind === 'points');
      const won = entries.some((e) => e.kind === 'info' && e.text.startsWith('¡'));
      if (prefs.sounds) {
        if (won) fanfare();
        else if (hasPoints) place(entries.reduce((n, e) => n + (e.kind === 'points' ? Math.max(0, e.pts ?? 0) : 0), 0) || 1);
        else if (entries.length) click();
        else if (errors.length) errorBlip();
      }
      if (hasPoints) vibrate(35);
      else if (errors.length && !entries.length) vibrate([40, 60, 40]);

      if (entries.length) showToast(toastFor(entries));
      else if (errors.length) showToast({ text: errors[errors.length - 1], tone: 'error', undoable: false });

      if (prefs.tts !== 'off') {
        let text = entries.length ? spokenSummary(entries, state, prefs.tts) : '';
        if (!entries.length && errors.length && source === 'voice' && prefs.tts === 'todo') text = errors[errors.length - 1];
        if (question && source === 'voice') text = text ? `${text}. ${question}` : question;
        say(text);
      }
    },
    [say, showToast],
  );

  const doUndo = useCallback((): string | null => {
    const removed = store.undo();
    if (!removed) {
      showToast({ text: 'No hay nada para deshacer.', tone: 'info', undoable: false });
      return null;
    }
    const main = removed.find((e) => e.kind !== 'info') ?? removed[0];
    const text = main ? `Deshecho: ${main.text}` : 'Deshecho';
    showToast({ text, tone: 'info', undoable: false });
    if (store.get().prefs.sounds) click();
    return text;
  }, [showToast]);

  /** Ejecuta intenciones en orden. Devuelve un resumen de lo que se entendió. */
  const run = useCallback(
    (intents: Intent[], source: Source): { summary: string; ok: boolean } => {
      const queue = [...intents];
      const entries: LogEntry[] = [];
      const errors: string[] = [];
      let question: string | undefined;
      let undone: string | null = null;

      while (queue.length) {
        let intent = queue.shift()!;
        const pending = askRef.current;
        if (pending) {
          setAsk(null);
          if (intent.k === 'team') {
            intent = withTeam(pending.intent, intent.team);
            queue.unshift(...pending.rest);
          }
        }
        const state = store.get().state;
        if (!state) break;
        const r = resolveIntent(state, intent);
        if (r.kind === 'action') {
          const out = store.dispatch(r.action);
          if (out.ok) entries.push(...out.entries);
          else errors.push(out.error);
        } else if (r.kind === 'ask') {
          question = r.question;
          setAsk({ intent, rest: [...queue], question });
          break;
        } else if (r.kind === 'undo') {
          undone = doUndo();
        } else if (r.kind === 'rematch') {
          store.rematch();
          undone = 'Revancha: nueva partida';
        } else if (!r.quiet) {
          errors.push(r.message);
        }
      }

      if (!undone) feedback(entries, errors, source, question);
      else if (source === 'voice') say(undone);

      const summary = undone
        ? undone
        : question
          ? question
          : entries.length
            ? entries.filter((e) => e.kind !== 'info').map((e) => e.text).join(' · ') || entries[0].text
            : errors[errors.length - 1] ?? '';
      return { summary, ok: !!(entries.length || question || undone) };
    },
    [doUndo, feedback, say, setAsk],
  );

  const handleUtterance = useCallback(
    (alternatives: string[]) => {
      const { state } = store.get();
      if (!state) return;
      setVoiceError(null);
      const names = state.settings.names;
      let best = { text: alternatives[0] ?? '', intents: [] as Intent[], score: -1 };
      alternatives.forEach((text, i) => {
        const intents = parse(text, names);
        if (!intents.length) return;
        // Pequeña ventaja para la primera alternativa (la más probable).
        const score = scoreAlternative(state, intents) + (i === 0 ? 0.5 : 0);
        if (score > best.score) best = { text, intents, score };
      });
      if (!best.intents.length) {
        setHeard({ text: alternatives[0] ?? '', result: '', ok: false });
        return;
      }
      const { summary, ok } = run(best.intents, 'voice');
      setHeard({ text: best.text, result: summary, ok });
    },
    [run],
  );

  const tap = useCallback((intent: Intent) => run([intent], 'touch'), [run]);

  const answerAsk = useCallback((team: Team) => run([{ k: 'team', team }], 'touch'), [run]);

  const undo = useCallback(() => {
    setAsk(null);
    doUndo();
  }, [doUndo, setAsk]);

  // ------------------------------------------------ micrófono

  const ensureListener = useCallback(() => {
    if (!listenerRef.current) {
      const { prefs } = store.get();
      listenerRef.current = new VoiceListener(
        {
          onFinal: (alts) => handleRef.current(alts),
          onInterim: setInterim,
          onState: setListen,
          onError: (msg, fatal) => {
            setVoiceError(msg);
            if (fatal) setListen('off');
          },
        },
        { lang: prefs.lang, continuous: prefs.listenMode === 'continuo' },
      );
    }
    return listenerRef.current;
  }, []);

  const handleRef = useRef(handleUtterance);
  handleRef.current = handleUtterance;

  const toggleListening = useCallback(() => {
    if (!speechSupported()) {
      setVoiceError('Este navegador no reconoce voz. Usá Chrome en Android o Safari en iPhone; mientras tanto podés usar los botones.');
      return;
    }
    const l = ensureListener();
    setVoiceError(null);
    if (l.active) l.stop();
    else {
      const { prefs } = store.get();
      l.configure({ lang: prefs.lang, continuous: prefs.listenMode === 'continuo' });
      l.start();
    }
  }, [ensureListener]);

  const reconfigure = useCallback(() => {
    const { prefs } = store.get();
    listenerRef.current?.configure({ lang: prefs.lang, continuous: prefs.listenMode === 'continuo' });
  }, []);

  useEffect(
    () => () => {
      listenerRef.current?.stop();
      if (askTimer.current) clearTimeout(askTimer.current);
    },
    [],
  );

  const typed = useCallback((text: string) => handleUtterance([text]), [handleUtterance]);

  return {
    ask,
    cancelAsk: () => setAsk(null),
    answerAsk,
    toast,
    dismissToast: () => setToast(null),
    heard,
    interim,
    listen,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    toggleListening,
    reconfigure,
    tap,
    undo,
    typed,
  };
}

export type Controller = ReturnType<typeof useController>;
