import type { Saved } from '../app/store';
import type { MatchState } from '../game/types';
import { TallyBox } from './Matchsticks';

interface Props {
  state: MatchState;
  saved: Saved;
  onRematch(): void;
  onUndo(): void;
  onExit(): void;
}

export function WinnerOverlay({ state, saved, onRematch, onUndo, onExit }: Props) {
  if (state.winner === null) return null;
  const w = state.winner;
  const names = state.settings.names;
  const series: [number, number] = [...saved.series];
  series[w]++;
  const loser = w === 0 ? 1 : 0;
  return (
    <div className="winner" role="dialog" aria-modal="true" aria-labelledby="winner-title">
      <div className="winner__card">
        <TallyBox count={5} size={72} />
        <h2 id="winner-title" className="winner__title">
          Ganó {names[w]}
        </h2>
        <p className="winner__score">
          {Math.min(state.score[w], state.settings.target)} a {state.score[loser]}
        </p>
        {series[0] + series[1] > 1 && (
          <p className="winner__series">
            Partidas: {names[0]} {series[0]}, {names[1]} {series[1]}
          </p>
        )}
        <div className="winner__actions">
          <button type="button" className="btn btn--gold btn--wide" onClick={onRematch}>
            Revancha
          </button>
          <button type="button" className="btn btn--wide" onClick={onUndo}>
            Deshacer el último punto
          </button>
          <button type="button" className="link-btn" onClick={onExit}>
            Salir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
