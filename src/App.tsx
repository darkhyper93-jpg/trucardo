import { useCallback, useEffect, useState } from 'react';
import { store, useStore } from './app/store';
import { MatchDefs } from './components/Matchsticks';
import { HelpSheet } from './components/Sheets';
import { Home } from './screens/Home';
import { Match } from './screens/Match';
import { Setup } from './screens/Setup';

type Screen = 'home' | 'setup' | 'match';

export function App() {
  const { state, prefs } = useStore();
  const [screen, setScreen] = useState<Screen>(() => (state && state.winner === null ? 'match' : 'home'));
  const [help, setHelp] = useState(false);

  // El botón "atrás" del teléfono vuelve al inicio en vez de cerrar la app.
  const go = useCallback((next: Screen) => {
    setScreen(next);
    if (next === 'home') history.replaceState({ screen: 'home' }, '');
    else history.pushState({ screen: next }, '');
  }, []);
  useEffect(() => {
    history.replaceState({ screen: 'home' }, '');
    if (screen !== 'home') history.pushState({ screen }, '');
    const onPop = (e: PopStateEvent) => setScreen((e.state?.screen as Screen) ?? 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effective: Screen = screen === 'match' && !state ? 'home' : screen;

  return (
    <>
      <MatchDefs />
      {effective === 'home' && (
        <Home state={state} onNew={() => go('setup')} onContinue={() => go('match')} onHelp={() => setHelp(true)} />
      )}
      {effective === 'setup' && (
        <Setup
          initial={prefs.lastSettings}
          onBack={() => go('home')}
          onStart={(s) => {
            store.newMatch(s);
            setScreen('match');
            history.replaceState({ screen: 'match' }, '');
          }}
        />
      )}
      {effective === 'match' && <Match onHome={() => go('home')} onNewMatch={() => go('setup')} />}
      <HelpSheet open={help} onClose={() => setHelp(false)} names={state?.settings.names ?? ['Nosotros', 'Ellos']} />
    </>
  );
}
