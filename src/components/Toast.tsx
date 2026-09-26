import { useEffect } from 'react';
import type { Toast as ToastData } from '../app/useController';

export function Toast({ toast, onUndo, onDone }: { toast: ToastData | null; onUndo(): void; onDone(): void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.tone === 'error' ? 4200 : 3400);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
      <span className="toast__text">{toast.text}</span>
      {toast.undoable && (
        <button
          type="button"
          className="toast__undo"
          onClick={() => {
            onUndo();
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  );
}
