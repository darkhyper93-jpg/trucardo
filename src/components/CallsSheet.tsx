import { useState } from 'react';
import type { Controller } from '../app/useController';
import type { MatchState, Team } from '../game/types';
import type { Intent } from '../voice/parser';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose(): void;
  state: MatchState;
  ctl: Controller;
}

type Btn = { label: string; intent: (team?: Team) => Intent; gold?: boolean };

export function CallsSheet({ open, onClose, state, ctl }: Props) {
  const [who, setWho] = useState<Team | 'auto'>('auto');
  const { settings } = state;
  const team = who === 'auto' ? undefined : who;

  const groups: { title: string; buttons: Btn[] }[] = [
    {
      title: 'Truco',
      buttons: [
        { label: 'Truco', intent: (t) => ({ k: 'call', call: 'truco', team: t }) },
        { label: 'Retruco', intent: (t) => ({ k: 'call', call: 'retruco', team: t }) },
        { label: 'Vale cuatro', intent: (t) => ({ k: 'call', call: 'vale4', team: t }) },
      ],
    },
    {
      title: 'Envido',
      buttons: [
        { label: 'Envido', intent: (t) => ({ k: 'call', call: 'envido', team: t }) },
        { label: 'Real envido', intent: (t) => ({ k: 'call', call: 'real', team: t }) },
        { label: 'Falta envido', intent: (t) => ({ k: 'call', call: 'falta', team: t }) },
      ],
    },
  ];
  if (settings.flor)
    groups.push({
      title: 'Flor',
      buttons: [
        { label: 'Flor', intent: (t) => ({ k: 'call', call: 'flor', team: t }) },
        { label: 'Contraflor', intent: (t) => ({ k: 'call', call: 'contraflor', team: t }) },
        { label: 'Contraflor al resto', intent: (t) => ({ k: 'call', call: 'resto', team: t }) },
        { label: 'Con flor envido', intent: (t) => ({ k: 'call', call: 'conflorenvido', team: t }) },
        { label: 'Con flor quiero', intent: (t) => ({ k: 'florQuiero', team: t }) },
        { label: 'Con flor me achico', intent: (t) => ({ k: 'achico', team: t }) },
      ],
    });
  groups.push({
    title: 'Respuestas',
    buttons: [
      { label: 'Quiero', intent: () => ({ k: 'quiero' }), gold: true },
      { label: 'No quiero', intent: () => ({ k: 'noQuiero' }) },
      { label: 'Al mazo', intent: (t) => ({ k: 'mazo', team: t, primera: false }) },
      ...(settings.mazoPrimera
        ? [{ label: 'Al mazo en primera', intent: (t?: Team) => ({ k: 'mazo', team: t, primera: true }) as Intent }]
        : []),
    ],
  });

  const press = (b: Btn) => {
    ctl.tap(b.intent(team));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Cantos">
      <div className="calls__who" role="radiogroup" aria-label="Quién canta">
        <span>Canta</span>
        <div className="segmented segmented--small">
          {(['auto', 0, 1] as const).map((w) => (
            <button key={String(w)} type="button" role="radio" aria-checked={who === w} className={who === w ? 'is-on' : ''} onClick={() => setWho(w)}>
              {w === 'auto' ? 'Automático' : settings.names[w]}
            </button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="calls__group">
          <h3 className="calls__title">{g.title}</h3>
          <div className="calls__grid">
            {g.buttons.map((b) => (
              <button key={b.label} type="button" className={b.gold ? 'btn btn--gold' : 'btn'} onClick={() => press(b)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="calls__note">En automático, la app deduce quién canta; si no puede, te pregunta.</p>
    </Sheet>
  );
}
