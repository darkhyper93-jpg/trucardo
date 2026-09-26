import { envidoChainLabel, florPhase } from './engine';
import { FLOR_BET_LABEL, FLOR_POINTS, TRUCO_LABEL, TRUCO_QUERIDO, envidoAcceptedValue } from './rules';
import type { MatchState } from './types';

export type ChipTone = 'pending' | 'active' | 'done' | 'off';
export interface Chip {
  key: string;
  text: string;
  tone: ChipTone;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function handChips(state: MatchState): Chip[] {
  const { hand: h, settings } = state;
  const name = (t: 0 | 1) => settings.names[t];
  const chips: Chip[] = [];

  const t = h.truco;
  if (t.pending) {
    chips.push({ key: 'truco', text: `${cap(TRUCO_LABEL[t.pending.level])} de ${name(t.pending.by)}`, tone: 'pending' });
  } else if (t.level !== 0) {
    chips.push({ key: 'truco', text: `${cap(TRUCO_LABEL[t.level])} querido, vale ${TRUCO_QUERIDO[t.level]}`, tone: 'active' });
  }

  const e = h.envido;
  if (e.calls.length) {
    const kinds = e.calls.map((c) => c.kind);
    const chain = envidoChainLabel(kinds);
    const last = e.calls[e.calls.length - 1];
    if (e.status === 'pending') chips.push({ key: 'envido', text: `${chain} de ${name(last.by)}`, tone: 'pending' });
    else if (e.status === 'accepted') {
      const v = kinds.includes('falta') ? 'por la falta' : `vale ${envidoAcceptedValue(kinds, state.score, settings, 0)}`;
      chips.push({ key: 'envido', text: `${chain} querido, ${v}`, tone: 'active' });
    } else if (e.status === 'done') chips.push({ key: 'envido', text: `${chain} anotado`, tone: 'done' });
    else chips.push({ key: 'envido', text: 'Envido anulado por la flor', tone: 'off' });
  }

  const f = h.flor;
  const phase = florPhase(f);
  const lastBet = f.bets[f.bets.length - 1];
  if (phase === 'solo') {
    const n = f.flores.length;
    chips.push({
      key: 'flor',
      text: `${n > 1 ? `${n} flores` : 'Flor'} de ${name(f.flores[0])}, +${n * FLOR_POINTS}`,
      tone: 'active',
    });
  } else if (phase === 'duel') chips.push({ key: 'flor', text: `Flor contra flor, vale ${settings.florDuel}`, tone: 'active' });
  else if (phase === 'bet' && lastBet)
    chips.push({ key: 'flor', text: `${cap(FLOR_BET_LABEL[lastBet.kind])} de ${name(lastBet.by)}`, tone: 'pending' });
  else if (phase === 'betAccepted' && lastBet)
    chips.push({ key: 'flor', text: `${cap(FLOR_BET_LABEL[lastBet.kind])} querida`, tone: 'active' });
  else if (phase === 'done') chips.push({ key: 'flor', text: 'Flor anotada', tone: 'done' });

  return chips;
}

export function handValue(state: MatchState): number {
  const t = state.hand.truco;
  return TRUCO_QUERIDO[t.pending ? t.pending.level : t.level];
}
