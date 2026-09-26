import { useEffect, useState } from 'react';
import { store, type Prefs } from '../app/store';
import { FLOR_POINTS, faltaRuleLabel, halfOf, variantLabel } from '../game/rules';
import type { LogEntry, MatchState, Settings } from '../game/types';
import { Sheet } from './Sheet';

// ------------------------------------------------------------ historial

export function HistorySheet({ open, onClose, state, onUndo }: { open: boolean; onClose(): void; state: MatchState; onUndo(): void }) {
  const byHand = new Map<number, LogEntry[]>();
  for (const e of state.log) {
    if (!byHand.has(e.hand)) byHand.set(e.hand, []);
    byHand.get(e.hand)!.push(e);
  }
  const hands = [...byHand.entries()].reverse();
  return (
    <Sheet open={open} onClose={onClose} title="Historial">
      {hands.length === 0 ? (
        <p className="empty">Todavía no hay jugadas. Cantá o tocá “¿Quién ganó la mano?” para empezar.</p>
      ) : (
        <>
          <button type="button" className="btn btn--small history__undo" onClick={onUndo}>
            Deshacer la última jugada
          </button>
          <ol className="history">
            {hands.map(([n, entries]) => (
              <li key={n} className="history__hand">
                <h3 className="history__title">Mano {n}</h3>
                <ul>
                  {entries.map((e, i) => (
                    <li key={i} className={`history__entry history__entry--${e.kind}`}>
                      {e.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------ ayuda

const EXAMPLES: { title: string; items: [string, string][] }[] = [
  {
    title: 'Cantar',
    items: [
      ['Truco Nosotros', 'canta el equipo que nombrás'],
      ['Ellos: envido', 'el nombre puede ir antes o después'],
      ['Real envido · Falta envido', 'las subidas no necesitan equipo'],
      ['Flor Nosotros · Contraflor · Contraflor al resto', ''],
      ['Con flor me achico · Con flor quiero · Con flor envido', ''],
      ['El envido está primero', 'con el truco cantado'],
    ],
  },
  {
    title: 'Responder',
    items: [
      ['Quiero · No quiero', 'responde al último canto'],
      ['Quiero retruco · Quiero vale cuatro', 'quiere y sube en una sola frase'],
      ['Ellos se van al mazo', 'también “al mazo en primera”'],
    ],
  },
  {
    title: 'Decir quién ganó',
    items: [
      ['Envido para Nosotros · Ganaron el envido', ''],
      ['Flor para Ellos', 'en flor contra flor'],
      ['Mano para Ellos · Truco para Nosotros · Ganamos', 'cierra la mano y anota el truco'],
      ['Nosotros', 'solo, contesta la pregunta que muestra la pantalla'],
    ],
  },
  {
    title: 'Corregir',
    items: [
      ['Deshacer · Me equivoqué', 'borra la última jugada'],
      ['Sumale dos a Ellos · Restale uno a Nosotros', 'ajustes a mano'],
    ],
  },
];

export function HelpSheet({ open, onClose, names }: { open: boolean; onClose(): void; names: [string, string] }) {
  const swap = (s: string) => s.replaceAll('Nosotros', names[0]).replaceAll('Ellos', names[1]);
  return (
    <Sheet open={open} onClose={onClose} title="Cómo hablarle">
      <p className="help__lead">
        Tocá el micrófono y dejá el teléfono en la mesa. La app escucha los cantos y anota sola. Decí siempre el nombre del equipo en
        el primer canto de cada cosa; las respuestas y subidas se deducen.
      </p>
      {EXAMPLES.map((g) => (
        <section key={g.title} className="help__group">
          <h3>{g.title}</h3>
          <ul>
            {g.items.map(([say, note]) => (
              <li key={say}>
                <span className="help__say">“{swap(say)}”</span>
                {note && <span className="help__note">{note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="help__group">
        <h3>Consejos</h3>
        <ul className="help__tips">
          <li>“{names[0]}” es siempre el primer equipo y “{names[1]}” el segundo, sin importar quién hable. “Nosotros” y “ellos” también funcionan.</li>
          <li>Los tantos (“tengo 33”, “son buenas”) no anotan nada: al final decí “envido para …”.</li>
          <li>Si algo se anotó mal, decí “deshacer” o tocá Deshacer. Todo se puede deshacer.</li>
          <li>La voz funciona en Chrome (Android) y Safari (iPhone) y necesita internet. Sin voz, usá los botones o escribí el canto.</li>
        </ul>
      </section>
    </Sheet>
  );
}

// ------------------------------------------------------------ voz y sonido

const LANGS: [string, string][] = [
  ['es-AR', 'Español de Argentina'],
  ['es-UY', 'Español de Uruguay'],
  ['es-419', 'Español latinoamericano'],
  ['es-ES', 'Español de España'],
  ['es-MX', 'Español de México'],
];

export function VoiceSheet({ open, onClose, prefs, onChange }: { open: boolean; onClose(): void; prefs: Prefs; onChange(): void }) {
  const set = (p: Partial<Prefs>) => {
    store.setPrefs(p);
    onChange();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Voz y sonido">
      <label className="field">
        <span className="field__label">Idioma que escucha</span>
        <select value={prefs.lang} onChange={(e) => set({ lang: e.target.value })}>
          {LANGS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <Segmented
        label="Micrófono"
        value={prefs.listenMode}
        options={[
          ['continuo', 'Manos libres'],
          ['pulsar', 'Una frase por toque'],
        ]}
        onChange={(v) => set({ listenMode: v })}
      />
      <Segmented
        label="La app confirma en voz alta"
        value={prefs.tts}
        options={[
          ['off', 'Nada'],
          ['puntos', 'Los puntos'],
          ['todo', 'Todo'],
        ]}
        onChange={(v) => set({ tts: v })}
      />
      <Toggle label="Sonidos al sumar palitos y al cantar" checked={prefs.sounds} onChange={(v) => set({ sounds: v })} />
      <Toggle label="Pantalla siempre encendida" checked={prefs.keepAwake} onChange={(v) => set({ keepAwake: v })} />
    </Sheet>
  );
}

// ------------------------------------------------------------ nombres

export function NamesSheet({ open, onClose, names }: { open: boolean; onClose(): void; names: [string, string] }) {
  const [a, setA] = useState(names[0]);
  const [b, setB] = useState(names[1]);
  useEffect(() => {
    if (open) {
      setA(names[0]);
      setB(names[1]);
    }
  }, [open, names]);
  const saveNames = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings({ names: [a.trim() || 'Nosotros', b.trim() || 'Ellos'] });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Nombres de los equipos">
      <form onSubmit={saveNames} className="names-form">
        <label className="field">
          <span className="field__label">Primer equipo</span>
          <input value={a} onChange={(e) => setA(e.target.value)} maxLength={18} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field__label">Segundo equipo</span>
          <input value={b} onChange={(e) => setB(e.target.value)} maxLength={18} autoComplete="off" />
        </label>
        <p className="field__hint">Usá nombres cortos y fáciles de decir: la app los escucha para saber quién canta.</p>
        <button type="submit" className="btn btn--gold btn--wide">
          Guardar nombres
        </button>
      </form>
    </Sheet>
  );
}

// ------------------------------------------------------------ reglas

export function rulesSummary(s: Settings): [string, string][] {
  const half = halfOf(s);
  const rows: [string, string][] = [
    ['Modalidad', `Truco ${variantLabel(s.variant).toLowerCase()}`],
    ['Partida', half ? `A ${s.target}: ${half} malas y ${s.target - half} buenas` : `A ${s.target} puntos`],
    ['Jugadores', s.players === 2 ? 'Mano a mano' : s.players === 4 ? 'Dos contra dos' : 'Tres contra tres'],
    ['Falta envido', faltaRuleLabel(s.falta)],
    ['Flor', s.flor ? `Sí: ${FLOR_POINTS} cada una, flor contra flor ${s.florDuel}, contraflor 6, al resto la falta` : 'Sin flor'],
    ['Mazo en primera sin envido', s.mazoPrimera ? 'Suma 1 punto más' : 'Sin punto extra'],
  ];
  return rows;
}

export function RulesSheet({ open, onClose, settings }: { open: boolean; onClose(): void; settings: Settings }) {
  return (
    <Sheet open={open} onClose={onClose} title="Reglas de esta partida">
      <dl className="rules">
        {rulesSummary(settings).map(([k, v]) => (
          <div key={k} className="rules__row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rules__table">
        <h3>Valores</h3>
        <p>Envido 2 · Real envido 3 · Envido envido 4 · Envido real 5 · Envido envido real 7. Sin querer: 1, o lo ya querido.</p>
        <p>Truco 2 (no querido 1) · Retruco 3 (2) · Vale cuatro 4 (3). Mano sin cantos: 1.</p>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------ controles

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange(v: T): void;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-on' : ''} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <label className={`toggle${disabled ? ' toggle--disabled' : ''}`}>
      <span className="toggle__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
    </label>
  );
}
