import { useCallback, useState } from 'react';
import { store, useStore } from '../app/store';
import { useController } from '../app/useController';
import { useWakeLock } from '../app/useWakeLock';
import { Board } from '../components/Board';
import { CallsSheet } from '../components/CallsSheet';
import { HandPanel } from '../components/HandPanel';
import { HelpSheet, HistorySheet, NamesSheet, RulesSheet, VoiceSheet } from '../components/Sheets';
import { Sheet } from '../components/Sheet';
import { Toast } from '../components/Toast';
import { VoiceDock } from '../components/VoiceDock';
import { WinnerOverlay } from '../components/WinnerOverlay';
import { BackIcon, MenuIcon } from '../components/icons';
import { variantLabel } from '../game/rules';

type Panel = 'none' | 'calls' | 'menu' | 'history' | 'help' | 'voice' | 'names' | 'rules' | 'end';

export function Match({ onHome, onNewMatch }: { onHome(): void; onNewMatch(): void }) {
  const { state, saved, prefs } = useStore();
  const ctl = useController();
  const [panel, setPanel] = useState<Panel>('none');
  const close = useCallback(() => setPanel('none'), []);
  useWakeLock(prefs.keepAwake);

  if (!state || !saved) return null;
  const { settings } = state;
  const open = (p: Panel) => () => setPanel(p);

  return (
    <main className="screen match">
      <header className="topbar">
        <button type="button" className="round-btn round-btn--small" onClick={onHome} aria-label="Ir al inicio">
          <BackIcon />
        </button>
        <h1 className="topbar__title">Trucardo</h1>
        <button type="button" className="round-btn round-btn--small" onClick={open('menu')} aria-label="Menú">
          <MenuIcon />
        </button>
      </header>
      <p className="match__meta">
        Truco {variantLabel(settings.variant).toLowerCase()} a {settings.target}
        {settings.flor ? ', con flor' : ', sin flor'}
      </p>

      <Board state={state} onAdjust={(team, delta) => ctl.tap({ k: 'points', team, delta })} onRename={open('names')} />

      <div className="table-panel">
        <Toast toast={ctl.toast} onUndo={ctl.undo} onDone={ctl.dismissToast} />
        <HandPanel state={state} ctl={ctl} onOpenCalls={open('calls')} />
        <VoiceDock ctl={ctl} canUndo={saved.actions.length > 0} onOpenCalls={open('calls')} />
      </div>

      <CallsSheet open={panel === 'calls'} onClose={close} state={state} ctl={ctl} />

      <Sheet open={panel === 'menu'} onClose={close} title="Menú">
        <nav className="menu">
          <button type="button" onClick={open('history')}>Historial de la partida</button>
          <button type="button" onClick={open('help')}>Cómo hablarle a la app</button>
          <button type="button" onClick={open('voice')}>Voz y sonido</button>
          <button type="button" onClick={open('names')}>Nombres de los equipos</button>
          <button type="button" onClick={open('rules')}>Reglas de esta partida</button>
          <button type="button" onClick={onNewMatch}>Nueva partida</button>
          <button type="button" className="menu__danger" onClick={open('end')}>
            Terminar esta partida
          </button>
        </nav>
      </Sheet>
      <HistorySheet open={panel === 'history'} onClose={close} state={state} onUndo={ctl.undo} />
      <HelpSheet open={panel === 'help'} onClose={close} names={settings.names} />
      <VoiceSheet open={panel === 'voice'} onClose={close} prefs={prefs} onChange={ctl.reconfigure} />
      <NamesSheet open={panel === 'names'} onClose={close} names={settings.names} />
      <RulesSheet open={panel === 'rules'} onClose={close} settings={settings} />
      <Sheet open={panel === 'end'} onClose={close} title="¿Terminar la partida?">
        <p className="empty">Se borra el tanteador de este teléfono. No se puede deshacer.</p>
        <div className="confirm">
          <button type="button" className="btn btn--wide" onClick={close}>
            Seguir jugando
          </button>
          <button
            type="button"
            className="btn btn--danger btn--wide"
            onClick={() => {
              store.endMatch();
              onHome();
            }}
          >
            Terminar partida
          </button>
        </div>
      </Sheet>

      <WinnerOverlay
        state={state}
        saved={saved}
        onRematch={() => store.rematch()}
        onUndo={ctl.undo}
        onExit={onHome}
      />
    </main>
  );
}
