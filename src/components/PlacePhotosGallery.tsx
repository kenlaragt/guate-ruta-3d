import React, { useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { WorldMapSpec } from '../types/game';

interface PlacePhotosGalleryProps {
  mapSpec: WorldMapSpec;
  compact?: boolean;
  onClose?: () => void;
}

export const PlacePhotosGallery: React.FC<PlacePhotosGalleryProps> = ({
  mapSpec,
  compact = false,
  onClose,
}) => {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const imgKey = mapSpec.id;

  return (
    <div className="bg-[#0f1624] border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-display text-sm sm:text-base font-bold text-slate-50 truncate">
              Vista Escénica Ilustrada · {mapSpec.name}
            </h4>
            <p className="text-xs text-slate-400 truncate">
              {mapSpec.regionLabel} · Escenario recreativo 3D seguro
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 whitespace-nowrap shrink-0"
          >
            Cerrar Vista
          </button>
        )}
      </div>

      <div
        className={`relative w-full ${
          compact ? 'h-48 sm:h-56' : 'h-60 sm:h-72'
        } rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col justify-end`}
      >
        {!broken[imgKey] ? (
          <img
            src={mapSpec.adaptedPhotoUrl}
            alt={mapSpec.adaptedPhotoCaption}
            referrerPolicy="no-referrer"
            onError={() => setBroken((prev) => ({ ...prev, [imgKey]: true }))}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-amber-400/60" />
          </div>
        )}

        <div className="relative z-10 p-3.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent">
          <div className="font-display text-sm sm:text-base font-bold text-white truncate">
            {mapSpec.name}
          </div>
          <div className="text-xs text-slate-200 truncate">{mapSpec.adaptedPhotoCaption}</div>
        </div>
      </div>
    </div>
  );
};
