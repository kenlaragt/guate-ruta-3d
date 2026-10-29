import React, { useRef } from 'react';
import { GearLabel, PlayerHudTelemetry, TransmissionType } from '../types/game';

interface SimulatorControlsRigProps {
  telemetry: PlayerHudTelemetry;
  transmission: TransmissionType;
  onChangeTransmission: (mode: TransmissionType) => void;
  onSelectGear: (gear: GearLabel) => void;
  onShiftStep: (delta: 1 | -1) => void;
  onVirtualInput: (patch: {
    steer?: number | null;
    throttle?: boolean;
    brake?: boolean;
    nitro?: boolean;
  }) => void;
}

const H_PATTERN_SLOTS: Array<{ gear: GearLabel; col: number; row: number; label: string }> = [
  { gear: 'R', col: 0, row: 0, label: 'R' },
  { gear: '1', col: 1, row: 0, label: '1' },
  { gear: '3', col: 2, row: 0, label: '3' },
  { gear: '5', col: 3, row: 0, label: '5' },
  { gear: 'N', col: 0, row: 1, label: 'N' },
  { gear: '2', col: 1, row: 1, label: '2' },
  { gear: '4', col: 2, row: 1, label: '4' },
  { gear: '6', col: 3, row: 1, label: '6' },
];

