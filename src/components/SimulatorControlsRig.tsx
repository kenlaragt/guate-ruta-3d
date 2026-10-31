import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react';
import { GearLabel, PlayerHudTelemetry, TransmissionType } from '../types/game';

interface SimulatorControlsRigProps {
  telemetry: PlayerHudTelemetry;
  transmission: TransmissionType;
  rigVisible: boolean;
  gearboxVisible: boolean;
  compactMode: boolean;
  resetLayoutSeq: number;
  onToggleRigVisible: (visible: boolean) => void;
  onToggleGearboxVisible: (visible: boolean) => void;
  onToggleCompactMode: () => void;
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

interface Offset2D {
  x: number;
  y: number;
}

const STORAGE_LEFT_OFFSET = 'carros3d_hud_left_offset_v1';
const STORAGE_RIGHT_OFFSET = 'carros3d_hud_right_offset_v1';

function loadSavedOffset(key: string): Offset2D {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw) as Partial<Offset2D>;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return {
        x: Math.max(-600, Math.min(600, parsed.x)),
        y: Math.max(-500, Math.min(200, parsed.y)),
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { x: 0, y: 0 };
}

export const SimulatorControlsRig: React.FC<SimulatorControlsRigProps> = ({
  telemetry,
  transmission,
  rigVisible,
  gearboxVisible,
  compactMode,
  resetLayoutSeq,
  onToggleRigVisible,
  onToggleGearboxVisible,
  onToggleCompactMode,
  onChangeTransmission,
  onSelectGear,
  onShiftStep,
  onVirtualInput,
}) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Independent Multi-Touch Pointer ID Tracking (Zero interference between Left Thumb Steering & Right Thumb Gas/Brake/Nitro!)
  const wheelPointerIdRef = useRef<number | null>(null);
  const wheelSteerValRef = useRef<number>(0);
  const leftTurnPointersRef = useRef<Set<number>>(new Set());
  const rightTurnPointersRef = useRef<Set<number>>(new Set());
  const gasPointersRef = useRef<Set<number>>(new Set());
  const brakePointersRef = useRef<Set<number>>(new Set());
  const nitroPointersRef = useRef<Set<number>>(new Set());

  // Instant 0ms local visual feedback state (never waits on throttled telemetry)
  const [localWheelSteerDeg, setLocalWheelSteerDeg] = useState<number | null>(null);
  const [gasPressed, setGasPressed] = useState<boolean>(false);
  const [brakePressed, setBrakePressed] = useState<boolean>(false);
  const [nitroPressed, setNitroPressed] = useState<boolean>(false);
  const [turnPressed, setTurnPressed] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [gearboxOpen, setGearboxOpen] = useState<boolean>(false);

  const [leftOffset, setLeftOffset] = useState<Offset2D>(() =>
    loadSavedOffset(STORAGE_LEFT_OFFSET),
  );
  const [rightOffset, setRightOffset] = useState<Offset2D>(() =>
    loadSavedOffset(STORAGE_RIGHT_OFFSET),
  );

