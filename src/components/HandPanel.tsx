import type { Controller } from '../app/useController';
import { handChips, handValue } from '../game/describe';
import { awaiting, envidoChainLabel } from '../game/engine';
import { FLOR_BET_LABEL, TRUCO_LABEL, envidoAcceptedValue } from '../game/rules';
import { other, type MatchState, type Team } from '../game/types';
import type { CallKind } from '../voice/parser';
import { CloseIcon } from './icons';

interface Props {
  state: MatchState;
  ctl: Controller;
  onOpenCalls(): void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function HandPanel({ state, ctl, onOpenCalls }: Props) {
  const { hand: h, settings } = state;
  const names = settings.names;
  const chips = handChips(state);
  const wait = awaiting(state);

  const teamButtons = (onPick: (t: Team) => void) => (
    <div className="prompt__actions">
      {([0, 1] as Team[]).map((t) => (
        <button key={t} type="button" className="btn btn--team" onClick={() => onPick(t)}>
          {names[t]}
        </button>
      ))}
    </div>
  );

  let prompt: { title: string; body: React.ReactNode; tone?: 'ask' | 'pending' } | null = null;

  if (ctl.ask) {
    prompt = {
      title: ctl.ask.question,
      tone: 'ask',
      body: (
        <div className="prompt__row">
          {teamButtons(ctl.answerAsk)}
          <button type="button" className="icon-btn" onClick={ctl.cancelAsk} aria-label="Cancelar">
            <CloseIcon />
          </button>
        </div>
      ),
    };
  } else if (wait.answer) {
    let title = '';
    let raise: { call: CallKind; label: string } | null = null;
    if (wait.answer === 'truco' && h.truco.pending) {
      const p = h.truco.pending;
      title = `${cap(TRUCO_LABEL[p.level])} de ${names[p.by]}`;
      if (p.level < 3) {
        const next = (p.level + 1) as 2 | 3;
        raise = { call: next === 2 ? 'retruco' : 'vale4', label: cap(TRUCO_LABEL[next]) };
      }
    } else if (wait.answer === 'envido') {
      const last = h.envido.calls[h.envido.calls.length - 1];
      title = `${envidoChainLabel(h.envido.calls.map((c) => c.kind))} de ${names[last.by]}`;
    } else {
      const last = h.flor.bets[h.flor.bets.length - 1];
      title = `${cap(FLOR_BET_LABEL[last.kind])} de ${names[last.by]}`;
    }
    prompt = {
      title,
      tone: 'pending',
      body: (
        <div className="prompt__actions">
          <button type="button" className="btn btn--gold" onClick={() => ctl.tap({ k: 'quiero' })}>
            Quiero
          </button>
          <button type="button" className="btn" onClick={() => ctl.tap({ k: 'noQuiero' })}>
            No quiero
          </button>
          {raise ? (
            <button type="button" className="btn btn--ghost" onClick={() => ctl.tap({ k: 'call', call: raise.call })}>
              {raise.label}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onOpenCalls}>
              Subir…
            </button>
          )}
        </div>
      ),
    };
  } else if (wait.envidoWinner) {
    const kinds = h.envido.calls.map((c) => c.kind);
    const v = kinds.includes('falta') ? 'por la falta' : `vale ${envidoAcceptedValue(kinds, state.score, settings, 0)}`;
    prompt = {
      title: `¿Quién ganó el envido? ${cap(v)}`,
      tone: 'ask',
      body: teamButtons((t) => ctl.tap({ k: 'win', subject: 'envido', team: t })),
    };
  } else if (wait.florWinner) {
    prompt = {
      title: '¿Quién ganó la flor?',
      tone: 'ask',
      body: teamButtons((t) => ctl.tap({ k: 'win', subject: 'flor', team: t })),
    };
  } else if (!h.result) {
    const v = handValue(state);
    prompt = {
      title: `¿Quién ganó la mano? Vale ${v}`,
      body: teamButtons((t) => ctl.tap({ k: 'win', subject: 'mano', team: t })),
    };
  }

  return (
    <div className="hand">
      <div className="hand__chips" aria-live="polite">
        <span className="hand__number">Mano {h.n}</span>
        {chips.length === 0 && <span className="chip chip--off">Sin cantos</span>}
        {chips.map((c) => (
          <span key={c.key} className={`chip chip--${c.tone}`}>
            {c.text}
          </span>
        ))}
      </div>
      {prompt && (
        <div className={`prompt${prompt.tone ? ` prompt--${prompt.tone}` : ''}`}>
          <p className="prompt__title">{prompt.title}</p>
          {prompt.body}
        </div>
      )}
      {h.truco.pending && !ctl.ask && (
        <button
          type="button"
          className="link-btn hand__mazo"
          onClick={() => ctl.tap({ k: 'mazo', team: other(h.truco.pending!.by), primera: false })}
        >
          Al mazo: {names[other(h.truco.pending.by)]}
        </button>
      )}
    </div>
  );
}
