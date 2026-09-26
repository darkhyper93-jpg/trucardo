import { useRef } from 'react';

/** Gradientes y sombra compartidos por todos los fósforos de la página. */
export function MatchDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mt-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcf3e0" />
          <stop offset=".5" stopColor="#ecd7ae" />
          <stop offset="1" stopColor="#b98f58" />
        </linearGradient>
        <radialGradient id="mt-head" cx=".38" cy=".32" r=".8">
          <stop offset="0" stopColor="#f47a58" />
          <stop offset=".42" stopColor="#c8321b" />
          <stop offset="1" stopColor="#6a1206" />
        </radialGradient>
        <filter id="mt-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.7" dy="1.6" stdDeviation="1" floodColor="#000" floodOpacity=".6" />
        </filter>
      </defs>
    </svg>
  );
}

/** Orden en que se arma el cuadrado: arriba, izquierda, derecha, abajo y la diagonal. */
const STICKS = [
  { x1: 12, y1: 11, x2: 90, y2: 11 },
  { x1: 11, y1: 90, x2: 11, y2: 13 },
  { x1: 89, y1: 12, x2: 89, y2: 90 },
  { x1: 88, y1: 89, x2: 12, y2: 89 },
  { x1: 23, y1: 77, x2: 79, y2: 21 },
];

/** Pequeñas imperfecciones para que no parezcan dibujados con regla. */
const WOBBLE = [
  [0.6, -0.8],
  [-0.9, 0.5],
  [0.4, 0.9],
  [-0.5, -0.6],
  [0.3, 0.4],
];

function Stick({ i, fresh }: { i: number; fresh: boolean }) {
  const s = STICKS[i];
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy);
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + WOBBLE[i][1];
  return (
    <g transform={`translate(${s.x1 + WOBBLE[i][0]} ${s.y1}) rotate(${deg})`}>
      <g className={fresh ? 'stick stick--new' : 'stick'} style={{ animationDelay: fresh ? `${i * 0.06}s` : undefined }}>
        <rect x="0" y="-2.9" width={len - 3} height="5.8" rx="1.8" fill="url(#mt-body)" />
        <ellipse cx={len - 3} cy="0" rx="5.4" ry="4" fill="url(#mt-head)" />
      </g>
    </g>
  );
}

export function TallyBox({ count, size, label }: { count: number; size: number; label?: string }) {
  const prev = useRef(count);
  const newFrom = useRef(count);
  if (count !== prev.current) {
    newFrom.current = count > prev.current ? prev.current : count;
    prev.current = count;
  }
  return (
    <svg
      className="tally"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g filter="url(#mt-shadow)">
        {Array.from({ length: Math.min(5, count) }, (_, i) => (
          <Stick key={i} i={i} fresh={i >= newFrom.current} />
        ))}
      </g>
    </svg>
  );
}
