import { describe, expect, it } from 'vitest';
import { parse, type Intent } from './parser';

const names: [string, string] = ['Nosotros', 'Ellos'];
const p = (text: string, n: [string, string] = names) => parse(text, n);

describe('cantos', () => {
  it.each<[string, Intent[]]>([
    ['Truco nosotros', [{ k: 'call', call: 'truco', team: 0 }]],
    ['¡Truco!', [{ k: 'call', call: 'truco', team: undefined }]],
    ['nosotros cantamos truco', [{ k: 'call', call: 'truco', team: 0 }]],
    ['quiero retruco', [{ k: 'quiero' }, { k: 'call', call: 'retruco', team: undefined }]],
    ['Re truco', [{ k: 'call', call: 'retruco', team: undefined }]],
    ['quiero vale cuatro', [{ k: 'quiero' }, { k: 'call', call: 'vale4', team: undefined }]],
    ['vale 4', [{ k: 'call', call: 'vale4', team: undefined }]],
    ['No quiero', [{ k: 'noQuiero' }]],
    ['envido ellos', [{ k: 'call', call: 'envido', team: 1 }]],
    ['envido envido', [{ k: 'call', call: 'envido', team: undefined }, { k: 'call', call: 'envido', team: undefined }]],
    ['Real envido', [{ k: 'call', call: 'real', team: undefined }]],
    ['falta envido', [{ k: 'call', call: 'falta', team: undefined }]],
    ['a la falta', [{ k: 'call', call: 'falta', team: undefined }]],
    ['flor nosotros', [{ k: 'call', call: 'flor', team: 0 }]],
    ['contra flor', [{ k: 'call', call: 'contraflor', team: undefined }]],
    ['contraflor al resto', [{ k: 'call', call: 'resto', team: undefined }]],
    ['con flor me achico', [{ k: 'achico', team: undefined }]],
    ['con flor quiero', [{ k: 'florQuiero', team: undefined }]],
    ['con flor envido', [{ k: 'call', call: 'conflorenvido', team: undefined }]],
    ['ellos se van al mazo', [{ k: 'mazo', team: 1, primera: false }]],
    ['me voy al mazo en primera', [{ k: 'mazo', team: undefined, primera: true }]],
    [
      'envido ellos, real envido nosotros',
      [
        { k: 'call', call: 'envido', team: 1 },
        { k: 'call', call: 'real', team: 0 },
      ],
    ],
    ['truco nosotros, quiero', [{ k: 'call', call: 'truco', team: 0 }, { k: 'quiero' }]],
    ['el envido está primero', [{ k: 'call', call: 'envido', team: undefined }]],
    ['el envido está primero, real envido', [{ k: 'call', call: 'real', team: undefined }]],
  ])('%s', (text, expected) => {
    expect(p(text)).toEqual(expected);
  });
});

describe('resultados', () => {
  it.each<[string, Intent[]]>([
    ['envido para nosotros', [{ k: 'win', subject: 'envido', team: 0 }]],
    ['ganamos el envido', [{ k: 'win', subject: 'envido', team: 0 }]],
    ['el envido lo ganaron ellos', [{ k: 'win', subject: 'envido', team: 1 }]],
    ['los tantos para ellos', [{ k: 'win', subject: 'envido', team: 1 }]],
    ['truco para ellos', [{ k: 'win', subject: 'mano', team: 1 }]],
    ['la mano es de nosotros', [{ k: 'win', subject: 'mano', team: 0 }]],
    ['ganó ellos', [{ k: 'win', subject: undefined, team: 1 }]],
    ['ganaron', [{ k: 'win', subject: undefined, team: 1 }]],
    ['flor para nosotros', [{ k: 'win', subject: 'flor', team: 0 }]],
    ['punto para ellos', [{ k: 'win', subject: 'mano', team: 1 }]],
  ])('%s', (text, expected) => {
    expect(p(text)).toEqual(expected);
  });
});

describe('puntos y control', () => {
  it.each<[string, Intent[]]>([
    ['sumale dos a ellos', [{ k: 'points', delta: 2, team: 1 }]],
    ['dos puntos para nosotros', [{ k: 'points', delta: 2, team: 0 }]],
    ['restale uno a nosotros', [{ k: 'points', delta: -1, team: 0 }]],
    ['más 3 ellos', [{ k: 'points', delta: 3, team: 1 }]],
    ['deshacer', [{ k: 'undo' }]],
    ['me equivoqué', [{ k: 'undo' }]],
    ['son buenas', [{ k: 'buenas' }]],
    ['revancha', [{ k: 'rematch' }]],
    ['nosotros', [{ k: 'team', team: 0 }]],
    ['fueron ellos', [{ k: 'team', team: 1 }]],
  ])('%s', (text, expected) => {
    expect(p(text)).toEqual(expected);
  });
});

describe('charla de la mesa que no debe anotar nada', () => {
  it.each([
    'tengo treinta y tres',
    'veintiocho',
    'ellos son mano',
    'sos mano',
    'para mí que tiene flor', // "flor" sin equipo: canto sin equipo, lo resuelve el contexto
    '¿quieren?',
    'dale que va',
    'qué buena carta, ellos no saben nada',
  ])('%s', (text) => {
    const intents = p(text);
    expect(intents.filter((i) => i.k !== 'call')).toEqual([]);
  });
});

describe('nombres de equipo propios', () => {
  const custom: [string, string] = ['Los Pibes', 'Las Chicas'];
  it('reconoce el nombre completo', () => {
    expect(p('truco los pibes', custom)).toEqual([{ k: 'call', call: 'truco', team: 0 }]);
  });
  it('reconoce una palabra del nombre', () => {
    expect(p('envido para las chicas', custom)).toEqual([{ k: 'win', subject: 'envido', team: 1 }]);
    expect(p('chicas', custom)).toEqual([{ k: 'team', team: 1 }]);
  });
  it('tolera un error de reconocimiento', () => {
    expect(p('truco chica', ['Toto', 'Chicas'])).toEqual([{ k: 'call', call: 'truco', team: 1 }]);
  });
  it('sigue aceptando nosotros / ellos', () => {
    expect(p('truco ellos', custom)).toEqual([{ k: 'call', call: 'truco', team: 1 }]);
  });
});
