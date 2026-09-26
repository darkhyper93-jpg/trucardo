import { useState } from 'react';
import type { Controller } from '../app/useController';
import { speechSupported } from '../voice/recognizer';
import { CardsIcon, KeyboardIcon, MicIcon, MicOffIcon, SpeakerIcon, UndoIcon } from './icons';

interface Props {
  ctl: Controller;
  canUndo: boolean;
  onOpenCalls(): void;
}

const STATE_LABEL = {
  off: 'Tocá para escuchar',
  starting: 'Escuchando',
  listening: 'Escuchando',
  hearing: 'Te escucho…',
  paused: 'Hablando',
} as const;

export function VoiceDock({ ctl, canUndo, onOpenCalls }: Props) {
  const [typing, setTyping] = useState(!speechSupported());
  const [text, setText] = useState('');
  const on = ctl.listen !== 'off';
  const supported = speechSupported();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    ctl.typed(text.trim());
    setText('');
  };

  return (
    <div className="dock">
      <div className="dock__heard" aria-live="polite">
        {ctl.voiceError ? (
          <button type="button" className="dock__error" onClick={ctl.clearVoiceError}>
            {ctl.voiceError}
          </button>
        ) : ctl.interim ? (
          <span className="dock__interim">“{ctl.interim}”</span>
        ) : ctl.heard ? (
          <span className={ctl.heard.ok ? 'dock__said' : 'dock__said dock__said--muted'}>
            “{ctl.heard.text}”{ctl.heard.result && <strong> {ctl.heard.result}</strong>}
          </span>
        ) : (
          <span className="dock__hint">{supported ? 'Decí, por ejemplo: “Truco Nosotros”' : 'Escribí o usá los botones'}</span>
        )}
      </div>

      {typing && (
        <form className="dock__type" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribí un canto: truco ellos, quiero…"
            aria-label="Escribir un canto"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn btn--gold btn--small">
            Anotar
          </button>
        </form>
      )}

      <div className="dock__row">
        <button type="button" className="dock__side" onClick={onOpenCalls}>
          <CardsIcon />
          <span>Cantos</span>
        </button>

        <div className="dock__center">
          <button
            type="button"
            className={`mic mic--${ctl.listen}`}
            onClick={ctl.toggleListening}
            aria-pressed={on}
            aria-label={on ? 'Dejar de escuchar' : 'Escuchar la mesa'}
          >
            <span className="mic__glow" aria-hidden="true" />
            {ctl.listen === 'paused' ? <SpeakerIcon /> : supported ? <MicIcon /> : <MicOffIcon />}
          </button>
          <span className="mic__label">
            {STATE_LABEL[ctl.listen]}
            {supported && (
              <button type="button" className="mic__kbd" onClick={() => setTyping((v) => !v)} aria-label="Escribir en vez de hablar" aria-pressed={typing}>
                <KeyboardIcon size={16} />
              </button>
            )}
          </span>
        </div>

        <button type="button" className="dock__side" onClick={ctl.undo} disabled={!canUndo}>
          <UndoIcon />
          <span>Deshacer</span>
        </button>
      </div>
    </div>
  );
}
