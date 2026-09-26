import { describe, expect, it } from 'vitest';
import { applyAction, createMatch, florPhase, replay } from './engine';
import { defaultSettings, faltaValue } from './rules';
import type { Action, MatchState, Settings } from './types';

const A = 0 as const;
const B = 1 as const;

function run(actions: Action[], patch: Partial<Settings> = {}, score?: [number, number]): MatchState {
  let s = createMatch({ ...defaultSettings('uruguayo'), ...patch });
  if (score) s.score = [...score];
  for (const a of actions) {
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)} → ${r.error}`);
    s = r.state;
  }
  return s;
}

function err(actions: Action[], bad: Action, patch: Partial<Settings> = {}): string {
  const s = run(actions, patch);
  const r = applyAction(s, bad);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('truco', () => {
  it('mano sin cantos vale 1', () => {
    const s = run([{ t: 'ganaMano', team: A }]);
    expect(s.score).toEqual([1, 0]);
    expect(s.hand.n).toBe(2);
  });

  it('truco querido vale 2', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'quiero' }, { t: 'ganaMano', team: B }]);
    expect(s.score).toEqual([0, 2]);
  });

  it('truco no querido da 1 al que cantó y cierra la mano', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'noQuiero' }]);
    expect(s.score).toEqual([1, 0]);
    expect(s.hand.n).toBe(2);
  });

  it('retruco no querido da 2, vale cuatro no querido da 3', () => {
    expect(run([{ t: 'truco', team: A, level: 1 }, { t: 'truco', team: B, level: 2 }, { t: 'noQuiero' }]).score).toEqual([0, 2]);
    expect(
      run([
        { t: 'truco', team: A, level: 1 },
        { t: 'truco', team: B, level: 2 },
        { t: 'truco', team: A, level: 3 },
        { t: 'noQuiero' },
      ]).score,
    ).toEqual([3, 0]);
  });

  it('vale cuatro querido vale 4', () => {
    const s = run([
      { t: 'truco', team: A, level: 1 },
      { t: 'quiero' },
      { t: 'truco', team: B, level: 2 },
      { t: 'quiero' },
      { t: 'truco', team: A, level: 3 },
      { t: 'quiero' },
      { t: 'ganaMano', team: A },
    ]);
    expect(s.score).toEqual([4, 0]);
  });

  it('solo el que tiene el quiero puede subir', () => {
    const e = err([{ t: 'truco', team: A, level: 1 }, { t: 'quiero' }], { t: 'truco', team: A, level: 2 });
    expect(e).toMatch(/quiero lo tiene/);
  });

  it('no se puede saltear el retruco', () => {
    expect(err([], { t: 'truco', team: A, level: 2 })).toMatch(/Todavía no se cantó el truco/);
  });

  it('si se declara ganador con truco sin responder, se toma como querido', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'ganaMano', team: B }]);
    expect(s.score).toEqual([0, 2]);
  });

  it('irse al mazo con truco cantado por el rival = no quiero', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'mazo', team: B }]);
    expect(s.score).toEqual([1, 0]);
  });

  it('irse al mazo con truco querido da lo que vale', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'quiero' }, { t: 'mazo', team: A }]);
    expect(s.score).toEqual([0, 2]);
  });

  it('mazo en primera sin envido suma 1 extra (argentino)', () => {
    const s = run([{ t: 'mazo', team: A, primera: true }], defaultSettings('argentino'));
    expect(s.score).toEqual([0, 2]);
  });
});

describe('envido', () => {
  const chain = (...calls: [0 | 1, 'envido' | 'real' | 'falta'][]): Action[] =>
    calls.map(([team, kind]) => ({ t: 'envido', team, kind }));

  it.each([
    ['envido', chain([A, 'envido']), 2, 1],
    ['real envido', chain([A, 'real']), 3, 1],
    ['envido envido', chain([A, 'envido'], [B, 'envido']), 4, 2],
    ['envido real', chain([A, 'envido'], [B, 'real']), 5, 2],
    ['envido envido real', chain([A, 'envido'], [B, 'envido'], [A, 'real']), 7, 4],
    ['envido real falta (no querido)', chain([A, 'envido'], [B, 'real'], [A, 'falta']), null, 5],
    ['envido envido real falta (no querido)', chain([A, 'envido'], [B, 'envido'], [A, 'real'], [B, 'falta']), null, 7],
  ])('%s', (_name, calls, querido, noQuerido) => {
    const lastCaller = calls[calls.length - 1].t === 'envido' ? (calls[calls.length - 1] as { team: 0 | 1 }).team : A;
    if (querido !== null) {
      const s = run([...calls, { t: 'quiero' }, { t: 'ganaEnvido', team: B }]);
      expect(s.score).toEqual([0, querido]);
    }
    const r = run([...calls, { t: 'noQuiero' }]);
    const expected: [number, number] = [0, 0];
    expected[lastCaller] = noQuerido;
    expect(r.score).toEqual(expected);
  });

  it('el envido está primero: se puede cantar con el truco pendiente', () => {
    const s = run([
      { t: 'truco', team: A, level: 1 },
      { t: 'envido', team: B, kind: 'envido' },
      { t: 'quiero' }, // quiere el envido (último canto)
      { t: 'ganaEnvido', team: B },
      { t: 'quiero' }, // ahora quiere el truco
      { t: 'ganaMano', team: A },
    ]);
    expect(s.score).toEqual([2, 2]);
  });

  it('no se puede cantar envido con el truco querido', () => {
    expect(err([{ t: 'truco', team: A, level: 1 }, { t: 'quiero' }], { t: 'envido', team: B, kind: 'envido' })).toMatch(
      /ya no se puede cantar envido/,
    );
  });

  it('no se puede cantar truco con el envido sin responder', () => {
    expect(err([{ t: 'envido', team: A, kind: 'envido' }], { t: 'truco', team: B, level: 1 })).toMatch(/Primero respondan el envido/);
  });

  it('los cantos se alternan', () => {
    expect(err([{ t: 'envido', team: A, kind: 'envido' }], { t: 'envido', team: A, kind: 'real' })).toMatch(/Le toca responder/);
  });

  it('la mano espera al ganador del envido antes de cerrarse', () => {
    const s = run([{ t: 'envido', team: A, kind: 'envido' }, { t: 'quiero' }, { t: 'ganaMano', team: A }]);
    expect(s.hand.n).toBe(1);
    expect(s.score).toEqual([0, 0]);
    const r = applyAction(s, { t: 'ganaEnvido', team: B });
    expect(r.ok && r.state.score).toEqual([1, 2]);
    expect(r.ok && r.state.hand.n).toBe(2);
  });

  it('se cuenta primero el envido: si llega a la meta, gana aunque el otro sume truco', () => {
    const s = run(
      [
        { t: 'envido', team: A, kind: 'envido' },
        { t: 'quiero' },
        { t: 'truco', team: B, level: 1 },
        { t: 'quiero' },
        { t: 'ganaMano', team: B },
        { t: 'ganaEnvido', team: A },
      ],
      {},
      [28, 28],
    );
    expect(s.winner).toBe(A);
    expect(s.score).toEqual([30, 28]);
  });
});

describe('falta envido', () => {
  const cfg = (falta: Settings['falta']) => ({ ...defaultSettings('uruguayo'), falta, target: 30, halves: true });

  it('resto: lo que le falta al que va ganando', () => {
    expect(faltaValue([10, 4], cfg('resto'), B)).toBe(20);
    expect(faltaValue([22, 4], cfg('resto'), B)).toBe(8);
  });

  it('en malas gana el partido', () => {
    expect(faltaValue([10, 4], cfg('malasGana'), B)).toBe(26);
    expect(faltaValue([10, 4], cfg('malasGana'), A)).toBe(20);
    expect(faltaValue([18, 4], cfg('malasGana'), B)).toBe(12);
  });

  it('por tramo', () => {
    expect(faltaValue([10, 4], cfg('tramo'), B)).toBe(5);
    expect(faltaValue([18, 4], cfg('tramo'), B)).toBe(12);
  });

  it('falta querida y ganada termina el partido (en malas, argentino)', () => {
    const s = run(
      [{ t: 'envido', team: A, kind: 'falta' }, { t: 'quiero' }, { t: 'ganaEnvido', team: B }],
      defaultSettings('argentino'),
      [12, 3],
    );
    expect(s.winner).toBe(B);
  });
});

describe('flor', () => {
  it('flor sola vale 3 y se anota al terminar la etapa', () => {
    const s = run([{ t: 'flor', team: A }]);
    expect(florPhase(s.hand.flor)).toBe('solo');
    const r = run([{ t: 'flor', team: A }, { t: 'truco', team: B, level: 1 }]);
    expect(r.score).toEqual([3, 0]);
  });

  it('dos flores del mismo equipo valen 6', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'flor', team: A }, { t: 'buenas' }]);
    expect(s.score).toEqual([6, 0]);
  });

  it('la flor anula el envido', () => {
    const s = run([{ t: 'envido', team: A, kind: 'envido' }, { t: 'flor', team: B }, { t: 'ganaMano', team: A }]);
    expect(s.score).toEqual([1, 3]);
  });

  it('con flor en la mano no se puede cantar envido', () => {
    expect(err([{ t: 'flor', team: A }], { t: 'envido', team: B, kind: 'envido' })).toMatch(/flor/);
  });

  it('flor contra flor sin apuesta: el ganador se lleva el valor configurado', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'flor', team: B }, { t: 'ganaFlor', team: B }]);
    expect(s.score).toEqual([0, 4]);
  });

  it('con flor me achico: 4 para el otro', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'achico', team: B }]);
    expect(s.score).toEqual([4, 0]);
  });

  it('contraflor querida vale 6', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'florBet', team: B, kind: 'contraflor' }, { t: 'quiero' }, { t: 'ganaFlor', team: A }]);
    expect(s.score).toEqual([6, 0]);
  });

  it('contraflor no querida da el valor base al que la cantó', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'florBet', team: B, kind: 'contraflor' }, { t: 'noQuiero' }]);
    expect(s.score).toEqual([0, 4]);
  });

  it('contraflor al resto no querida después de contraflor da 6', () => {
    const s = run([
      { t: 'flor', team: A },
      { t: 'florBet', team: B, kind: 'contraflor' },
      { t: 'florBet', team: A, kind: 'resto' },
      { t: 'noQuiero' },
    ]);
    expect(s.score).toEqual([6, 0]);
  });

  it('contraflor al resto querida: el ganador se lleva la falta', () => {
    const s = run(
      [{ t: 'flor', team: A }, { t: 'florBet', team: B, kind: 'resto' }, { t: 'quiero' }, { t: 'ganaFlor', team: A }],
      {},
      [20, 10],
    );
    expect(s.winner).toBe(A);
  });

  it('partida sin flor rechaza la flor', () => {
    expect(err([], { t: 'flor', team: A }, { flor: false })).toMatch(/sin flor/);
  });

  it('la mano con flor contra flor espera al ganador de la flor', () => {
    const s = run([{ t: 'flor', team: A }, { t: 'flor', team: B }, { t: 'ganaMano', team: A }]);
    expect(s.hand.n).toBe(1);
    const r = applyAction(s, { t: 'ganaFlor', team: B });
    expect(r.ok && r.state.score).toEqual([1, 4]);
  });
});

describe('partida', () => {
  it('termina al llegar a la meta y no acepta más jugadas', () => {
    const s = run([{ t: 'truco', team: A, level: 1 }, { t: 'quiero' }, { t: 'ganaMano', team: A }], {}, [29, 0]);
    expect(s.winner).toBe(A);
    expect(applyAction(s, { t: 'ganaMano', team: B }).ok).toBe(false);
  });

  it('avisa la entrada a las buenas', () => {
    const s = run([{ t: 'ganaMano', team: A }], {}, [14, 0]);
    expect(s.log.some((l) => l.text.includes('en las buenas'))).toBe(true);
  });

  it('ajuste manual no baja de cero y puede deshacer una victoria', () => {
    let s = run([{ t: 'ajuste', team: A, delta: 1 }], {}, [29, 0]);
    expect(s.winner).toBe(A);
    s = run([{ t: 'ajuste', team: A, delta: -1 }], {}, [30, 0]);
    expect(s.winner).toBe(null);
    expect(applyAction(createMatch(defaultSettings()), { t: 'ajuste', team: A, delta: -1 }).ok).toBe(false);
  });

  it('replay reconstruye el mismo estado (deshacer)', () => {
    const actions: Action[] = [
      { t: 'envido', team: A, kind: 'envido' },
      { t: 'envido', team: B, kind: 'real' },
      { t: 'quiero' },
      { t: 'ganaEnvido', team: A },
      { t: 'truco', team: B, level: 1 },
      { t: 'noQuiero' },
    ];
    const settings = defaultSettings('uruguayo');
    expect(replay(settings, actions).score).toEqual([5, 1]);
    expect(replay(settings, actions.slice(0, -1)).score).toEqual([5, 0]);
  });
});
