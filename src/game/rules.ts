import type { EnvidoKind, FlorBetKind, Settings, Team, TrucoLevel, Variant } from './types';

export const TARGETS = [15, 18, 24, 30, 40] as const;

/** Puntos del truco según el nivel querido (0 = no se cantó). */
export const TRUCO_QUERIDO = [1, 2, 3, 4] as const;

export const TRUCO_LABEL: Record<TrucoLevel, string> = {
  1: 'truco',
  2: 'retruco',
  3: 'vale cuatro',
};

export const ENVIDO_LABEL: Record<EnvidoKind, string> = {
  envido: 'envido',
  real: 'real envido',
  falta: 'falta envido',
};

export const FLOR_BET_LABEL: Record<FlorBetKind, string> = {
  conflorenvido: 'con flor envido',
  contraflor: 'contraflor',
  resto: 'contraflor al resto',
};

export const FLOR_BET_RANK: Record<FlorBetKind, number> = {
  conflorenvido: 1,
  contraflor: 2,
  resto: 3,
};

export const FLOR_POINTS = 3;
export const FLOR_BET_POINTS: Record<Exclude<FlorBetKind, 'resto'>, number> = {
  conflorenvido: 5,
  contraflor: 6,
};

export function defaultSettings(variant: Variant = 'uruguayo'): Settings {
  const uy = variant === 'uruguayo';
  return {
    variant,
    target: 30,
    halves: true,
    flor: uy,
    falta: uy ? 'resto' : 'malasGana',
    florDuel: 4,
    mazoPrimera: !uy,
    players: 4,
    names: ['Nosotros', 'Ellos'],
  };
}

export function halfOf(settings: Settings): number | null {
  if (!settings.halves || settings.target % 2 !== 0) return null;
  return settings.target / 2;
}

/** Valor de la falta envido / contraflor al resto para el equipo que la gana. */
export function faltaValue(score: readonly [number, number], settings: Settings, winner: Team): number {
  const { target, falta } = settings;
  const lead = Math.max(score[0], score[1]);
  const half = halfOf(settings);
  if (half !== null && lead < half) {
    if (falta === 'malasGana') return Math.max(1, target - score[winner]);
    if (falta === 'tramo') return Math.max(1, half - lead);
  }
  return Math.max(1, target - lead);
}

export function envidoAcceptedValue(
  kinds: EnvidoKind[],
  score: readonly [number, number],
  settings: Settings,
  winner: Team,
): number {
  if (kinds.includes('falta')) return faltaValue(score, settings, winner);
  return kinds.reduce((sum, k) => sum + (k === 'real' ? 3 : 2), 0);
}

/** "No quiero": 1 si fue un solo canto; si no, la suma de lo ya querido (todo menos el último). */
export function envidoRejectedValue(kinds: EnvidoKind[]): number {
  if (kinds.length <= 1) return 1;
  return kinds.slice(0, -1).reduce((sum, k) => sum + (k === 'real' ? 3 : k === 'envido' ? 2 : 0), 0);
}

export function florBetValue(
  kind: FlorBetKind,
  score: readonly [number, number],
  settings: Settings,
  winner: Team,
): number {
  if (kind === 'resto') return faltaValue(score, settings, winner);
  return FLOR_BET_POINTS[kind];
}

export function variantLabel(v: Variant): string {
  return v === 'uruguayo' ? 'Uruguayo' : 'Argentino';
}

export function faltaRuleLabel(r: Settings['falta']): string {
  switch (r) {
    case 'resto':
      return 'Lo que le falta al que va ganando';
    case 'malasGana':
      return 'En malas gana el partido';
    case 'tramo':
      return 'Por tramo (malas / buenas)';
  }
}
