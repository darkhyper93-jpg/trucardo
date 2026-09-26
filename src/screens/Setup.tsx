import { useState } from 'react';
import { Segmented, Toggle } from '../components/Sheets';
import { BackIcon } from '../components/icons';
import { TARGETS, defaultSettings, faltaRuleLabel } from '../game/rules';
import type { FaltaRule, Settings, Variant } from '../game/types';

interface Props {
  initial: Settings;
  onBack(): void;
  onStart(s: Settings): void;
}

const halvesDefault = (target: number) => target % 2 === 0 && target >= 18;

export function Setup({ initial, onBack, onStart }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const [custom, setCustom] = useState(!(TARGETS as readonly number[]).includes(initial.target));
  const [advanced, setAdvanced] = useState(false);
  const set = (p: Partial<Settings>) => setS((prev) => ({ ...prev, ...p }));

  const setVariant = (variant: Variant) => {
    const d = defaultSettings(variant);
    set({ variant, flor: d.flor, falta: d.falta, mazoPrimera: d.mazoPrimera });
  };
  const setTarget = (target: number) => {
    const t = Math.max(5, Math.min(99, Math.round(target) || 30));
    set({ target: t, halves: halvesDefault(t) });
  };
  const half = s.halves && s.target % 2 === 0 ? s.target / 2 : null;

  return (
    <main className="screen setup">
      <header className="topbar">
        <button type="button" className="round-btn round-btn--small" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <h1 className="topbar__title">Nueva partida</h1>
        <span className="topbar__spacer" />
      </header>

      <div className="setup__scroll">
        <Segmented
          label="Modalidad"
          value={s.variant}
          options={[
            ['uruguayo', 'Uruguayo'],
            ['argentino', 'Argentino'],
          ]}
          onChange={setVariant}
        />

        <div className="field">
          <span className="field__label">A cuántos puntos</span>
          <div className="chips">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                className={!custom && s.target === t ? 'chip-btn is-on' : 'chip-btn'}
                onClick={() => {
                  setCustom(false);
                  setTarget(t);
                }}
              >
                {t}
              </button>
            ))}
            <button type="button" className={custom ? 'chip-btn is-on' : 'chip-btn'} onClick={() => setCustom(true)}>
              Otro
            </button>
          </div>
          {custom && (
            <input
              className="setup__number"
              type="number"
              inputMode="numeric"
              min={5}
              max={99}
              value={s.target}
              onChange={(e) => setTarget(Number(e.target.value))}
              aria-label="Puntos para ganar"
            />
          )}
        </div>

        <Toggle
          label="Malas y buenas"
          hint={half ? `Raya a los ${half}: ${half} malas y ${s.target - half} buenas` : s.target % 2 ? 'Solo con un número par de puntos' : 'Sin raya en el medio'}
          checked={s.halves && s.target % 2 === 0}
          disabled={s.target % 2 !== 0}
          onChange={(v) => set({ halves: v })}
        />
        <Toggle label="Con flor" hint={s.flor ? 'Flor, contraflor y contraflor al resto' : 'Se juega sin flor'} checked={s.flor} onChange={(v) => set({ flor: v })} />

        <Segmented
          label="Jugadores"
          value={String(s.players) as '2' | '4' | '6'}
          options={[
            ['2', '1 vs 1'],
            ['4', '2 vs 2'],
            ['6', '3 vs 3'],
          ]}
          onChange={(v) => set({ players: Number(v) as 2 | 4 | 6 })}
        />

        <div className="field">
          <span className="field__label">Equipos</span>
          <div className="setup__names">
            {[0, 1].map((i) => (
              <input
                key={i}
                value={s.names[i]}
                maxLength={18}
                autoComplete="off"
                aria-label={i === 0 ? 'Primer equipo' : 'Segundo equipo'}
                onChange={(e) => {
                  const names: [string, string] = [...s.names];
                  names[i] = e.target.value;
                  set({ names });
                }}
              />
            ))}
          </div>
          <p className="field__hint">La app escucha estos nombres para saber quién canta. Cortos y fáciles de decir.</p>
        </div>

        <button type="button" className="link-btn setup__more" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced}>
          {advanced ? 'Ocultar reglas finas' : 'Reglas finas (falta envido, flor, mazo)'}
        </button>

        {advanced && (
          <div className="setup__advanced">
            <div className="field">
              <span className="field__label">Falta envido y contraflor al resto</span>
              <div className="radios" role="radiogroup">
                {(['resto', 'malasGana', 'tramo'] as FaltaRule[]).map((r) => (
                  <label key={r} className="radio">
                    <input type="radio" name="falta" checked={s.falta === r} onChange={() => set({ falta: r })} />
                    <span>{faltaRuleLabel(r)}</span>
                  </label>
                ))}
              </div>
            </div>
            {s.flor && (
              <Segmented
                label="Flor contra flor (y “me achico”) vale"
                value={String(s.florDuel) as '3' | '4' | '6'}
                options={[
                  ['3', '3'],
                  ['4', '4'],
                  ['6', '6'],
                ]}
                onChange={(v) => set({ florDuel: Number(v) })}
              />
            )}
            <Toggle
              label="Irse al mazo en primera sin envido suma 1 más"
              checked={s.mazoPrimera}
              onChange={(v) => set({ mazoPrimera: v })}
            />
          </div>
        )}
      </div>

      <div className="setup__footer">
        <button
          type="button"
          className="btn btn--gold btn--wide btn--tall"
          onClick={() =>
            onStart({
              ...s,
              halves: s.halves && s.target % 2 === 0,
              names: [s.names[0].trim() || 'Nosotros', s.names[1].trim() || 'Ellos'],
            })
          }
        >
          Empezar partida
        </button>
      </div>
    </main>
  );
}
