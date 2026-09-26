import { describe, expect, it } from 'vitest';
import { applyAction, createMatch } from '../game/engine';
import { defaultSettings } from '../game/rules';
import type { Action, MatchState } from '../game/types';
import { resolveIntent } from './interpret';
import { parse } from './parser';

const names: [string, string] = ['Nosotros', 'Ellos'];

/** Simula lo que hace la app: cada frase se parsea, se resuelve y se aplica. */
function say(state: MatchState, ...phrases: string[]): { state: MatchState; asks: string[]; errors: string[] } {
  const asks: string[] = [];
  const errors: string[] = [];
  for (const phrase of phrases) {
    for (const intent of parse(phrase, names)) {
      const r = resolveIntent(state, intent);
      if (r.kind === 'ask') asks.push(r.question);
      else if (r.kind === 'error') errors.push(r.message);
      else if (r.kind === 'action') {
        const out = applyAction(state, r.action);
        if (out.ok) state = out.state;
        else errors.push(out.error);
      }
    }
  }
  return { state, asks, errors };
}

const fresh = (patch = {}) => createMatch({ ...defaultSettings('uruguayo'), ...patch });

describe('conversaciones completas', () => {
  it('truco, quiero, retruco, no quiero', () => {
    const r = say(fresh(), 'truco nosotros', 'quiero', 'retruco', 'no quiero');
    expect(r.errors).toEqual([]);
    expect(r.state.score).toEqual([0, 2]);
  });

  it('el envido está primero y después se define todo', () => {
    const r = say(
      fresh({ flor: false }),
      'truco ellos',
      'el envido está primero, envido',
      'real envido',
      'quiero',
      'el envido lo ganamos',
      'quiero',
      'la mano para ellos',
    );
    expect(r.errors).toEqual([]);
    expect(r.state.score).toEqual([5, 2]);
  });

  it('sin decir equipo en el primer canto pregunta quién fue', () => {
    const r = say(fresh(), 'truco');
    expect(r.asks).toEqual(['¿Quién cantó truco?']);
  });

  it('"nosotros" solo responde quién ganó el envido pendiente', () => {
    const r = say(fresh(), 'envido ellos', 'quiero', 'nosotros');
    expect(r.state.score).toEqual([2, 0]);
  });

  it('flor contra flor con contraflor', () => {
    const r = say(fresh(), 'flor ellos', 'contraflor', 'quiero', 'flor para nosotros', 'mano para ellos');
    expect(r.errors).toEqual([]);
    expect(r.state.score).toEqual([6, 1]);
  });

  it('se van al mazo con el truco cantado', () => {
    const r = say(fresh(), 'truco nosotros', 'se van al mazo');
    expect(r.state.score).toEqual([1, 0]);
  });

  it('envido declarado al final sin cantos no bloquea la mano siguiente', () => {
    let r = say(fresh({ flor: false }), 'mano para ellos', 'envido para nosotros');
    expect(r.state.score).toEqual([2, 1]);
    r = say(r.state, 'envido ellos', 'quiero', 'envido para ellos');
    expect(r.errors).toEqual([]);
    expect(r.state.score).toEqual([2, 3]);
  });

  it('"son buenas" con el envido querido no hace nada ni molesta', () => {
    const r = say(fresh(), 'envido nosotros', 'quiero', 'treinta y tres', 'son buenas');
    expect(r.errors).toEqual(['']);
    expect(r.state.score).toEqual([0, 0]);
  });

  it('un canto imposible avisa en vez de preguntar quién fue', () => {
    const r = say(fresh({ flor: false }), 'truco ellos', 'quiero', 'envido');
    expect(r.asks).toEqual([]);
    expect(r.errors[0]).toMatch(/ya no se puede cantar envido/);
  });

  it('si solo un equipo puede cantarlo, no pregunta', () => {
    // Con el truco querido por Nosotros, solo Nosotros puede cantar retruco.
    const r = say(fresh(), 'truco ellos', 'quiero', 'mano para ellos', 'truco ellos', 'quiero', 'retruco');
    expect(r.asks).toEqual([]);
    expect(r.state.hand.truco.pending).toEqual({ level: 2, by: 0 });
  });

  it('cantos repetidos por eco dan error y no cambian nada', () => {
    const r = say(fresh(), 'truco nosotros', 'truco');
    expect(r.errors[0]).toMatch(/ya estaba cantado/);
  });
});

describe('inferencia de equipo', () => {
  it('la respuesta de flor la da el otro equipo', () => {
    let s = fresh();
    s = (applyAction(s, { t: 'flor', team: 1 } as Action) as { state: MatchState }).state;
    const r = resolveIntent(s, { k: 'achico' });
    expect(r).toEqual({ kind: 'action', action: { t: 'achico', team: 0 } });
  });
});
