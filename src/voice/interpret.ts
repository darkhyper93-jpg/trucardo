import { applyAction, awaiting, florPhase } from '../game/engine';
import { ENVIDO_LABEL, FLOR_BET_LABEL, TRUCO_LABEL } from '../game/rules';
import { other, type Action, type MatchState, type Team } from '../game/types';
import type { CallKind, Intent } from './parser';

export type Resolved =
  | { kind: 'action'; action: Action }
  | { kind: 'ask'; question: string }
  | { kind: 'undo' }
  | { kind: 'rematch' }
  | { kind: 'error'; message: string; quiet?: boolean };

const CALL_LABEL: Record<CallKind, string> = {
  truco: TRUCO_LABEL[1],
  retruco: TRUCO_LABEL[2],
  vale4: TRUCO_LABEL[3],
  envido: ENVIDO_LABEL.envido,
  real: ENVIDO_LABEL.real,
  falta: ENVIDO_LABEL.falta,
  flor: 'flor',
  contraflor: FLOR_BET_LABEL.contraflor,
  resto: FLOR_BET_LABEL.resto,
  conflorenvido: FLOR_BET_LABEL.conflorenvido,
};

export function callLabel(call: CallKind): string {
  return CALL_LABEL[call];
}

const TRUCO_LEVEL: Partial<Record<CallKind, 1 | 2 | 3>> = { truco: 1, retruco: 2, vale4: 3 };
const ENVIDO_KIND = { envido: 'envido', real: 'real', falta: 'falta' } as const;
const FLOR_BET = { contraflor: 'contraflor', resto: 'resto', conflorenvido: 'conflorenvido' } as const;

/** Quién está cantando, cuando no lo dijeron, deducido de la mano en curso. */
export function inferCallTeam(state: MatchState, call: CallKind): Team | null {
  const h = state.hand;
  const level = TRUCO_LEVEL[call];
  if (level) {
    const p = h.truco.pending;
    if (p) return p.level === level ? p.by : other(p.by);
    return h.truco.holder;
  }
  if (call in ENVIDO_KIND) {
    const calls = h.envido.calls;
    const last = calls[calls.length - 1];
    if (h.envido.status === 'pending' && last) return last.kind === call ? last.by : other(last.by);
    if (h.truco.pending) return other(h.truco.pending.by);
    return null;
  }
  const f = h.flor;
  const phase = florPhase(f);
  if (call === 'flor') {
    const e = h.envido.calls[h.envido.calls.length - 1];
    if (h.envido.status === 'pending' && e) return other(e.by);
    if (phase === 'solo' && state.settings.players === 2) return other(f.flores[0]);
    if (phase === 'none' && h.truco.pending) return other(h.truco.pending.by);
    return null;
  }
  // apuestas de flor
  const lastBet = f.bets[f.bets.length - 1];
  if (lastBet) return other(lastBet.by);
  if (phase === 'solo') return other(f.flores[0]);
  if (phase === 'duel') return other(f.flores[f.flores.length - 1]);
  return null;
}

function florResponder(state: MatchState): Team | null {
  const f = state.hand.flor;
  const lastBet = f.bets[f.bets.length - 1];
  if (f.betStatus === 'pending' && lastBet) return other(lastBet.by);
  if (f.flores.length) return other(f.flores[0]);
  return null;
}

function callAction(call: CallKind, team: Team): Action {
  const level = TRUCO_LEVEL[call];
  if (level) return { t: 'truco', team, level };
  if (call in ENVIDO_KIND) return { t: 'envido', team, kind: ENVIDO_KIND[call as keyof typeof ENVIDO_KIND] };
  if (call === 'flor') return { t: 'flor', team };
  return { t: 'florBet', team, kind: FLOR_BET[call as keyof typeof FLOR_BET] };
}

