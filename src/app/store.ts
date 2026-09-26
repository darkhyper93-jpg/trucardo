import { useSyncExternalStore } from 'react';
import { applyAction, replay, type ApplyResult } from '../game/engine';
import { defaultSettings } from '../game/rules';
import type { Action, LogEntry, MatchState, Settings } from '../game/types';
import { load, save } from '../lib/storage';

export type TtsMode = 'off' | 'puntos' | 'todo';
export type ListenMode = 'continuo' | 'pulsar';

export interface Prefs {
  lang: string;
  listenMode: ListenMode;
  tts: TtsMode;
  sounds: boolean;
  keepAwake: boolean;
  lastSettings: Settings;
}

export interface Saved {
  settings: Settings;
  actions: Action[];
  /** Partidas ganadas por cada equipo en esta serie. */
  series: [number, number];
}

export interface Snapshot {
  saved: Saved | null;
  state: MatchState | null;
  prefs: Prefs;
}

const MATCH_KEY = 'trucardo:partida:v1';
const PREFS_KEY = 'trucardo:prefs:v1';

const DEFAULT_PREFS: Prefs = {
  lang: 'es-AR',
  listenMode: 'continuo',
  tts: 'puntos',
  sounds: true,
  keepAwake: true,
  lastSettings: defaultSettings('uruguayo'),
};

class Store {
  private snap: Snapshot;
  private listeners = new Set<() => void>();

  constructor() {
    const saved = load<Saved>(MATCH_KEY);
    const prefs = { ...DEFAULT_PREFS, ...(load<Partial<Prefs>>(PREFS_KEY) ?? {}) };
    let state: MatchState | null = null;
    if (saved?.settings && Array.isArray(saved.actions)) {
      try {
        state = replay(saved.settings, saved.actions);
      } catch {
        state = null;
      }
    }
    this.snap = { saved: state ? saved : null, state, prefs };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.snap;

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    if ('saved' in patch) save(MATCH_KEY, this.snap.saved);
    if ('prefs' in patch) save(PREFS_KEY, this.snap.prefs);
    this.listeners.forEach((fn) => fn());
  }

  dispatch(action: Action): ApplyResult {
    const { saved, state } = this.snap;
    if (!saved || !state) return { ok: false, error: 'No hay una partida en curso.' };
    const r = applyAction(state, action);
    if (r.ok) this.set({ saved: { ...saved, actions: [...saved.actions, action] }, state: r.state });
    return r;
  }

  /** Deshace la última jugada. Devuelve lo que se borró del historial. */
  undo(): LogEntry[] | null {
    const { saved, state } = this.snap;
    if (!saved || !state || !saved.actions.length) return null;
    const actions = saved.actions.slice(0, -1);
    const next = replay(saved.settings, actions);
    this.set({ saved: { ...saved, actions }, state: next });
    return state.log.slice(next.log.length);
  }

  newMatch(settings: Settings) {
    const saved: Saved = { settings, actions: [], series: [0, 0] };
    this.set({ saved, state: replay(settings, []), prefs: { ...this.snap.prefs, lastSettings: settings } });
  }

  /** Revancha: misma configuración, suma la partida terminada a la serie. */
  rematch() {
    const { saved, state } = this.snap;
    if (!saved || !state) return;
    const series: [number, number] = [...saved.series];
    if (state.winner !== null) series[state.winner]++;
    this.set({ saved: { settings: saved.settings, actions: [], series }, state: replay(saved.settings, []) });
  }

  /** Cambia nombres u otras opciones de la partida en curso sin perder las jugadas. */
  updateSettings(patch: Partial<Settings>) {
    const { saved } = this.snap;
    if (!saved) return;
    const settings = { ...saved.settings, ...patch };
    this.set({
      saved: { ...saved, settings },
      state: replay(settings, saved.actions),
      prefs: { ...this.snap.prefs, lastSettings: settings },
    });
  }

  endMatch() {
    this.set({ saved: null, state: null });
  }

  setPrefs(patch: Partial<Prefs>) {
    this.set({ prefs: { ...this.snap.prefs, ...patch } });
  }
}

export const store = new Store();

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
