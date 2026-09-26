import { useEffect, useState } from 'react';
import type { MatchState } from '../game/types';
import { TallyBox } from '../components/Matchsticks';

interface Props {
  state: MatchState | null;
  onNew(): void;
  onContinue(): void;
  onHelp(): void;
}

export function Home({ state, onNew, onContinue, onHelp }: Props) {
  // Los cinco palitos se suman de a uno al abrir la app.
  const [count, setCount] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setCount(5);
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      n++;
      setCount(n);
      if (n >= 5) clearInterval(t);
    }, 380);
    return () => clearInterval(t);
  }, []);

  const inProgress = state && state.winner === null;
  const names = state?.settings.names;

  return (
    <main className="screen home">
      <div className="home__hero">
        <div className="home__tally">
          <TallyBox count={count} size={120} label="Cinco puntos anotados con palitos" />
        </div>
        <h1 className="home__title">Trucardo</h1>
        <p className="home__tag">El anotador de truco que escucha la mesa.</p>
      </div>
      <div className="home__actions">
        {inProgress && names && (
          <button type="button" className="btn btn--gold btn--wide btn--tall" onClick={onContinue}>
            Seguir la partida
            <small>
              {names[0]} {state.score[0]}, {names[1]} {state.score[1]}
            </small>
          </button>
        )}
        <button type="button" className={`btn btn--wide btn--tall${inProgress ? '' : ' btn--gold'}`} onClick={onNew}>
          Nueva partida
        </button>
        <button type="button" className="link-btn" onClick={onHelp}>
          Cómo hablarle a la app
        </button>
      </div>
      <p className="home__foot">Truco uruguayo y argentino, con o sin flor. La partida queda guardada en este teléfono.</p>
    </main>
  );
}
