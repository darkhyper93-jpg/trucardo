import { useLayoutEffect, useRef, useState } from 'react';
import { halfOf } from '../game/rules';
import type { MatchState, Team } from '../game/types';
import { TallyBox } from './Matchsticks';
import { MinusIcon, PlusIcon } from './icons';

/** Capacidad de cada cuadrado, agrupados por tramo (malas / buenas). */
function segmentsOf(target: number, half: number | null): number[][] {
  const segs = half ? [half, target - half] : [target];
  return segs.map((seg) => {
    const boxes: number[] = [];
    for (let r = seg; r > 0; r -= 5) boxes.push(Math.min(5, r));
    return boxes;
  });
}

function fill(score: number, segments: number[][]): number[][] {
  let left = score;
  return segments.map((seg) =>
    seg.map((cap) => {
      const n = Math.max(0, Math.min(cap, left));
      left -= n;
      return n;
    }),
  );
}

interface Props {
  state: MatchState;
  onAdjust(team: Team, delta: number): void;
  onRename(team: Team): void;
}

export function Board({ state, onAdjust, onRename }: Props) {
  const { settings, score } = state;
  const half = halfOf(settings);
  const segments = segmentsOf(settings.target, half);
  const rows = segments.reduce((n, s) => n + s.length, 0);
  const filled: [number[][], number[][]] = [fill(score[0], segments), fill(score[1], segments)];

  const bodyRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(56);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      const w = el.clientWidth / 2;
      const perRow = (h - (segments.length - 1) * 18) / rows;
      setBox(Math.max(26, Math.floor(Math.min(84, perRow * 0.8, w * 0.62))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, segments.length]);

  const side = (team: Team) => (
    <div className={`board__side board__side--${team === 0 ? 'left' : 'right'}`}>
      <button type="button" className="round-btn" onClick={() => onAdjust(team, 1)} aria-label={`Sumar un punto a ${settings.names[team]}`}>
        <PlusIcon />
      </button>
      <button type="button" className="round-btn" onClick={() => onAdjust(team, -1)} aria-label={`Restar un punto a ${settings.names[team]}`}>
        <MinusIcon />
      </button>
    </div>
  );

  return (
    <section className="board" aria-label="Tanteador">
      <div className="board__table">
        <div className="board__names">
          {([0, 1] as Team[]).map((t) => (
            <button key={t} type="button" className="team-name" onClick={() => onRename(t)} aria-label={`${settings.names[t]}: ${score[t]} puntos. Tocá para cambiar el nombre`}>
              <span className="team-name__text">{settings.names[t]}</span>
              <span className={`team-name__score${state.winner === t ? ' team-name__score--win' : ''}`}>{Math.min(score[t], settings.target)}</span>
            </button>
          ))}
        </div>
        <div className="board__body" ref={bodyRef}>
          {segments.map((seg, si) => (
            <div key={si} className={`board__segment${si > 0 ? ' board__segment--buenas' : ''}`}>
              {([0, 1] as Team[]).map((t) => (
                <div key={t} className="board__col">
                  {seg.map((_, bi) => (
                    <TallyBox key={bi} count={filled[t][si][bi]} size={box} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {side(0)}
      {side(1)}
    </section>
  );
}
