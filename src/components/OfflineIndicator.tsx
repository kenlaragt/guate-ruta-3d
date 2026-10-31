import React, { useState } from 'react';
import { Globe, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  forceOfflineMode?: boolean;
  onSwitchToOnline?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  forceOfflineMode = false,
  onSwitchToOnline,
}) => {
  const networkOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  const isOfflineActive = !networkOnline || forceOfflineMode;

  if (!isOfflineActive) {
    if (dismissed) {
      setDismissed(false);
    }
    return null;
  }

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-lg border border-amber-500 max-w-[94vw]"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">
          {!networkOnline
            ? 'Local (Sin Internet) — Circuitos 3D, vehículos y trofeos activos en el dispositivo'
            : 'Modalidad activa: Local (Sin Internet)'}
        </span>
      </div>

      {forceOfflineMode && networkOnline && onSwitchToOnline && (
        <button
          type="button"
          onClick={onSwitchToOnline}
          className="px-2.5 py-0.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
        >
          <Globe className="w-3 h-3" />
          <span>Conexión Global + Pistas en Tiempo Real</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Ocultar aviso de modalidad local"
        className="p-0.5 rounded hover:bg-amber-500/40 shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
