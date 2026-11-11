import React from 'react';
import { CarSpec } from '../types/game';

interface MiniVehicleFigureProps {
  car: CarSpec;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  activeLabel?: string;
}

export const MiniVehicleFigure: React.FC<MiniVehicleFigureProps> = ({
  car,
  isSelected = false,
  onSelect,
  compact = false,
  activeLabel = 'ACTIVO',
}) => {
  // Render distinct silhouette per bodyStyle
  const renderSilhouette = () => {
    switch (car.bodyStyle) {
      case 'electric_quad_trike':
        return (
          <svg viewBox="0 0 48 32" className="w-9 h-6 shrink-0" fill="none">
            {/* Quad / Trike frame & roll cage */}
            <circle cx="8" cy="22" r="5" fill="#1e293b" stroke={car.defaultPaint} strokeWidth="1.5" />
            <circle cx="40" cy="22" r="5" fill="#1e293b" stroke={car.defaultPaint} strokeWidth="1.5" />
            <path d="M12 20 L20 12 L28 12 L36 20 Z" fill={car.defaultPaint} />
            <path d="M20 12 L22 6 L26 6 L28 12 Z" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="24" cy="9" r="2.5" fill="#facc15" />
          </svg>
        );
      case 'electric_tricycle':
        return (
          <svg viewBox="0 0 48 32" className="w-9 h-6 shrink-0" fill="none">
            {/* Front wheel + 2 rear wheels + solar canopy */}
            <circle cx="10" cy="22" r="5" fill="#1e293b" stroke={car.defaultPaint} strokeWidth="1.5" />
            <circle cx="38" cy="22" r="5" fill="#1e293b" stroke={car.defaultPaint} strokeWidth="1.5" />
            <path d="M14 20 L18 10 L34 10 L40 20 Z" fill={car.defaultPaint} />
            <rect x="16" y="7" width="18" height="3" rx="1.5" fill="#38bdf8" />
            <circle cx="24" cy="14" r="2.5" fill="#f8fafc" />
          </svg>
        );
      case 'tuk_tuk':
        return (
          <svg viewBox="0 0 48 32" className="w-9 h-6 shrink-0" fill="none">
            <circle cx="10" cy="22" r="4.5" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="38" cy="22" r="4.5" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
            <path d="M8 18 L14 7 L36 7 L42 18 L40 22 L10 22 Z" fill={car.defaultPaint} />
            <rect x="15" y="9" width="10" height="7" rx="1" fill="#bae6fd" opacity="0.8" />
            <rect x="14" y="6" width="23" height="2.5" rx="1" fill="#facc15" />
          </svg>
        );
      case 'gtr_race':
      case 'supercar_wedge':
        return (
          <svg viewBox="0 0 48 32" className="w-9 h-6 shrink-0" fill="none">
            <circle cx="8" cy="23" r="4" fill="#0f172a" stroke="#dc2626" strokeWidth="1.5" />
            <circle cx="40" cy="23" r="4" fill="#0f172a" stroke="#dc2626" strokeWidth="1.5" />
            <path d="M4 22 L14 20 L28 17 L38 20 L44 22 Z" fill={car.defaultPaint} />
            <rect x="38" y="12" width="6" height="7" rx="1" fill="#dc2626" />
            <rect x="2" y="19" width="6" height="2" fill="#dc2626" />
            <circle cx="26" cy="16" r="2.5" fill="#f8fafc" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 48 32" className="w-9 h-6 shrink-0" fill="none">
            {/* Sleek sports car aerodynamic silhouette */}
            <circle cx="10" cy="22" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="38" cy="22" r="4.5" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M4 21 L12 18 L20 11 L32 11 L40 18 L44 21 Z" fill={car.defaultPaint} />
            <path d="M20 12 L30 12 L36 17 L18 17 Z" fill="#bae6fd" opacity="0.75" />
            <rect x="42" y="15" width="4" height="2" rx="0.5" fill="#f59e0b" />
          </svg>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex items-center gap-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
        compact ? 'p-2' : 'p-2.5 sm:p-3'
      } ${
        isSelected
          ? 'bg-sky-600 border-sky-500 text-white shadow-md ring-2 ring-amber-400/80 scale-[1.01]'
          : 'bg-white hover:bg-sky-50/80 border-slate-200 text-slate-800 hover:border-sky-300'
      }`}
    >
      <div
        className={`p-1 rounded-lg border flex items-center justify-center shrink-0 ${
          isSelected
            ? 'bg-slate-900 border-sky-400/50 shadow-inner'
            : 'bg-slate-900/90 border-slate-700'
        }`}
      >
        {renderSilhouette()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`font-bold truncate ${
              compact ? 'text-xs' : 'text-xs sm:text-sm'
            } ${isSelected ? 'text-white' : 'text-slate-900 group-hover:text-sky-700'}`}
          >
            {car.name}
          </span>
          {isSelected && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 shrink-0">
              {activeLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
          <span
            className={`font-mono font-bold ${
              isSelected ? 'text-amber-200' : 'text-slate-500'
            }`}
          >
            {car.topSpeedKmh} km/h
          </span>
          <span
            className={`truncate ${
              isSelected ? 'text-sky-100' : 'text-emerald-700 font-semibold'
            }`}
          >
            {car.valueMessage}
          </span>
        </div>
      </div>
    </button>
  );
};