export const SimulatorControlsRig: React.FC<SimulatorControlsRigProps> = ({
  telemetry,
  transmission,
  onChangeTransmission,
  onSelectGear,
  onShiftStep,
  onVirtualInput,
}) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateWheelDrag = (clientX: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const norm = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width * 0.42)));
    // Positive norm = steer right (-1 in our heading convention, handled in canvas)
    onVirtualInput({ steer: norm });
  };

  const rpmRatio = Math.min(1, telemetry.rpm / Math.max(1000, telemetry.redlineRpm));
  const isRedline = rpmRatio > 0.86;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-20 flex items-end justify-between gap-4">
      {/* LEFT RIG: Interactive Simulator Steering Wheel (Timón) + Pedals */}
      <div className="pointer-events-auto flex items-end gap-3 bg-[#0b101b]/95 border border-slate-800 rounded-2xl p-3.5 shadow-xl">
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium text-slate-400 mb-1.5 whitespace-nowrap">
            Timón ({Math.round(telemetry.steerDegrees)}°)
          </span>
          <div
            ref={wheelRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              updateWheelDrag(e.clientX);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return;
              updateWheelDrag(e.clientX);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              onVirtualInput({ steer: null });
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
              onVirtualInput({ steer: null });
            }}
            title="Arrastra el timón o usa A / D / Flechas"
            className="relative w-28 h-28 md:w-32 md:h-32 cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center"
          >
            <svg
              viewBox="0 0 140 140"
              className="w-full h-full drop-shadow"
              style={{
                transform: `rotate(${telemetry.steerDegrees}deg)`,
                transition: draggingRef.current ? 'none' : 'transform 65ms linear',
              }}
            >
              {/* Outer stitched leather rim */}
              <circle
                cx="70"
                cy="70"
                r="58"
                fill="none"
                stroke="#1e293b"
                strokeWidth="15"
              />
              <circle
                cx="70"
                cy="70"
                r="58"
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              {/* Yellow 12-o'clock racing centering stripe */}
              <rect x="66" y="4.5" width="8" height="15" rx="2" fill="#f59e0b" />
              {/* Three metallic spokes */}
              <path
                d="M18 68 L54 68 L58 78 L20 82 Z"
                fill="#64748b"
              />
              <path
                d="M122 68 L86 68 L82 78 L120 82 Z"
                fill="#64748b"
              />
              <rect x="63" y="82" width="14" height="44" rx="4" fill="#475569" />
              {/* Center hub */}
              <circle cx="70" cy="72" r="20" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
              <circle cx="70" cy="72" r="6" fill="#f59e0b" />
            </svg>
          </div>
        </div>

        {/* Pedals: Brake, Throttle, Nitro */}
        <div className="flex items-end gap-2 pl-1">
          <button
            type="button"
            onPointerDown={() => onVirtualInput({ brake: true })}
            onPointerUp={() => onVirtualInput({ brake: false })}
            onPointerLeave={() => onVirtualInput({ brake: false })}
            className={`w-11 h-20 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-between py-2 select-none touch-none transition-transform ${
              telemetry.brake > 0.1
                ? 'bg-red-600/30 border-red-500 text-red-200 scale-95'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span>Freno</span>
            <span className="font-mono text-[10px] text-slate-400">S</span>
          </button>

          <button
            type="button"
            onPointerDown={() => onVirtualInput({ throttle: true })}
            onPointerUp={() => onVirtualInput({ throttle: false })}
            onPointerLeave={() => onVirtualInput({ throttle: false })}
            className={`w-12 h-24 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-between py-2 select-none touch-none transition-transform ${
              telemetry.throttle > 0.1
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 scale-95'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            <span>Gas</span>
            <span className="font-mono text-[10px] text-slate-400">W</span>
          </button>

          <button
            type="button"
            onPointerDown={() => onVirtualInput({ nitro: true })}
            onPointerUp={() => onVirtualInput({ nitro: false })}
            onPointerLeave={() => onVirtualInput({ nitro: false })}
            className="w-10 h-16 rounded-lg border border-sky-700/70 bg-slate-900 hover:border-sky-400 text-[10px] font-semibold text-sky-300 flex flex-col items-center justify-between py-1.5 select-none touch-none"
          >
            <span>Nitro</span>
            <span className="font-mono tabular-nums text-[10px]">{Math.round(telemetry.nitroPct)}%</span>
          </button>
        </div>
      </div>

      {/* RIGHT RIG: Digital Speedometer + RPM Bar + Mechanical / Automatic Gearbox */}
      <div className="pointer-events-auto flex items-stretch gap-3 bg-[#0b101b]/95 border border-slate-800 rounded-2xl p-3.5 shadow-xl">
        {/* Speed & RPM Cluster */}
        <div className="flex flex-col justify-between min-w-[122px] pr-2 border-r border-slate-800">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-50 leading-none">
              {Math.round(telemetry.speedKmh)}
            </span>
            <span className="text-xs font-medium text-slate-400">km/h</span>
          </div>

          <div className="my-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>RPM</span>
              <span className={`font-mono tabular-nums ${isRedline ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                {Math.round(telemetry.rpm)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-transform duration-75 origin-left ${
                  isRedline ? 'bg-red-500' : 'bg-amber-500'
                }`}
                style={{ transform: `scaleX(${Math.max(0.05, rpmRatio)})` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Marcha</span>
            <span className="font-mono tabular-nums text-lg font-bold text-amber-400">
              {transmission === 'AT' && telemetry.gear !== 'R' && telemetry.gear !== 'N'
                ? `D${telemetry.gear}`
                : telemetry.gear}
            </span>
          </div>
        </div>

        {/* Gearbox Selector: Automatic (AT) vs Mechanical H-Shifter (MT) */}
        <div className="flex flex-col justify-between min-w-[178px]">
          {/* Segmented AT / MT Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 mb-2">
            <button
              type="button"
              onClick={() => onChangeTransmission('AT')}
              className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                transmission === 'AT'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Automático
            </button>
            <button
              type="button"
              onClick={() => onChangeTransmission('MT')}
              className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                transmission === 'MT'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mecánico
            </button>
          </div>

          {transmission === 'MT' ? (
            <div className="space-y-1.5">
              {/* H-Pattern Mechanical Gearbox */}
              <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                {H_PATTERN_SLOTS.map((slot) => {
                  const active = telemetry.gear === slot.gear;
                  return (
                    <button
                      key={slot.gear}
                      type="button"
                      onClick={() => onSelectGear(slot.gear)}
                      className={`h-7 rounded font-mono text-xs font-bold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => onShiftStep(-1)}
                  className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 whitespace-nowrap"
                >
                  - Cambio (Q)
                </button>
                <button
                  type="button"
                  onClick={() => onShiftStep(1)}
                  className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 whitespace-nowrap"
                >
                  + Cambio (E)
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Automatic P / R / N / D Gate */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                {(['R', 'N', '1'] as GearLabel[]).map((g) => {
                  const label = g === '1' ? 'D' : g;
                  const isCurrent =
                    g === '1'
                      ? telemetry.gear !== 'R' && telemetry.gear !== 'N'
                      : telemetry.gear === g;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onSelectGear(g)}
                      className={`h-9 rounded font-mono text-xs font-bold transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-center whitespace-nowrap">
                Cambios automáticos D1–D6 activos
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
