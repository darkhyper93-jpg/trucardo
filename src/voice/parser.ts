import type { Team } from '../game/types';

export type CallKind =
  | 'truco'
  | 'retruco'
  | 'vale4'
  | 'envido'
  | 'real'
  | 'falta'
  | 'flor'
  | 'contraflor'
  | 'resto'
  | 'conflorenvido';

export type Subject = 'envido' | 'flor' | 'mano';

export type Intent =
  | { k: 'call'; call: CallKind; team?: Team }
  | { k: 'quiero' }
  | { k: 'noQuiero' }
  | { k: 'florQuiero'; team?: Team }
  | { k: 'achico'; team?: Team }
  | { k: 'buenas' }
  | { k: 'win'; subject?: Subject; team?: Team }
  | { k: 'mazo'; team?: Team; primera: boolean }
  | { k: 'points'; delta: number; team?: Team }
  | { k: 'undo' }
  | { k: 'rematch' }
  | { k: 'team'; team: Team };

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reemplazos en orden: primero las frases largas, después las palabras sueltas.
 * Los tokens resultantes van en MAYÚSCULAS para no volver a matchear.
 */
const EPRIMERO = String.raw`(el )?envido (esta|va) primero|primero (esta |va )?el envido`;

const RULES: [RegExp, string][] = [
  // "El envido está primero, real envido": la frase hecha no es un canto aparte si sigue otro.
  [new RegExp(String.raw`\b(${EPRIMERO})\b(?=.*\b(envido|en vido|embido|real|falta)\b)`, 'g'), ' '],
  [new RegExp(String.raw`\b(${EPRIMERO})\b`, 'g'), ' ENVIDO '],
  [/\bvale ?(cuatro|4)\b/g, ' VALE4 '],
  [/\b(re ?truco|retruca|retruque)\b/g, ' RETRUCO '],
  [/\b(truco|truca|trucos|truko)\b/g, ' TRUCO '],
  [/\b(contra ?flor|con ?flor|flor) (al|el|a) resto\b/g, ' RESTO '],
  [/\bcontra ?flor resto\b/g, ' RESTO '],
  [/\bcon ?flor (me|nos) achic[a-z]*\b/g, ' ACHICO '],
  [/\b(me|nos) achic[a-z]*\b/g, ' ACHICO '],
  [/\bcon ?flor (quiero|queremos|acepto)\b/g, ' CFQUIERO '],
  [/\bcon ?flor (envido|en vido|embido)\b/g, ' CFENVIDO '],
  [/\bcontra ?flor\b/g, ' CONTRAFLOR '],
  [/\b(flor|flores)\b/g, ' FLOR '],
  [/\breal (envido|en vido|embido|invido|envidio|en bido)\b/g, ' REAL '],
  [/\b(falta envido|falta en vido|falta embido|a la falta|la falta)\b/g, ' FALTA '],
  [/\b(envido|en vido|embido|invido|envidio|envida|en bido|envidia)\b/g, ' ENVIDO '],
  [/\b(no quiero|no queremos|no quiere|no quieren|no quero|no acepto|no aceptamos|no va)\b/g, ' NOQ '],
  [/\b(quiero|queremos|quero|acepto|aceptamos|aceptado)\b/g, ' Q '],
  [/\b((me|nos|se) (voy|vamos|va|van|fui|fuimos|fue|fueron) )?al mazo\b/g, ' MAZO '],
  [/\bmazo\b/g, ' MAZO '],
  [
    /\b(deshacer|deshace|deshaz|deshacelo|borra|borrar|borralo|anula|anular|anulalo|cancela|cancelar|cancelalo|me equivoque|nos equivocamos|volve atras|volver atras)\b/g,
    ' UNDO ',
  ],
  [/\b(son buenas|buenas son|son buenos|buenas)\b/g, ' BUENAS '],
  [/\b(la revancha|revancha|otra partida)\b/g, ' REVANCHA '],
  [/\ben primera\b|\bprimera\b/g, ' PRIMERA '],
  [/\b(ganamos|llevamos|nos llevamos)\b/g, ' WIN TEAM0 '],
  [/\b(ganaron|ganan|se llevan|llevan)\b/g, ' WIN TEAM1 '],
  [/\b(gano|gana|ganador|ganadores|ganadora|para|lleva|se lleva|es de|son de)\b/g, ' WIN '],
  [/\b(mano|ronda)\b/g, ' MANO '],
  [/\b(tanto|tantos)\b/g, ' TANTOS '],
  [/\b(punto|puntos|puntito|puntitos)\b/g, ' PUNTOS '],
  [
    /\b(suma|sumale|sumales|sumar|agrega|agregale|agregales|agregar|anota|anotale|anotales|anotar|mas)\b/g,
    ' PLUS ',
  ],
  [/\b(resta|restale|restales|restar|saca|sacale|sacales|sacar|quita|quitale|quitales|quitar|menos)\b/g, ' MINUS '],
  [/\b(nosotros|nosotras|nuestro|nuestra|nuestros|nuestras|cantamos)\b/g, ' TEAM0 '],
  [/\b(ellos|ellas|ustedes|contrarios|rivales|cantaron)\b/g, ' TEAM1 '],
];

const NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
};

const STOPWORDS = new Set(['los', 'las', 'el', 'la', 'de', 'del', 'y', 'equipo', 'team', 'the']);

const CALLS: Record<string, CallKind> = {
  TRUCO: 'truco',
  RETRUCO: 'retruco',
  VALE4: 'vale4',
  ENVIDO: 'envido',
  REAL: 'real',
  FALTA: 'falta',
  FLOR: 'flor',
  CONTRAFLOR: 'contraflor',
  RESTO: 'resto',
  CFENVIDO: 'conflorenvido',
};

const ANCHORS = new Set([
  ...Object.keys(CALLS),
  'CFQUIERO',
  'ACHICO',
  'Q',
  'NOQ',
  'MAZO',
  'UNDO',
  'BUENAS',
  'REVANCHA',
  'MANO',
  'TANTOS',
]);

/** Anclas que toman equipo / "ganó" de las palabras vecinas. */
const TAKES_MODS = new Set([...Object.keys(CALLS), 'CFQUIERO', 'ACHICO', 'MAZO', 'MANO', 'TANTOS']);

function subjectOf(tok: string): Subject {
  if (['TRUCO', 'RETRUCO', 'VALE4', 'MANO'].includes(tok)) return 'mano';
  if (['FLOR', 'CONTRAFLOR', 'RESTO', 'CFENVIDO'].includes(tok)) return 'flor';
  return 'envido';
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

interface Tok {
  tok: string;
  n?: number;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tokenize(text: string, names: readonly [string, string]): Tok[] {
  let s = ` ${normalize(text)} `;
  const normNames = names.map(normalize);
  // Nombres completos de los equipos (el más largo primero).
  [0, 1]
    .filter((t) => normNames[t].length >= 2)
    .sort((a, b) => normNames[b].length - normNames[a].length)
    .forEach((t) => {
      s = s.replace(new RegExp(`\\b${escapeRe(normNames[t])}\\b`, 'g'), ` TEAM${t} `);
    });
  for (const [re, rep] of RULES) s = s.replace(re, rep);

  const nameTokens = normNames.map((n) => n.split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
  const out: Tok[] = [];
  for (const w of s.split(' ')) {
    if (!w) continue;
    if (w === w.toUpperCase() && /[A-Z]/.test(w)) {
      out.push({ tok: w });
    } else if (/^\d+$/.test(w)) {
      out.push({ tok: 'N', n: parseInt(w, 10) });
    } else if (w in NUMBERS) {
      out.push({ tok: 'N', n: NUMBERS[w] });
    } else {
      for (const t of [0, 1]) {
        if (nameTokens[t].some((nt) => nt === w || (nt.length >= 5 && levenshtein(nt, w) <= 1))) {
          out.push({ tok: `TEAM${t}` });
          break;
        }
      }
    }
  }
  return out;
}

const teamOf = (tok: string): Team | undefined => (tok === 'TEAM0' ? 0 : tok === 'TEAM1' ? 1 : undefined);

export function parse(text: string, names: readonly [string, string]): Intent[] {
  const toks = tokenize(text, names);
  const wordCount = normalize(text).split(' ').filter(Boolean).length;
  const anchorIdx = toks.map((t, i) => (ANCHORS.has(t.tok) ? i : -1)).filter((i) => i >= 0);
  const claimed = new Set<number>();
  const primera = toks.some((t) => t.tok === 'PRIMERA');

  // Rango de modificadores antes/después de cada ancla.
  const gapBefore = (a: number) => {
    const prev = anchorIdx[anchorIdx.indexOf(a) - 1] ?? -1;
    return range(prev + 1, a);
  };
  const gapAfter = (a: number) => {
    const next = anchorIdx[anchorIdx.indexOf(a) + 1] ?? toks.length;
    return range(a + 1, next);
  };
  const free = (idx: number[]) => idx.filter((i) => !claimed.has(i));

  const results: { pos: number; intent: Intent }[] = [];

  for (const a of anchorIdx) {
    const tok = toks[a].tok;
    let team: Team | undefined;
    let win = false;
    if (TAKES_MODS.has(tok)) {
      const before = free(gapBefore(a));
      const after = free(gapAfter(a));
      const teamBefore = [...before].reverse().find((i) => teamOf(toks[i].tok) !== undefined);
      const teamAfter = after.find((i) => teamOf(toks[i].tok) !== undefined);
      const pick = teamBefore ?? teamAfter;
      if (pick !== undefined) {
        team = teamOf(toks[pick].tok);
        claimed.add(pick);
        // "ganamos" / "ganaron" generan WIN + TEAM juntos: el WIN pegado al equipo también es nuestro.
      }
      const winIdx = [...before, ...after].find((i) => toks[i].tok === 'WIN');
      if (winIdx !== undefined && team !== undefined) {
        win = true;
        claimed.add(winIdx);
        // Si había un segundo equipo pegado al "ganó" (p. ej. "ganaron ellos"), también se consume.
        [...before, ...after]
          .filter((i) => teamOf(toks[i].tok) === team)
          .forEach((i) => claimed.add(i));
      }
    }
    const pos = a;
    if (tok in CALLS) {
      if (win) results.push({ pos, intent: { k: 'win', subject: subjectOf(tok), team } });
      else results.push({ pos, intent: { k: 'call', call: CALLS[tok], team } });
    } else if (tok === 'MANO' || tok === 'TANTOS') {
      if (win) results.push({ pos, intent: { k: 'win', subject: subjectOf(tok), team } });
    } else if (tok === 'Q') results.push({ pos, intent: { k: 'quiero' } });
    else if (tok === 'NOQ') results.push({ pos, intent: { k: 'noQuiero' } });
    else if (tok === 'CFQUIERO') results.push({ pos, intent: { k: 'florQuiero', team } });
    else if (tok === 'ACHICO') results.push({ pos, intent: { k: 'achico', team } });
    else if (tok === 'MAZO') results.push({ pos, intent: { k: 'mazo', team, primera } });
    else if (tok === 'UNDO') results.push({ pos, intent: { k: 'undo' } });
    else if (tok === 'BUENAS') results.push({ pos, intent: { k: 'buenas' } });
    else if (tok === 'REVANCHA') results.push({ pos, intent: { k: 'rematch' } });
  }

  // Modificadores sueltos: sumar/restar puntos o "ganó X" sin decir de qué.
  const bounds = [-1, ...anchorIdx, toks.length];
  for (let g = 0; g < bounds.length - 1; g++) {
    const idx = free(range(bounds[g] + 1, bounds[g + 1]));
    if (!idx.length) continue;
    const kinds = idx.map((i) => toks[i].tok);
    const teamIdx = idx.find((i) => teamOf(toks[i].tok) !== undefined);
    const team = teamIdx !== undefined ? teamOf(toks[teamIdx].tok) : undefined;
    const numIdx = idx.find((i) => toks[i].tok === 'N');
    const minus = kinds.includes('MINUS');
    const explicitPoints = kinds.includes('PLUS') || minus || kinds.includes('PUNTOS');
    const pos = idx[0];
    if (numIdx !== undefined && explicitPoints) {
      const n = toks[numIdx].n!;
      if (n > 0 && n <= 40) results.push({ pos, intent: { k: 'points', delta: minus ? -n : n, team } });
    } else if (kinds.includes('WIN') && team !== undefined) {
      const subject: Subject | undefined = kinds.includes('PUNTOS') ? 'mano' : undefined;
      results.push({ pos, intent: { k: 'win', subject, team } });
    } else if (team !== undefined && anchorIdx.length === 0 && wordCount <= 3 && !kinds.includes('WIN')) {
      results.push({ pos, intent: { k: 'team', team } });
    }
  }

  return results.sort((x, y) => x.pos - y.pos).map((r) => r.intent);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(i);
  return out;
}
