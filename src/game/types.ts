/** 0 = primer equipo ("Nosotros"), 1 = segundo equipo ("Ellos"). */
export type Team = 0 | 1;
export const other = (t: Team): Team => (t === 0 ? 1 : 0);

export type Variant = 'uruguayo' | 'argentino';

/**
 * Cómo se calcula la falta envido / contraflor al resto.
 * - resto: lo que le falta al que va ganando para ganar el partido.
 * - malasGana: si el que va ganando está en las malas, la falta gana el partido;
 *   en las buenas vale lo que le falta al que va ganando.
 * - tramo: en las malas vale lo que le falta al que va ganando para entrar en las
 *   buenas; en las buenas, lo que le falta para ganar.
 */
export type FaltaRule = 'resto' | 'malasGana' | 'tramo';

export type EnvidoKind = 'envido' | 'real' | 'falta';
export type FlorBetKind = 'conflorenvido' | 'contraflor' | 'resto';
export type TrucoLevel = 1 | 2 | 3;
export type Pendable = 'truco' | 'envido' | 'flor';

export interface Settings {
  variant: Variant;
  target: number;
  /** Dividir en malas y buenas (la raya a la mitad del tablero). */
  halves: boolean;
  flor: boolean;
  falta: FaltaRule;
  /** Puntos de flor contra flor sin apuesta (y de "con flor me achico"). */
  florDuel: number;
  /** Irse al mazo en primera, sin haberse cantado envido, da 1 punto extra. */
  mazoPrimera: boolean;
  players: 2 | 4 | 6;
  names: [string, string];
}

export type Action =
  | { t: 'truco'; team: Team; level: TrucoLevel }
  | { t: 'envido'; team: Team; kind: EnvidoKind }
  | { t: 'flor'; team: Team }
  | { t: 'florBet'; team: Team; kind: FlorBetKind }
  | { t: 'florQuiero'; team: Team }
  | { t: 'achico'; team: Team }
  | { t: 'quiero'; target?: Pendable }
  | { t: 'noQuiero'; target?: Pendable }
  | { t: 'buenas' }
  | { t: 'ganaEnvido'; team: Team }
  | { t: 'ganaFlor'; team: Team }
  | { t: 'ganaMano'; team: Team }
  | { t: 'mazo'; team: Team; primera?: boolean }
  | { t: 'ajuste'; team: Team; delta: number };

export interface TrucoState {
  /** Nivel querido: 0 nada, 1 truco, 2 retruco, 3 vale cuatro. */
  level: 0 | TrucoLevel;
  /** Equipo que "tiene el quiero" (puede subir la apuesta). null = cualquiera. */
  holder: Team | null;
  pending: { level: TrucoLevel; by: Team } | null;
}

export interface EnvidoState {
  calls: { kind: EnvidoKind; by: Team }[];
  status: 'none' | 'pending' | 'accepted' | 'done' | 'cancelled';
}

export interface FlorState {
  /** Cada flor cantada (un equipo puede tener varias en partidas de 4 o 6). */
  flores: Team[];
  bets: { kind: FlorBetKind; by: Team }[];
  betStatus: 'none' | 'pending' | 'accepted';
  done: boolean;
}

export interface HandResult {
  winner: Team;
  points: number;
  reason: string;
}

export interface HandState {
  n: number;
  truco: TrucoState;
  envido: EnvidoState;
  flor: FlorState;
  /** Cantos esperando respuesta (quiero / no quiero); el último es el de arriba. */
  stack: Pendable[];
  /** El truco (la mano) ya se definió; se anota al cerrar la mano. */
  result: HandResult | null;
}

export type LogKind = 'call' | 'answer' | 'points' | 'hand' | 'info';

export interface LogEntry {
  hand: number;
  kind: LogKind;
  text: string;
  team?: Team;
  pts?: number;
}

export interface MatchState {
  settings: Settings;
  score: [number, number];
  winner: Team | null;
  hand: HandState;
  log: LogEntry[];
}

export type FlorPhase = 'none' | 'solo' | 'duel' | 'bet' | 'betAccepted' | 'done';