  const leftDragState = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, pointerId: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const rightDragState = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, pointerId: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    if (resetLayoutSeq > 0) {
      setLeftOffset({ x: 0, y: 0 });
      setRightOffset({ x: 0, y: 0 });
      try {
        localStorage.removeItem(STORAGE_LEFT_OFFSET);
        localStorage.removeItem(STORAGE_RIGHT_OFFSET);
      } catch {
        // Ignore storage errors
      }
    }
  }, [resetLayoutSeq]);

  const syncCombinedSteer = () => {
    if (wheelPointerIdRef.current !== null) {
      onVirtualInput({ steer: wheelSteerValRef.current });
      setLocalWheelSteerDeg(wheelSteerValRef.current * 135);
      setTurnPressed(null);
      return;
    }
    const leftActive = leftTurnPointersRef.current.size > 0;
    const rightActive = rightTurnPointersRef.current.size > 0;
    if (leftActive && !rightActive) {
      onVirtualInput({ steer: -0.92 });
      setLocalWheelSteerDeg(-105);
      setTurnPressed('LEFT');
    } else if (rightActive && !leftActive) {
      onVirtualInput({ steer: 0.92 });
      setLocalWheelSteerDeg(105);
      setTurnPressed('RIGHT');
    } else {
      onVirtualInput({ steer: null });
      setLocalWheelSteerDeg(null);
      setTurnPressed(null);
    }
  };

  const syncPedals = () => {
    const g = gasPointersRef.current.size > 0;
    const b = brakePointersRef.current.size > 0;
    const n = nitroPointersRef.current.size > 0;
    setGasPressed(g);
    setBrakePressed(b);
    setNitroPressed(n);
    onVirtualInput({ throttle: g, brake: b, nitro: n });
  };

  // Global window pointer safety net: if a finger slides off a button or window loses focus, release cleanly without sticking
  useEffect(() => {
    const releasePointerById = (pid: number) => {
      let steerChanged = false;
      let pedalChanged = false;

      if (wheelPointerIdRef.current === pid) {
        wheelPointerIdRef.current = null;
        wheelSteerValRef.current = 0;
        steerChanged = true;
      }
      if (leftTurnPointersRef.current.delete(pid)) steerChanged = true;
      if (rightTurnPointersRef.current.delete(pid)) steerChanged = true;
      if (gasPointersRef.current.delete(pid)) pedalChanged = true;
      if (brakePointersRef.current.delete(pid)) pedalChanged = true;
      if (nitroPointersRef.current.delete(pid)) pedalChanged = true;

      if (steerChanged) syncCombinedSteer();
      if (pedalChanged) syncPedals();
    };

    const onWinPointerUp = (e: PointerEvent) => {
      releasePointerById(e.pointerId);
    };
    const onWinBlur = () => {
      wheelPointerIdRef.current = null;
      wheelSteerValRef.current = 0;
      leftTurnPointersRef.current.clear();
      rightTurnPointersRef.current.clear();
      gasPointersRef.current.clear();
      brakePointersRef.current.clear();
      nitroPointersRef.current.clear();
      setLocalWheelSteerDeg(null);
      setTurnPressed(null);
      setGasPressed(false);
      setBrakePressed(false);
      setNitroPressed(false);
      onVirtualInput({ steer: null, throttle: false, brake: false, nitro: false });
    };

    window.addEventListener('pointerup', onWinPointerUp);
    window.addEventListener('pointercancel', onWinPointerUp);
    window.addEventListener('blur', onWinBlur);
    return () => {
      window.removeEventListener('pointerup', onWinPointerUp);
      window.removeEventListener('pointercancel', onWinPointerUp);
      window.removeEventListener('blur', onWinBlur);
    };
  }, []);

  const saveOffset = (key: string, val: Offset2D) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // Ignore storage errors
    }
  };

  const updateWheelDrag = (clientX: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const norm = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width * 0.42)));
    wheelSteerValRef.current = norm;
    setLocalWheelSteerDeg(norm * 135);
    onVirtualInput({ steer: norm });
  };

  const safeCapture = (target: EventTarget | null, pointerId: number) => {
    try {
      if (target && 'setPointerCapture' in target) {
        (target as HTMLElement).setPointerCapture(pointerId);
      }
    } catch {
      // Ignore capture errors on synthetic touch devices
    }
  };

  const rpmRatio = Math.min(1, telemetry.rpm / Math.max(1000, telemetry.redlineRpm));
  const isRedline = rpmRatio > 0.86;
  const displayedWheelDeg =
    localWheelSteerDeg !== null ? localWheelSteerDeg : telemetry.steerDegrees;
  const isGasActive = gasPressed || telemetry.throttle > 0.1;
  const isBrakeActive = brakePressed || telemetry.brake > 0.1;

  return (
    <>
      {/* LEFT THUMB ZONE: Draggable, Resizable, Hideable Steering Wheel (Timón + Giro Rápido ◀ ▶) */}
      {rigVisible && (
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="game-viewport-lock fixed left-3 bottom-3 z-20 pointer-events-auto select-none touch-none"
          style={{
            transform: `translate3d(${leftOffset.x}px, ${leftOffset.y}px, 0)`,
          }}
        >
          <div
            className={`bg-[#0b101b] border border-slate-800 rounded-xl shadow-xl ${
              compactMode ? 'p-2' : 'p-2.5'
            }`}
          >
            {/* Compact Drag & Size Header */}
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800/80">
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  leftDragState.current = {
                    active: true,
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: leftOffset.x,
                    origY: leftOffset.y,
                  };
                  safeCapture(e.currentTarget, e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (
                    !leftDragState.current.active ||
                    leftDragState.current.pointerId !== e.pointerId
                  ) {
                    return;
                  }
                  const nx = Math.max(
                    -12,
                    Math.min(
                      window.innerWidth - 180,
                      leftDragState.current.origX + (e.clientX - leftDragState.current.startX),
                    ),
                  );
                  const ny = Math.max(
                    -(window.innerHeight - 160),
                    Math.min(
                      8,
                      leftDragState.current.origY + (e.clientY - leftDragState.current.startY),
                    ),
                  );
                  setLeftOffset({ x: nx, y: ny });
                }}
                onPointerUp={(e) => {
                  if (
                    leftDragState.current.active &&
                    leftDragState.current.pointerId === e.pointerId
                  ) {
                    leftDragState.current.active = false;
                    leftDragState.current.pointerId = null;
                    saveOffset(STORAGE_LEFT_OFFSET, leftOffset);
                  }
                }}
                onPointerCancel={(e) => {
                  if (leftDragState.current.pointerId === e.pointerId) {
                    leftDragState.current.active = false;
                    leftDragState.current.pointerId = null;
                  }
                }}
                title="Arrastra aquí para mover el timón"
                className="flex items-center gap-1 text-[11px] font-medium text-slate-300 cursor-move touch-none px-1 py-0.5 rounded hover:bg-slate-800"
              >
                <GripHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Timón ({Math.round(displayedWheelDeg)}°)</span>
              </div>

              <div className="flex items-center gap-1">
                {(leftOffset.x !== 0 || leftOffset.y !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLeftOffset({ x: 0, y: 0 });
                      saveOffset(STORAGE_LEFT_OFFSET, { x: 0, y: 0 });
                    }}
                    title="Devolver a la esquina inferior izquierda"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleCompactMode}
                  title={compactMode ? 'Agrandar mando' : 'Hacer mando más pequeño'}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {compactMode ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleRigVisible(false)}
                  title="Ocultar timón en pantalla (puedes manejar con WASD / Flechas)"
                  className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-slate-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div
                ref={wheelRef}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  wheelPointerIdRef.current = e.pointerId;
                  safeCapture(e.currentTarget, e.pointerId);
                  updateWheelDrag(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (wheelPointerIdRef.current !== e.pointerId) return;
                  e.preventDefault();
                  updateWheelDrag(e.clientX);
                }}
                onPointerUp={(e) => {
                  if (wheelPointerIdRef.current !== e.pointerId) return;
                  wheelPointerIdRef.current = null;
                  wheelSteerValRef.current = 0;
                  syncCombinedSteer();
                }}
                onPointerCancel={(e) => {
                  if (wheelPointerIdRef.current !== e.pointerId) return;
                  wheelPointerIdRef.current = null;
                  wheelSteerValRef.current = 0;
                  syncCombinedSteer();
                }}
                title="Gira el timón con el dedo o usa ◀ ▶ / A / D"
                className={`relative ${
                  compactMode ? 'w-24 h-24' : 'w-28 h-28 md:w-32 md:h-32'
                } cursor-grab active:cursor-grabbing select-none touch-none flex items-center justify-center`}
              >
                <svg
                  viewBox="0 0 140 140"
                  className="w-full h-full pointer-events-none"
                  style={{
                    transform: `rotate(${displayedWheelDeg}deg)`,
                    transition:
                      wheelPointerIdRef.current !== null ? 'none' : 'transform 55ms linear',
                  }}
                >
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="16"
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
                  <rect x="66" y="4.5" width="8" height="15" rx="2" fill="#f59e0b" />
                  <path d="M18 68 L54 68 L58 78 L20 82 Z" fill="#64748b" />
                  <path d="M122 68 L86 68 L82 78 L120 82 Z" fill="#64748b" />
                  <rect x="63" y="82" width="14" height="44" rx="4" fill="#475569" />
                  <circle
                    cx="70"
                    cy="72"
                    r="20"
                    fill="#0f172a"
                    stroke="#64748b"
                    strokeWidth="2.5"
                  />
                  <circle cx="70" cy="72" r="6" fill="#f59e0b" />
                </svg>
              </div>

              {/* Large 44px+ Direct Multi-Touch Left / Right Turn Buttons */}
              <div className="grid grid-cols-2 gap-1.5 mt-1.5 w-full min-w-[136px]">
                <button
                  type="button"
                  aria-label="Girar a la izquierda"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    leftTurnPointersRef.current.add(e.pointerId);
                    safeCapture(e.currentTarget, e.pointerId);
                    syncCombinedSteer();
                  }}
                  onPointerUp={(e) => {
                    leftTurnPointersRef.current.delete(e.pointerId);
                    syncCombinedSteer();
                  }}
                  onPointerCancel={(e) => {
                    leftTurnPointersRef.current.delete(e.pointerId);
                    syncCombinedSteer();
                  }}
                  className={`${
                    compactMode ? 'min-h-[42px] text-sm' : 'min-h-[46px] text-base'
                  } rounded-lg border font-bold select-none touch-none flex items-center justify-center transition-colors ${
                    turnPressed === 'LEFT'
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100'
                  }`}
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Girar a la derecha"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rightTurnPointersRef.current.add(e.pointerId);
                    safeCapture(e.currentTarget, e.pointerId);
                    syncCombinedSteer();
                  }}
                  onPointerUp={(e) => {
                    rightTurnPointersRef.current.delete(e.pointerId);
                    syncCombinedSteer();
                  }}
                  onPointerCancel={(e) => {
                    rightTurnPointersRef.current.delete(e.pointerId);
                    syncCombinedSteer();
                  }}
                  className={`${
                    compactMode ? 'min-h-[42px] text-sm' : 'min-h-[46px] text-base'
                  } rounded-lg border font-bold select-none touch-none flex items-center justify-center transition-colors ${
                    turnPressed === 'RIGHT'
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100'
                  }`}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT THUMB ZONE: Ergonomic Multi-Touch Pedals (Freno, Gas Grande, Nitro) + Compact Speedometer & Optional Gearbox */}
      {(rigVisible || gearboxVisible) && (
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="game-viewport-lock fixed right-3 bottom-3 z-20 pointer-events-auto select-none touch-none"
          style={{
            transform: `translate3d(${rightOffset.x}px, ${rightOffset.y}px, 0)`,
          }}
        >
          <div
            className={`bg-[#0b101b] border border-slate-800 rounded-xl shadow-xl ${
              compactMode ? 'p-2' : 'p-2.5'
            }`}
          >
            {/* Compact Drag, Auto/Manual Toggle & Size Header */}
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800/80">
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  rightDragState.current = {
                    active: true,
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: rightOffset.x,
                    origY: rightOffset.y,
                  };
                  safeCapture(e.currentTarget, e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (
                    !rightDragState.current.active ||
                    rightDragState.current.pointerId !== e.pointerId
                  ) {
                    return;
                  }
                  const nx = Math.max(
                    -(window.innerWidth - 220),
                    Math.min(
                      12,
                      rightDragState.current.origX + (e.clientX - rightDragState.current.startX),
                    ),
                  );
                  const ny = Math.max(
                    -(window.innerHeight - 160),
                    Math.min(
                      8,
                      rightDragState.current.origY + (e.clientY - rightDragState.current.startY),
                    ),
                  );
                  setRightOffset({ x: nx, y: ny });
                }}
                onPointerUp={(e) => {
                  if (
                    rightDragState.current.active &&
                    rightDragState.current.pointerId === e.pointerId
                  ) {
                    rightDragState.current.active = false;
                    rightDragState.current.pointerId = null;
                    saveOffset(STORAGE_RIGHT_OFFSET, rightOffset);
                  }
                }}
                onPointerCancel={(e) => {
                  if (rightDragState.current.pointerId === e.pointerId) {
                    rightDragState.current.active = false;
                    rightDragState.current.pointerId = null;
                  }
                }}
                title="Arrastra aquí para mover acelerador y velocímetro"
                className="flex items-center gap-1 text-[11px] font-medium text-slate-300 cursor-move touch-none px-1 py-0.5 rounded hover:bg-slate-800"
              >
                <GripHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Acelerador</span>
              </div>

              <div className="flex items-center gap-1">
                {gearboxVisible && (
                  <button
                    type="button"
                    onClick={() => setGearboxOpen((v) => !v)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                      gearboxOpen
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {transmission === 'AT' ? 'Auto' : 'Cambios'}
                  </button>
                )}
                {(rightOffset.x !== 0 || rightOffset.y !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRightOffset({ x: 0, y: 0 });
                      saveOffset(STORAGE_RIGHT_OFFSET, { x: 0, y: 0 });
                    }}
                    title="Devolver a la esquina inferior derecha"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleCompactMode}
                  title={compactMode ? 'Agrandar panel' : 'Hacer panel más pequeño'}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {compactMode ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleGearboxVisible(false)}
                  title="Ocultar velocímetro"
                  className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-slate-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Compact Speedometer & RPM Strip */}
            {gearboxVisible && (
              <div className="mb-2 px-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-mono tabular-nums ${
                        compactMode ? 'text-2xl' : 'text-3xl'
                      } font-bold text-slate-50 leading-none`}
                    >
                      {Math.round(telemetry.speedKmh)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">km/h</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Marcha</span>
                    <span className="font-mono tabular-nums text-sm font-bold text-amber-400">
                      {transmission === 'AT' && telemetry.gear !== 'R' && telemetry.gear !== 'N'
                        ? `D${telemetry.gear}`
                        : telemetry.gear}
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800 mt-1">
                  <div
                    className={`h-full transition-transform duration-75 origin-left ${
                      isRedline ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                    style={{ transform: `scaleX(${Math.max(0.05, rpmRatio)})` }}
                  />
                </div>
              </div>
            )}

            {/* Collapsible Auto / Mechanical Gearbox Drawer */}
            {gearboxVisible && gearboxOpen && (
              <div className="mb-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded border border-slate-800">
                  <button
                    type="button"
                    onClick={() => onChangeTransmission('AT')}
                    className={`flex-1 py-1 px-2 text-[10px] font-semibold rounded transition-colors ${
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
                    className={`flex-1 py-1 px-2 text-[10px] font-semibold rounded transition-colors ${
                      transmission === 'MT'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mecánico
                  </button>
                </div>

                {transmission === 'MT' ? (
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-1">
                      {H_PATTERN_SLOTS.map((slot) => {
                        const active = telemetry.gear === slot.gear;
                        return (
                          <button
                            key={slot.gear}
                            type="button"
                            onClick={() => onSelectGear(slot.gear)}
                            className={`h-7 text-xs rounded font-mono font-bold transition-colors ${
                              active
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onShiftStep(-1)}
                        className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-200"
                      >
                        - (Q)
                      </button>
                      <button
                        type="button"
                        onClick={() => onShiftStep(1)}
                        className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-200"
                      >
                        + (E)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
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
                          className={`h-7 rounded font-mono text-xs font-bold transition-colors ${
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
                )}
              </div>
            )}

            {/* Primary Right-Thumb Pedals: Freno, Gas (Extra-Wide & Instant Multi-Touch), Nitro */}
            {rigVisible && (
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    brakePointersRef.current.add(e.pointerId);
                    safeCapture(e.currentTarget, e.pointerId);
                    syncPedals();
                  }}
                  onPointerUp={(e) => {
                    brakePointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  onPointerCancel={(e) => {
                    brakePointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  className={`${
                    compactMode ? 'min-w-[52px] h-18 text-xs' : 'min-w-[58px] h-22 text-xs'
                  } rounded-xl border font-bold flex flex-col items-center justify-between py-2 px-2 select-none touch-none transition-transform ${
                    isBrakeActive
                      ? 'bg-red-600 border-red-300 text-white scale-95'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <span>Freno</span>
                  <span className="font-mono text-[10px] opacity-80">S / Rev</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    gasPointersRef.current.add(e.pointerId);
                    safeCapture(e.currentTarget, e.pointerId);
                    syncPedals();
                  }}
                  onPointerUp={(e) => {
                    gasPointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  onPointerCancel={(e) => {
                    gasPointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  className={`${
                    compactMode ? 'min-w-[74px] h-22 text-sm' : 'min-w-[84px] h-26 text-base'
                  } rounded-xl border-2 font-display font-bold flex flex-col items-center justify-between py-2.5 px-3 select-none touch-none transition-transform ${
                    isGasActive
                      ? 'bg-emerald-500 border-emerald-200 text-slate-950 scale-95 shadow-lg'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow'
                  }`}
                >
                  <span>GAS</span>
                  <span className="font-mono text-[10px] font-bold opacity-85">Acelerar (W)</span>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    nitroPointersRef.current.add(e.pointerId);
                    safeCapture(e.currentTarget, e.pointerId);
                    syncPedals();
                  }}
                  onPointerUp={(e) => {
                    nitroPointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  onPointerCancel={(e) => {
                    nitroPointersRef.current.delete(e.pointerId);
                    syncPedals();
                  }}
                  className={`${
                    compactMode ? 'min-w-[50px] h-18' : 'min-w-[56px] h-20'
                  } rounded-xl border font-bold text-xs flex flex-col items-center justify-between py-2 px-1.5 select-none touch-none transition-transform ${
                    nitroPressed
                      ? 'bg-sky-400 border-white text-slate-950 scale-95'
                      : 'bg-slate-900 border-sky-600/80 text-sky-300 hover:border-sky-400'
                  }`}
                >
                  <span>Nitro</span>
                  <span className="font-mono tabular-nums text-[10px]">
                    {Math.round(telemetry.nitroPct)}%
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
