import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

/** Mantiene la pantalla encendida mientras se juega (donde el navegador lo permite). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    if (!enabled || !nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await nav.wakeLock!.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* sin permiso o batería baja */
      }
    };
    void acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
