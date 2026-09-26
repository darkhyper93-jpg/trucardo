import {
  ENVIDO_LABEL,
  FLOR_BET_LABEL,
  FLOR_BET_RANK,
  FLOR_POINTS,
  TRUCO_LABEL,
  TRUCO_QUERIDO,
  envidoAcceptedValue,
  envidoRejectedValue,
  florBetValue,
  halfOf,
} from './rules';
import {
  other,
  type Action,
  type EnvidoKind,
  type FlorBetKind,
  type FlorPhase,
  type FlorState,
  type HandState,
  type LogEntry,
  type LogKind,
  type MatchState,
  type Pendable,
  type Settings,
  type Team,
  type TrucoLevel,
} from './types';

export class RuleError extends Error {}

function fail(msg: string): never {
  throw new RuleError(msg);
}

export function newHand(n: number): HandState {
  return {
    n,
    truco: { level: 0, holder: null, pending: null },
    envido: { calls: [], status: 'none' },
    flor: { flores: [], bets: [], betStatus: 'none', done: false },
    stack: [],
    result: null,
  };
}

export function createMatch(settings: Settings): MatchState {
  return { settings, score: [0, 0], winner: null, hand: newHand(1), log: [] };
}

export function florPhase(f: FlorState): FlorPhase {
  if (f.flores.length === 0) return 'none';
  if (f.done) return 'done';
  if (f.betStatus === 'pending') return 'bet';
  if (f.betStatus === 'accepted') return 'betAccepted';
  return new Set(f.flores).size > 1 ? 'duel' : 'solo';
}