export function resolveIntent(state: MatchState, intent: Intent): Resolved {
  const wait = awaiting(state);
  switch (intent.k) {
    case 'undo':
      return { kind: 'undo' };
    case 'rematch':
      if (state.winner === null) return { kind: 'error', message: '', quiet: true };
      return { kind: 'rematch' };
    case 'call': {
      // "envido nosotros" con el envido ya querido = dicen quién lo ganó.
      if (intent.team !== undefined && intent.call in ENVIDO_KIND && wait.envidoWinner)
        return { kind: 'action', action: { t: 'ganaEnvido', team: intent.team } };
      if (intent.team !== undefined && intent.call === 'flor' && wait.florWinner)
        return { kind: 'action', action: { t: 'ganaFlor', team: intent.team } };
      const team = intent.team ?? inferCallTeam(state, intent.call);
      if (team !== null) return { kind: 'action', action: callAction(intent.call, team) };
      // Antes de preguntar quién fue: si nadie puede cantarlo, avisar; si solo uno puede, es ese.
      const tries = ([0, 1] as Team[]).map((t) => ({ t, r: applyAction(state, callAction(intent.call, t)) }));
      const legal = tries.filter((x) => x.r.ok);
      if (legal.length === 0) {
        const first = tries[0].r;
        return { kind: 'error', message: first.ok ? '' : first.error };
      }
      if (legal.length === 1) return { kind: 'action', action: callAction(intent.call, legal[0].t) };
      return { kind: 'ask', question: `¿Quién cantó ${CALL_LABEL[intent.call]}?` };
    }
    case 'quiero':
      return { kind: 'action', action: { t: 'quiero' } };
    case 'noQuiero':
      return { kind: 'action', action: { t: 'noQuiero' } };
    case 'florQuiero':
    case 'achico': {
      const team = intent.team ?? florResponder(state);
      if (team === null) return { kind: 'ask', question: '¿Quién tiene la otra flor?' };
      return { kind: 'action', action: { t: intent.k, team } };
    }
    case 'buenas':
      if (florPhase(state.hand.flor) !== 'solo') return { kind: 'error', message: '', quiet: true };
      return { kind: 'action', action: { t: 'buenas' } };
    case 'win': {
      const subject =
        intent.subject ?? (wait.envidoWinner ? 'envido' : wait.florWinner ? 'flor' : 'mano');
      if (intent.team === undefined) {
        const what = subject === 'envido' ? 'el envido' : subject === 'flor' ? 'la flor' : 'la mano';
        return { kind: 'ask', question: `¿Quién ganó ${what}?` };
      }
      const t = subject === 'envido' ? 'ganaEnvido' : subject === 'flor' ? 'ganaFlor' : 'ganaMano';
      return { kind: 'action', action: { t, team: intent.team } };
    }
    case 'mazo': {
      const p = state.hand.truco.pending;
      const team = intent.team ?? (p ? other(p.by) : null);
      if (team === null) return { kind: 'ask', question: '¿Quién se fue al mazo?' };
      return { kind: 'action', action: { t: 'mazo', team, primera: intent.primera } };
    }
    case 'points': {
      if (intent.team === undefined) {
        const verb = intent.delta > 0 ? 'sumo' : 'resto';
        return { kind: 'ask', question: `¿A quién le ${verb} ${Math.abs(intent.delta)}?` };
      }
      return { kind: 'action', action: { t: 'ajuste', team: intent.team, delta: intent.delta } };
    }
    case 'team': {
      if (wait.envidoWinner) return { kind: 'action', action: { t: 'ganaEnvido', team: intent.team } };
      if (wait.florWinner) return { kind: 'action', action: { t: 'ganaFlor', team: intent.team } };
      return { kind: 'error', message: '', quiet: true };
    }
  }
}

/** Completa una intención a la que le faltaba el equipo. */
export function withTeam(intent: Intent, team: Team): Intent {
  switch (intent.k) {
    case 'call':
    case 'florQuiero':
    case 'achico':
    case 'win':
    case 'mazo':
    case 'points':
      return { ...intent, team };
    default:
      return intent;
  }
}