export function envidoChainLabel(kinds: EnvidoKind[]): string {
  const text = kinds.map((k) => ENVIDO_LABEL[k]).join(' + ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

class Ctx {
  entries: LogEntry[] = [];
  constructor(public s: MatchState) {}

  get h(): HandState {
    return this.s.hand;
  }
  get cfg(): Settings {
    return this.s.settings;
  }
  name(t: Team): string {
    return this.cfg.names[t];
  }
  log(kind: LogKind, text: string, extra: { team?: Team; pts?: number } = {}) {
    const e: LogEntry = { hand: this.h.n, kind, text, ...extra };
    this.s.log.push(e);
    this.entries.push(e);
  }
  award(team: Team, pts: number, reason: string) {
    if (this.s.winner !== null || pts <= 0) return;
    const before = this.s.score[team];
    this.s.score[team] = before + pts;
    this.log('points', `+${pts} ${this.name(team)}: ${reason}`, { team, pts });
    this.checkMilestones(team, before);
  }
  checkMilestones(team: Team, before: number) {
    const after = this.s.score[team];
    const { target } = this.cfg;
    const half = halfOf(this.cfg);
    if (after >= target) {
      if (this.s.winner === null) {
        this.s.winner = team;
        this.log('info', `¡Ganó ${this.name(team)}!`, { team });
      }
    } else if (half !== null && before < half && after >= half) {
      this.log('info', `${this.name(team)} en las buenas`, { team });
    }
  }
}

const pushTop = (h: HandState, p: Pendable) => {
  h.stack = h.stack.filter((x) => x !== p);
  h.stack.push(p);
};
const drop = (h: HandState, p: Pendable) => {
  h.stack = h.stack.filter((x) => x !== p);
};

// ---------------------------------------------------------------- flor

function settleSoloFlor(c: Ctx) {
  const f = c.h.flor;
  if (florPhase(f) !== 'solo') return;
  const team = f.flores[0];
  const count = f.flores.length;
  f.done = true;
  c.award(team, FLOR_POINTS * count, count > 1 ? `${count} flores` : 'flor');
}

function cancelEnvidoForFlor(c: Ctx) {
  const e = c.h.envido;
  if (e.status === 'pending' || e.status === 'accepted') {
    e.status = 'cancelled';
    drop(c.h, 'envido');
    c.log('info', 'La flor anula el envido');
  }
}

function callFlor(c: Ctx, team: Team) {
  if (!c.cfg.flor) fail('Esta partida se juega sin flor.');
  const f = c.h.flor;
  if (f.done) fail('La flor ya se anotó en esta mano.');
  if (f.betStatus !== 'none') fail('Ya hay una apuesta de flor en juego: respondan quiero o no quiero.');
  cancelEnvidoForFlor(c);
  const wasSolo = florPhase(f) === 'solo' && f.flores[0] !== team;
  f.flores.push(team);
  c.log('call', `Flor de ${c.name(team)}`, { team });
  if (wasSolo) c.log('info', 'Flor contra flor');
}

function florBet(c: Ctx, team: Team, kind: FlorBetKind) {
  if (!c.cfg.flor) fail('Esta partida se juega sin flor.');
  const f = c.h.flor;
  const phase = florPhase(f);
  if (phase === 'done') fail('La flor ya se anotó en esta mano.');
  if (phase === 'none') fail(`Para cantar ${FLOR_BET_LABEL[kind]} alguien tiene que haber cantado flor.`);
  const last = f.bets[f.bets.length - 1];
  if (last) {
    if (last.by === team && last.kind === kind) fail(`${cap(FLOR_BET_LABEL[kind])} ya estaba cantada.`);
    if (last.by === team) fail(`Le toca responder a ${c.name(other(team))}.`);
    if (FLOR_BET_RANK[kind] <= FLOR_BET_RANK[last.kind])
      fail(`Después de ${FLOR_BET_LABEL[last.kind]} no se puede cantar ${FLOR_BET_LABEL[kind]}.`);
    if (f.betStatus === 'pending') c.log('answer', `${cap(FLOR_BET_LABEL[last.kind])} querida`, { team });
  } else if (phase === 'solo' && f.flores[0] === team && f.flores.length === 1) {
    fail(`${c.name(team)} no puede apostar contra su propia flor.`);
  }
  cancelEnvidoForFlor(c);
  if (!f.flores.includes(team)) f.flores.push(team);
  f.bets.push({ kind, by: team });
  f.betStatus = 'pending';
  pushTop(c.h, 'flor');
  c.log('call', `${cap(FLOR_BET_LABEL[kind])} de ${c.name(team)}`, { team });
}

function answerFlor(c: Ctx, accept: boolean) {
  const f = c.h.flor;
  const last = f.bets[f.bets.length - 1];
  if (!last || f.betStatus !== 'pending') fail('No hay apuesta de flor para responder.');
  drop(c.h, 'flor');
  const responder = other(last.by);
  if (accept) {
    f.betStatus = 'accepted';
    c.log('answer', `${cap(FLOR_BET_LABEL[last.kind])} querida`, { team: responder });
    return;
  }
  const prev = f.bets.length > 1 ? f.bets[f.bets.length - 2] : null;
  const pts = prev ? florBetValue(prev.kind, c.s.score, c.cfg, last.by) : c.cfg.florDuel;
  f.betStatus = 'none';
  f.done = true;
  c.log('answer', `${c.name(responder)}: no quiero`, { team: responder });
  c.award(last.by, pts, `${FLOR_BET_LABEL[last.kind]} no querida`);
}

function florQuiero(c: Ctx, team: Team) {
  const f = c.h.flor;
  if (f.betStatus === 'pending') return answerFlor(c, true);
  const phase = florPhase(f);
  if (phase === 'none') fail('No hay flor para querer.');
  if (phase === 'done') fail('La flor ya se anotó en esta mano.');
  if (!f.flores.includes(team)) f.flores.push(team);
  c.log('answer', `${c.name(team)}: con flor quiero`, { team });
}

function achico(c: Ctx, team: Team) {
  const f = c.h.flor;
  if (f.betStatus === 'pending') return answerFlor(c, false);
  const phase = florPhase(f);
  if (phase === 'none') fail('No hay flor contra la cual achicarse.');
  if (phase === 'done') fail('La flor ya se anotó en esta mano.');
  const winner = other(team);
  if (!f.flores.includes(winner)) fail(`${c.name(winner)} no cantó flor.`);
  f.done = true;
  c.log('answer', `${c.name(team)}: con flor me achico`, { team });
  c.award(winner, c.cfg.florDuel, 'flor (se achicaron)');
}

function ganaFlor(c: Ctx, team: Team) {
  if (!c.cfg.flor) fail('Esta partida se juega sin flor.');
  const f = c.h.flor;
  switch (florPhase(f)) {
    case 'done':
      fail('La flor ya se anotó en esta mano.');
    case 'none':
      // Declaración suelta: se anota la flor sin cambiar el estado de la mano.
      return c.award(team, FLOR_POINTS, 'flor');
    case 'solo':
      if (f.flores[0] === team) return settleSoloFlor(c);
      f.flores.push(team);
      f.done = true;
      return c.award(team, c.cfg.florDuel, 'flor contra flor');
    case 'duel':
      f.done = true;
      return c.award(team, c.cfg.florDuel, 'flor contra flor');
    case 'bet':
      drop(c.h, 'flor');
      f.betStatus = 'accepted';
      c.log('info', `(la ${FLOR_BET_LABEL[f.bets[f.bets.length - 1].kind]} se tomó como querida)`);
      return awardFlorBet(c, team);
    case 'betAccepted':
      return awardFlorBet(c, team);
  }
}

function awardFlorBet(c: Ctx, team: Team) {
  const f = c.h.flor;
  const last = f.bets[f.bets.length - 1];
  f.done = true;
  c.award(team, florBetValue(last.kind, c.s.score, c.cfg, team), FLOR_BET_LABEL[last.kind]);
}

// ---------------------------------------------------------------- envido

function callEnvido(c: Ctx, team: Team, kind: EnvidoKind) {
  const h = c.h;
  const e = h.envido;
  if (florPhase(h.flor) !== 'none') fail('Hay flor en la mano: el envido no se juega.');
  if (h.truco.level > 0) fail('El truco ya fue querido: ya no se puede cantar envido.');
  if (e.status === 'accepted') fail('El envido ya fue querido: digan quién lo ganó.');
  if (e.status === 'done' || e.status === 'cancelled') fail('El envido ya se jugó en esta mano.');
  if (e.status === 'none') {
    e.calls = [{ kind, by: team }];
    e.status = 'pending';
    pushTop(h, 'envido');
    c.log('call', `${cap(ENVIDO_LABEL[kind])} de ${c.name(team)}`, { team });
    return;
  }
  const last = e.calls[e.calls.length - 1];
  const kinds = e.calls.map((x) => x.kind);
  if (last.by === team && last.kind === kind) fail(`${cap(ENVIDO_LABEL[kind])} ya estaba cantado.`);
  if (last.by === team) fail(`Le toca responder a ${c.name(other(team))}.`);
  if (last.kind === 'falta') fail('Después de la falta envido solo queda querer o no querer.');
  if (kind === 'envido' && (kinds.some((k) => k !== 'envido') || kinds.length >= 2))
    fail('Ya no se puede cantar envido otra vez.');
  if (kind === 'real' && kinds.includes('real')) fail('El real envido ya se cantó.');
  e.calls.push({ kind, by: team });
  pushTop(h, 'envido');
  c.log('call', `${cap(ENVIDO_LABEL[kind])} de ${c.name(team)}`, { team });
}

function acceptEnvido(c: Ctx) {
  const e = c.h.envido;
  e.status = 'accepted';
  drop(c.h, 'envido');
  const kinds = e.calls.map((x) => x.kind);
  const responder = other(e.calls[e.calls.length - 1].by);
  const value = kinds.includes('falta') ? '' : ` (${envidoAcceptedValue(kinds, c.s.score, c.cfg, responder)})`;
  c.log('answer', `${envidoChainLabel(kinds)} querido${value}`, { team: responder });
}

function rejectEnvido(c: Ctx) {
  const e = c.h.envido;
  const kinds = e.calls.map((x) => x.kind);
  const last = e.calls[e.calls.length - 1];
  e.status = 'done';
  drop(c.h, 'envido');
  c.log('answer', `${c.name(other(last.by))}: no quiero`, { team: other(last.by) });
  c.award(last.by, envidoRejectedValue(kinds), `${envidoChainLabel(kinds).toLowerCase()} no querido`);
}

function ganaEnvido(c: Ctx, team: Team) {
  const h = c.h;
  const e = h.envido;
  if (florPhase(h.flor) !== 'none' && e.status !== 'accepted') fail('Hubo flor: el envido no se jugó.');
  switch (e.status) {
    case 'done':
    case 'cancelled':
      fail('El envido ya se anotó en esta mano.');
    case 'none':
      // Declaración suelta (p. ej. dicha al final): se anota un envido querido sin tocar la mano.
      c.log('info', '(se anotó un envido querido)');
      return c.award(team, 2, 'envido');
    case 'pending':
      e.status = 'accepted';
      drop(h, 'envido');
      c.log('info', '(el envido se tomó como querido)');
      return awardEnvido(c, team);
    case 'accepted':
      return awardEnvido(c, team);
  }
}

function awardEnvido(c: Ctx, team: Team) {
  const e = c.h.envido;
  const kinds = e.calls.map((x) => x.kind);
  e.status = 'done';
  c.award(team, envidoAcceptedValue(kinds, c.s.score, c.cfg, team), envidoChainLabel(kinds).toLowerCase());
}

// ---------------------------------------------------------------- truco

function callTruco(c: Ctx, team: Team, level: TrucoLevel) {
  const h = c.h;
  const t = h.truco;
  const label = TRUCO_LABEL[level];
  if (h.envido.status === 'pending') fail('Primero respondan el envido.');
  if (h.flor.betStatus === 'pending') fail('Primero respondan la flor.');
  if (t.pending) {
    const { level: p, by } = t.pending;
    if (p === level && by === team) fail(`${cap(label)} ya estaba cantado.`);
    if (level !== p + 1) fail(`Primero respondan el ${TRUCO_LABEL[p]}.`);
    if (by === team) fail(`El ${label} lo tiene que cantar ${c.name(other(team))}.`);
    settleSoloFlor(c);
    t.level = p;
    t.holder = team;
    c.log('answer', `${cap(TRUCO_LABEL[p])} querido`, { team });
  } else {
    if (t.level >= 3) fail('Vale cuatro es lo máximo.');
    if (level <= t.level) fail(`El ${label} ya fue querido.`);
    if (level > t.level + 1) fail(`Todavía no se cantó el ${TRUCO_LABEL[(t.level + 1) as TrucoLevel]}.`);
    if (t.holder !== null && t.holder !== team)
      fail(`El quiero lo tiene ${c.name(t.holder)}: solo ellos pueden cantar ${label}.`);
    settleSoloFlor(c);
  }
  t.pending = { level, by: team };
  pushTop(h, 'truco');
  c.log('call', `${cap(label)} de ${c.name(team)}`, { team });
}

function acceptTruco(c: Ctx) {
  const t = c.h.truco;
  const p = t.pending!;
  t.level = p.level;
  t.holder = other(p.by);
  t.pending = null;
  drop(c.h, 'truco');
  settleSoloFlor(c);
  c.log('answer', `${cap(TRUCO_LABEL[p.level])} querido (vale ${TRUCO_QUERIDO[p.level]})`, { team: t.holder });
}

function rejectTruco(c: Ctx) {
  const h = c.h;
  const p = h.truco.pending!;
  h.truco.pending = null;
  drop(h, 'truco');
  settleSoloFlor(c);
  c.log('answer', `${c.name(other(p.by))}: no quiero`, { team: other(p.by) });
  h.result = { winner: p.by, points: p.level, reason: `${TRUCO_LABEL[p.level]} no querido` };
}

function ganaMano(c: Ctx, team: Team) {
  const h = c.h;
  if (h.envido.status === 'pending') {
    h.envido.status = 'accepted';
    drop(h, 'envido');
    c.log('info', '(el envido se tomó como querido)');
  }
  if (h.flor.betStatus === 'pending') {
    h.flor.betStatus = 'accepted';
    drop(h, 'flor');
    c.log('info', '(la flor se tomó como querida)');
  }
  if (h.truco.pending) {
    const lvl = h.truco.pending.level;
    h.truco.level = lvl;
    h.truco.holder = other(h.truco.pending.by);
    h.truco.pending = null;
    drop(h, 'truco');
    c.log('info', `(el ${TRUCO_LABEL[lvl]} se tomó como querido)`);
  }
  settleSoloFlor(c);
  const lvl = h.truco.level;
  h.result = { winner: team, points: TRUCO_QUERIDO[lvl], reason: lvl ? TRUCO_LABEL[lvl] : 'la mano' };
  c.log('hand', `Mano para ${c.name(team)}`, { team });
}

function mazo(c: Ctx, team: Team, primera: boolean) {
  const h = c.h;
  const winner = other(team);
  const t = h.truco;
  let pts: number = TRUCO_QUERIDO[t.level];
  if (t.pending) {
    if (t.pending.by === winner) pts = t.pending.level;
    t.pending = null;
    drop(h, 'truco');
  }
  const e = h.envido;
  const envidoSinCantar = e.status === 'none';
  if (e.status === 'pending') {
    const last = e.calls[e.calls.length - 1];
    drop(h, 'envido');
    if (last.by === winner) {
      e.status = 'done';
      c.award(winner, envidoRejectedValue(e.calls.map((x) => x.kind)), 'envido no querido');
    } else {
      e.status = 'cancelled';
    }
  }
  const f = h.flor;
  if (f.betStatus === 'pending') {
    if (f.bets[f.bets.length - 1].by === winner) answerFlor(c, false);
    else {
      f.betStatus = 'none';
      f.done = true;
      drop(h, 'flor');
    }
  }
  settleSoloFlor(c);
  let reason = `al mazo ${c.name(team)}`;
  if (c.cfg.mazoPrimera && primera && envidoSinCantar && florPhase(f) === 'none' && t.level === 0) {
    pts += 1;
    reason += ' en primera';
  }
  c.log('hand', `Al mazo: ${c.name(team)}`, { team });
  h.result = { winner, points: pts, reason };
}

// ---------------------------------------------------------------- respuestas

function answer(c: Ctx, accept: boolean, target?: Pendable) {
  const h = c.h;
  const top = target ?? h.stack[h.stack.length - 1];
  if (!top || !h.stack.includes(top)) fail(accept ? 'No hay ningún canto para querer.' : 'No hay ningún canto para no querer.');
  if (top === 'truco') return accept ? acceptTruco(c) : rejectTruco(c);
  if (top === 'envido') return accept ? acceptEnvido(c) : rejectEnvido(c);
  return answerFlor(c, accept);
}

function ajuste(c: Ctx, team: Team, delta: number) {
  const s = c.s;
  const before = s.score[team];
  const after = Math.max(0, before + delta);
  if (after === before) fail('No hay puntos para restar.');
  s.score[team] = after;
  const d = after - before;
  c.log('points', `${d > 0 ? '+' : ''}${d} ${c.name(team)}: a mano`, { team, pts: d });
  if (after >= s.settings.target) {
    if (s.winner === null) {
      s.winner = team;
      c.log('info', `¡Ganó ${c.name(team)}!`, { team });
    }
  } else if (s.winner === team) {
    s.winner = null;
  } else {
    c.checkMilestones(team, before);
  }
}

// ---------------------------------------------------------------- cierre de mano

function closeHandIfReady(c: Ctx) {
  const h = c.h;
  if (!h.result) return;
  if (h.envido.status === 'accepted') return;
  const phase = florPhase(h.flor);
  if (phase === 'duel' || phase === 'bet' || phase === 'betAccepted') return;
  c.award(h.result.winner, h.result.points, h.result.reason);
  if (c.s.winner === null) c.s.hand = newHand(h.n + 1);
}

const AFTER_RESULT_OK: Action['t'][] = ['ganaEnvido', 'ganaFlor', 'ajuste', 'achico', 'florQuiero'];

function step(c: Ctx, a: Action) {
  if (a.t === 'ajuste') return ajuste(c, a.team, a.delta);
  if (c.s.winner !== null) fail('La partida ya terminó. Empiecen una nueva o deshagan la última jugada.');
  if (c.h.result && !AFTER_RESULT_OK.includes(a.t)) {
    const falta = c.h.envido.status === 'accepted' ? 'quién ganó el envido' : 'quién ganó la flor';
    fail(`La mano ya se definió: falta decir ${falta}.`);
  }
  switch (a.t) {
    case 'truco':
      return callTruco(c, a.team, a.level);
    case 'envido':
      return callEnvido(c, a.team, a.kind);
    case 'flor':
      return callFlor(c, a.team);
    case 'florBet':
      return florBet(c, a.team, a.kind);
    case 'florQuiero':
      return florQuiero(c, a.team);
    case 'achico':
      return achico(c, a.team);
    case 'quiero':
      return answer(c, true, a.target);
    case 'noQuiero':
      return answer(c, false, a.target);
    case 'buenas':
      if (florPhase(c.h.flor) === 'solo') return settleSoloFlor(c);
      return fail('No hay una flor sola para dar por buena.');
    case 'ganaEnvido':
      return ganaEnvido(c, a.team);
    case 'ganaFlor':
      return ganaFlor(c, a.team);
    case 'ganaMano':
      if (c.h.result) fail('La mano ya tiene ganador.');
      return ganaMano(c, a.team);
    case 'mazo':
      if (c.h.result) fail('La mano ya terminó.');
      return mazo(c, a.team, !!a.primera);
  }
}

export type ApplyResult =
  | { ok: true; state: MatchState; entries: LogEntry[] }
  | { ok: false; error: string };

export function applyAction(state: MatchState, action: Action): ApplyResult {
  // El historial solo crece: se copia superficialmente en vez de clonarlo entero.
  const { log, ...rest } = state;
  const c = new Ctx({ ...structuredClone(rest), log: log.slice() });
  try {
    step(c, action);
    closeHandIfReady(c);
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, error: err.message };
    throw err;
  }
  return { ok: true, state: c.s, entries: c.entries };
}

/** Reconstruye la partida desde la lista de jugadas (así funciona "deshacer"). */
export function replay(settings: Settings, actions: Action[]): MatchState {
  let s = createMatch(settings);
  for (const a of actions) {
    const r = applyAction(s, a);
    if (r.ok) s = r.state;
  }
  return s;
}

/** Lo que la mano está esperando para poder cerrarse o seguir. */
export function awaiting(state: MatchState) {
  const h = state.hand;
  const phase = florPhase(h.flor);
  return {
    envidoWinner: h.envido.status === 'accepted',
    florWinner: phase === 'duel' || phase === 'betAccepted',
    answer: h.stack[h.stack.length - 1] ?? null,
    handDone: h.result !== null,
  };
}
