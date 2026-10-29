import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Camera,
  Car,
  Compass,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  Map as MapIcon,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MinimapCanvas } from './components/MinimapCanvas';
import { PlacePhotosGallery } from './components/PlacePhotosGallery';
import { SimulatorControlsRig } from './components/SimulatorControlsRig';
import { ThreeDrivingSimulator, VirtualRigInput } from './components/ThreeDrivingSimulator';
import { VehiclePreview3D } from './components/VehiclePreview3D';
import {
  getCheckpointAwardPlan,
  GRAND_FINALE_AWARD_TITLE,
  GRAND_FINALE_PRESENTER,
  REAL_PEOPLE_ASSETS,
} from './data/awardsCatalog';
import { CARS_CATALOG, getCarById, PAINT_SWATCHES } from './data/carsCatalog';
import { getMapById, WORLD_MAPS_CATALOG } from './data/worldMapsCatalog';
import { soundEngine } from './engine/soundEngine';
import { useMultiplayerRoom } from './hooks/useMultiplayerRoom';
import {
  AwardDeliveryRecord,
  CameraMode,
  CarModelId,
  GameState,
  GearLabel,
  PlayerHudTelemetry,
  RegionGroup,
  RoadNode2D,
  SessionMode,
  TimeOfDay,
  TransmissionType,
} from './types/game';

const REGION_TABS: Array<{ id: RegionGroup; label: string }> = [
  { id: 'GUATEMALA', label: 'Circuitos de Guatemala 3D' },
  { id: 'PAISES_MUNDO', label: 'España, Brasil, Argentina y Canadá 3D' },
  { id: 'PISTAS_CIRCUITO', label: 'Pistas Cerradas de Carrera 3D' },
];

function createPersistentDriverId(): string {
  try {
    const existing = sessionStorage.getItem('guaterutas_driver_id');
    if (existing) return existing;
    const next = `drv_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('guaterutas_driver_id', next);
    return next;
  } catch {
    return `drv_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function sanitizeGamerUsername(raw: string): string {
  return raw
    .replace(/@/g, '')
    .replace(/\d{5,}/g, '')
    .slice(0, 18);
}

export default function App() {
  const [playerId] = useState<string>(createPersistentDriverId);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');

  // Safe Anonymous User Alias State (No real names or personal data)
  const [sessionMode, setSessionMode] = useState<SessionMode>('SOLO');
  const [p1Alias, setP1Alias] = useState<string>('PilotoGT1');
  const [roomCode, setRoomCode] = useState<string>('PISTA1');
  const [p2Alias, setP2Alias] = useState<string>('PilotoGT2');

  // Stylized 3D Map & UI Drawer State
  const [regionFilter, setRegionFilter] = useState<RegionGroup>('GUATEMALA');
  const [selectedMapId, setSelectedMapId] = useState<string>('gt_antigua');
  const [showHudPhotos, setShowHudPhotos] = useState<boolean>(false);
  const [showHudAwards, setShowHudAwards] = useState<boolean>(false);
  const [awardsWon, setAwardsWon] = useState<AwardDeliveryRecord[]>([]);
  const [recentStageAward, setRecentStageAward] = useState<AwardDeliveryRecord | null>(null);
  const [grandFinaleModalAward, setGrandFinaleModalAward] = useState<AwardDeliveryRecord | null>(
    null,
  );
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | 'URBAN_SPECIAL' | 'CARS'>('ALL');

  // Vehicle & Simulator Controls State
  const [p1CarId, setP1CarId] = useState<CarModelId>('pickup');
  const [p1Paint, setP1Paint] = useState<string>('#2563eb');
  const [p2CarId, setP2CarId] = useState<CarModelId>('tuk_tuk');
  const [p2Paint, setP2Paint] = useState<string>('#dc2626');
  const [transmission, setTransmission] = useState<TransmissionType>('MT');
  const [cameraMode, setCameraMode] = useState<CameraMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAY');
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [descentTrigger, setDescentTrigger] = useState<number>(0);

  // Image Resilience Fallbacks
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Bottom Pasarela / Donation Screen State (Default 'donacion' visible; compatible with Android cambiarPantalla)
  const [activePasarelaScreen, setActivePasarelaScreen] = useState<
    'donacion' | 'consultoria' | 'diploma'
  >('donacion');

  useEffect(() => {
    const win = window as unknown as {
      cambiarPantalla?: (pantalla: string) => void;
      paypal?: {
        HostedButtons?: (opts: { hostedButtonId: string }) => {
          render: (selector: string) => void;
        };
      };
    };

    win.cambiarPantalla = (pantalla: string) => {
      if (pantalla === 'consultoria' || pantalla === 'diploma' || pantalla === 'donacion') {
        setActivePasarelaScreen(pantalla);
      }
    };

    if (win.paypal?.HostedButtons) {
      try {
        win.paypal.HostedButtons({ hostedButtonId: 'PXJM3VAXNCLQA' }).render(
          '#paypal-container-PXJM3VAXNCLQA',
        );
        win.paypal.HostedButtons({ hostedButtonId: 'V5RU7AKRHPB6L' }).render(
          '#paypal-container-V5RU7AKRHPB6L',
        );
      } catch {
        // Safely ignore if containers are not active
      }
    }

    return () => {
      delete win.cambiarPantalla;
    };
  }, []);

  // Active Online Rooms Lobby Preview
  const [activeRoomsInfo, setActiveRoomsInfo] = useState<
    Array<{ roomKey: string; count: number; aliases: string[] }>
  >([]);

  // Gear Shift Command Pipe
  const [requestedGear, setRequestedGear] = useState<{
    seq: number;
    gear?: GearLabel;
    delta?: 1 | -1;
  }>({ seq: 0 });

  // Virtual Steering Wheel / Pedal Input Ref
  const virtualInputRef = useRef<VirtualRigInput>({
    steer: null,
    throttle: false,
    brake: false,
    nitro: false,
  });

  const activeMap = useMemo(() => getMapById(selectedMapId), [selectedMapId]);
  const mapOrderIndex = useMemo(
    () => Math.max(0, WORLD_MAPS_CATALOG.findIndex((m) => m.id === selectedMapId)),
    [selectedMapId],
  );
  const activeCar = useMemo(() => getCarById(p1CarId), [p1CarId]);

  const activeMapCheckpointPlans = useMemo(
    () =>
      activeMap.checkpoints.map((_, idx) =>
        getCheckpointAwardPlan(
          activeMap.id,
          mapOrderIndex,
          idx,
          activeMap.checkpoints.length,
        ),
      ),
    [activeMap, mapOrderIndex],
  );

  const [telemetry, setTelemetry] = useState<PlayerHudTelemetry>(() => ({
    speedKmh: 0,
    rpm: activeCar.idleRpm,
    redlineRpm: activeCar.redlineRpm,
    gear: '1',
    transmission: 'MT',
    steerDegrees: 0,
    throttle: 0,
    brake: 0,
    streetName: activeMap.roads[0]?.name || activeMap.name,
    lat: activeMap.centerLat,
    lon: activeMap.centerLon,
    x: activeMap.spawn.x,
    z: activeMap.spawn.z,
    heading: activeMap.spawn.heading,
    checkpointsCollected: 0,
    totalCheckpoints: activeMap.checkpoints.length,
    lapTimeSec: 0,
    nitroPct: 100,
  }));
  const [activeCheckpoint, setActiveCheckpoint] = useState<RoadNode2D | null>(
    activeMap.checkpoints[0] || null,
  );
  const [p2MinimapPos, setP2MinimapPos] = useState<{
    x: number;
    z: number;
    heading: number;
  } | null>(null);

  // WebSocket Real-Time Multiplayer Hook (Anonymous Usernames Only)
  const { remotePlayersRef, peerList, connected, sendPositionUpdate } = useMultiplayerRoom({
    enabled: gameState === 'PLAYING',
    sessionMode,
    playerId,
    alias: sanitizeGamerUsername(p1Alias).trim() || 'Piloto1',
    carId: p1CarId,
    paintHex: p1Paint,
    mapId: selectedMapId,
    roomCode: roomCode.trim().toUpperCase() || 'PISTA1',
    transmission,
    spawn: activeMap.spawn,
  });

  // Fetch active multiplayer rooms when in Title Menu
  useEffect(() => {
    if (gameState !== 'TITLE_MENU') return;
    let active = true;
    const loadRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          rooms?: Array<{ roomKey: string; count: number; aliases: string[] }>;
        };
        if (active && data.ok && Array.isArray(data.rooms)) {
          setActiveRoomsInfo(data.rooms);
        }
      } catch {
        // Ignore offline fetch cleanly
      }
    };
    void loadRooms();
    const timer = window.setInterval(loadRooms, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gameState]);

  // Keyboard shortcut 'H' for Collapsible HUD & 'C' for Camera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH' && gameState === 'PLAYING') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyC' && gameState === 'PLAYING') {
        setCameraMode((prev) =>
          prev === 'CHASE' ? 'COCKPIT' : prev === 'COCKPIT' ? 'AERIAL' : 'CHASE',
        );
      } else if (e.code === 'Escape' && gameState === 'PLAYING') {
        setGameState('TITLE_MENU');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  const handleSelectCar = (carId: CarModelId) => {
    const spec = getCarById(carId);
    setP1CarId(carId);
    setP1Paint(spec.defaultPaint);
  };

  const handleStartSimulation = () => {
    soundEngine.init();
    setDescentTrigger((n) => n + 1);
    setGameState('PLAYING');
  };

  const handleVirtualInput = useCallback(
    (patch: { steer?: number | null; throttle?: boolean; brake?: boolean; nitro?: boolean }) => {
      soundEngine.init();
      if (patch.steer !== undefined) virtualInputRef.current.steer = patch.steer;
      if (patch.throttle !== undefined) virtualInputRef.current.throttle = patch.throttle;
      if (patch.brake !== undefined) virtualInputRef.current.brake = patch.brake;
      if (patch.nitro !== undefined) virtualInputRef.current.nitro = patch.nitro;
    },
    [],
  );

  const handleTelemetry = useCallback(
    (
      hud: PlayerHudTelemetry,
      cp: RoadNode2D | null,
      p2Pos: { x: number; z: number; heading: number } | null,
    ) => {
      setTelemetry(hud);
      setActiveCheckpoint(cp);
      setP2MinimapPos(p2Pos);
    },
    [],
  );

  const stageAwardTimerRef = useRef<number | null>(null);
  const handleAwardDelivered = useCallback((award: AwardDeliveryRecord) => {
    setAwardsWon((prev) => [award, ...prev.slice(0, 49)]);
    if (award.isGrandFinale) {
      if (stageAwardTimerRef.current) {
        window.clearTimeout(stageAwardTimerRef.current);
      }
      setRecentStageAward(null);
      setGrandFinaleModalAward(award);
    } else {
      setRecentStageAward(award);
      if (stageAwardTimerRef.current) {
        window.clearTimeout(stageAwardTimerRef.current);
      }
      stageAwardTimerRef.current = window.setTimeout(() => {
        setRecentStageAward(null);
      }, 5500);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (stageAwardTimerRef.current) {
        window.clearTimeout(stageAwardTimerRef.current);
      }
    };
  }, []);

  const handleAdvanceToNextScreen = useCallback(() => {
    const nextIdx = (mapOrderIndex + 1) % WORLD_MAPS_CATALOG.length;
    const nextMap = WORLD_MAPS_CATALOG[nextIdx];
    setGrandFinaleModalAward(null);
    setRecentStageAward(null);
    setSelectedMapId(nextMap.id);
    setResetTrigger((n) => n + 1);
    setDescentTrigger((n) => n + 1);
  }, [mapOrderIndex]);

  const filteredMaps = useMemo(
    () => WORLD_MAPS_CATALOG.filter((m) => m.group === regionFilter),
    [regionFilter],
  );

  const safeP1Display = sanitizeGamerUsername(p1Alias).trim() || 'Piloto1';
  const safeP2Display = sanitizeGamerUsername(p2Alias).trim() || 'Piloto2';

  // =========================================================================
  // IN-GAME 3D DRIVING VIEWPORT (100% STYLIZED SAFE 3D WORLD)
  // =========================================================================
  if (gameState === 'PLAYING') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#090d16] select-none flex flex-col">
        <div className="relative flex-1 w-full overflow-hidden">
          <ThreeDrivingSimulator
            map={activeMap}
            mapOrderIndex={mapOrderIndex}
            extraRoads={[]}
            realMapOverlayMode={false}
            gameState={gameState}
            sessionMode={sessionMode}
            cameraMode={cameraMode}
            timeOfDay={timeOfDay}
            soundMuted={soundMuted}
            p1Alias={safeP1Display}
            p1CarId={p1CarId}
            p1Paint={p1Paint}
            p1Transmission={transmission}
            requestedGear={requestedGear}
            virtualInputRef={virtualInputRef}
            p2Alias={safeP2Display}
            p2CarId={p2CarId}
            p2Paint={p2Paint}
            remotePlayersRef={remotePlayersRef}
            onLocalNetworkTick={sendPositionUpdate}
            onTelemetry={handleTelemetry}
            onAwardDelivered={handleAwardDelivered}
            onRoundComplete={() => {}}
            resetTrigger={resetTrigger}
            descentTrigger={descentTrigger}
          />

          {/* Top Circuit HUD Bar (Stylized 3D Track Name, Safe Username & Checkpoint Progress) */}
          <div className="pointer-events-none fixed top-3 inset-x-4 z-20 flex items-start justify-between gap-4">
            <div className="pointer-events-auto bg-[#0b101b]/95 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg max-w-xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-amber-400">{activeMap.name}</span>
                <span aria-hidden="true">·</span>
                <span>{activeMap.country}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">Circuito 3D Seguro</span>
              </div>
              <div className="text-base md:text-lg font-display font-bold text-slate-50 truncate mt-0.5">
                {telemetry.streetName}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>Usuario: <strong className="text-slate-100">{safeP1Display}</strong></span>
                <span aria-hidden="true">·</span>
                <span>{activeCar.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-300">
                  Metas: {telemetry.checkpointsCollected}
                </span>
                {sessionMode === 'ONLINE_MULTI' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-400">
                      Sala {roomCode.toUpperCase()} ({peerList.length + 1} en línea
                      {connected ? '' : ' · conectando'})
                    </span>
                  </>
                )}
              </div>

              {telemetry.currentAwardTitle && (
                <div className="mt-1 pt-1 border-t border-slate-800/70 text-xs text-amber-300 flex flex-wrap items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Próximo premio en meta:</span>
                  <strong className="text-white">{telemetry.currentAwardTitle}</strong>
                </div>
              )}

              {sessionMode === 'ONLINE_MULTI' && peerList.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-slate-400">Usuarios en pista:</span>
                  {peerList.slice(0, 5).map((peer, idx) => (
                    <React.Fragment key={peer.playerId}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span className="font-medium text-slate-100">
                        {peer.alias} ({Math.round(peer.speedKmh)} km/h)
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Player 2 Telemetry + Stylized Circuit Minimap */}
            <div className="pointer-events-auto flex flex-col items-end gap-2.5">
              <div className="flex items-start gap-2.5">
                {sessionMode === 'SPLIT_2P' && (
                  <div className="bg-[#0b101b]/95 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg text-right">
                    <div className="text-xs text-sky-400 font-semibold">
                      {safeP2Display} · Flechas
                    </div>
                    <div className="text-sm font-display font-semibold text-slate-100 truncate max-w-[190px]">
                      {telemetry.p2StreetName || activeMap.name}
                    </div>
                    <div className="font-mono tabular-nums text-sm font-bold text-slate-200 mt-0.5">
                      {Math.round(telemetry.p2SpeedKmh || 0)} km/h · D{telemetry.p2Gear || '1'}
                    </div>
                  </div>
                )}

                {!dockCollapsed && (
                  <div className="hidden xl:block">
                    <MinimapCanvas
                      map={activeMap}
                      extraRoads={[]}
                      playerX={telemetry.x}
                      playerZ={telemetry.z}
                      playerHeading={telemetry.heading}
                      p2Pos={p2MinimapPos}
                      remotePlayers={peerList}
                      activeCheckpoint={activeCheckpoint}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intermediate Checkpoint Toast: Sporting Medal & Trophy */}
          {recentStageAward && !grandFinaleModalAward && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-30 w-[min(450px,92vw)] bg-[#0b101b]/95 border border-amber-500/80 rounded-xl p-3.5 shadow-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-lg border border-amber-400/60 bg-amber-950/50 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6 text-amber-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-amber-400 font-semibold">
                  Meta {recentStageAward.checkpointNumber}/{recentStageAward.totalCheckpoints} ·{' '}
                  {recentStageAward.mapName}
                </div>
                <div className="font-display text-base font-bold text-white truncate">
                  ¡Premio ganado para {safeP1Display}!
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {recentStageAward.awardTitle}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRecentStageAward(null)}
                aria-label="Cerrar aviso de premio"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* GRAND FINALE CEREMONY OVERLAY: Gran Trofeo Súper Oro con Diamantes */}
          {grandFinaleModalAward && (
            <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
              <div className="w-[min(560px,95vw)] bg-[#0d1424] border border-amber-400 rounded-2xl overflow-hidden shadow-2xl">
                <div className="relative h-56 w-full bg-slate-950 overflow-hidden border-b border-amber-500/40">
                  {!brokenImages.grand_trophy_modal ? (
                    <img
                      src={REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl}
                      alt="Gran Trofeo Súper Oro con Diamantes"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, grand_trophy_modal: true }))
                      }
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 flex items-center justify-center">
                      <Trophy className="w-16 h-16 text-amber-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1424] via-black/35 to-transparent" />
                  <div className="absolute bottom-3 inset-x-5">
                    <div className="text-xs font-semibold text-amber-300">
                      Meta Final Completada · {grandFinaleModalAward.mapName}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      {GRAND_FINALE_AWARD_TITLE}
                    </h2>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-200 leading-relaxed">
                    ¡Excelente carrera, <strong className="text-amber-300">{safeP1Display}</strong>!
                    Completaste todas las metas de{' '}
                    <strong className="text-white">{grandFinaleModalAward.mapName}</strong> y
                    ganaste el <strong>{GRAND_FINALE_AWARD_TITLE}</strong>.
                  </p>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between gap-2">
                    <span>Trofeos y medallas en tu vitrina:</span>
                    <span className="font-mono tabular-nums font-bold text-amber-400 text-sm">
                      {awardsWon.length} premios
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setGrandFinaleModalAward(null)}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-100 whitespace-nowrap"
                    >
                      Seguir Manejando Aquí
                    </button>
                    <button
                      type="button"
                      onClick={handleAdvanceToNextScreen}
                      className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-semibold whitespace-nowrap"
                    >
                      Siguiente Circuito 3D →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scenic Illustration Card inside Simulator */}
          {showHudPhotos && (
            <div className="fixed left-4 top-32 z-30 w-[min(420px,92vw)] shadow-2xl">
              <PlacePhotosGallery
                mapSpec={activeMap}
                compact
                onClose={() => setShowHudPhotos(false)}
              />
            </div>
          )}

          {/* Trophy Cabinet Floating Drawer inside Simulator */}
          {showHudAwards && (
            <div className="fixed left-4 top-32 z-30 w-[min(420px,92vw)] bg-[#0b101b] border border-slate-800 rounded-xl p-4 shadow-2xl space-y-3 max-h-[64vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display text-sm font-bold text-white">
                    Metas del Circuito y Vitrina ({awardsWon.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHudAwards(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-400 font-medium">Premios de esta pista:</div>
                {activeMapCheckpointPlans.map((pl) => (
                  <div
                    key={`hud_plan_${pl.checkpointNumber}`}
                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                      pl.isGrandFinale
                        ? 'bg-amber-950/30 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900/90 border-slate-800 text-slate-200'
                    }`}
                  >
                    <span className="truncate">
                      <strong>Meta {pl.checkpointNumber}:</strong> {pl.awardTitle}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {pl.isGrandFinale ? 'Gran Final' : 'Intermedia'}
                    </span>
                  </div>
                ))}
              </div>

              {awardsWon.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
                  <div className="text-slate-400 font-medium">Últimos trofeos ganados:</div>
                  {awardsWon.slice(0, 6).map((aw) => (
                    <div
                      key={aw.id}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-semibold text-amber-300">
                        {aw.awardTitle}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0 truncate max-w-[140px]">
                        {aw.mapName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Interactive Simulator Steering Wheel + Pedals + Mechanical/Automatic Gearbox */}
          {!dockCollapsed && (
            <SimulatorControlsRig
              telemetry={telemetry}
              transmission={transmission}
              onChangeTransmission={(mode) => setTransmission(mode)}
              onSelectGear={(gear) =>
                setRequestedGear((prev) => ({ seq: prev.seq + 1, gear }))
              }
              onShiftStep={(delta) =>
                setRequestedGear((prev) => ({ seq: prev.seq + 1, delta }))
              }
              onVirtualInput={handleVirtualInput}
            />
          )}

          {/* Unified Collapsible Bottom Control Dock */}
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-3 z-30 w-[min(1040px,96vw)] transition-transform duration-200"
            style={{
              transform: dockCollapsed
                ? 'translate(-50%, calc(100% - 34px))'
                : 'translate(-50%, 0)',
            }}
          >
            <div className="flex justify-center mb-1">
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="px-3.5 py-1 rounded-t-lg bg-[#0b101b] border border-b-0 border-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap"
              >
                {dockCollapsed ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>
                  {dockCollapsed ? '▴ Mostrar Controles (H)' : '▾ Ocultar Controles (H)'}
                </span>
              </button>
            </div>

            <div className="bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2">
              {/* Quick Circuit Switcher */}
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="hud-map-select"
                  className="text-xs text-slate-400 whitespace-nowrap"
                >
                  Circuito 3D:
                </label>
                <select
                  id="hud-map-select"
                  value={selectedMapId}
                  onChange={(e) => setSelectedMapId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1.5 max-w-[210px] truncate focus:outline-none focus:border-amber-500"
                >
                  {WORLD_MAPS_CATALOG.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.country} — {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Vehicle Switcher */}
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="hud-car-select"
                  className="text-xs text-slate-400 whitespace-nowrap"
                >
                  Vehículo:
                </label>
                <select
                  id="hud-car-select"
                  value={p1CarId}
                  onChange={(e) => handleSelectCar(e.target.value as CarModelId)}
                  className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2 py-1.5 max-w-[180px] truncate focus:outline-none focus:border-amber-500"
                >
                  {CARS_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Angle Buttons (Cockpit w/ 3D Wheel, Chase, Aerial) */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'COCKPIT', label: 'Cabina' },
                    { id: 'CHASE', label: '3ª Persona' },
                    { id: 'AERIAL', label: 'Aérea' },
                  ] as Array<{ id: CameraMode; label: string }>
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraMode(cam.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      cameraMode === cam.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Time of Day */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'DAY', label: 'Día' },
                    { id: 'GOLDEN', label: 'Tarde' },
                    { id: 'NIGHT', label: 'Noche' },
                  ] as Array<{ id: TimeOfDay; label: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTimeOfDay(t.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      timeOfDay === t.id
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowHudPhotos((v) => !v);
                    setShowHudAwards(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    showHudPhotos
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Ilustración</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHudAwards((v) => !v);
                    setShowHudPhotos(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    showHudAwards
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono tabular-nums">Trofeos ({awardsWon.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResetTrigger((n) => n + 1)}
                  title="Reposicionar vehículo en la salida"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSoundMuted((m) => !m)}
                  title={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                >
                  {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setGameState('TITLE_MENU')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Menú Principal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TITLE MENU — SAFE 3D CAR GAME FOR KIDS & FAMILIES
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 md:px-10 py-4 border-b border-slate-800/90 bg-[#090d16]">
        <a
          href="#inicio"
          className="font-display text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
        >
          Juego de 3D de Carros
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#circuitos"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Circuitos 3D
          </a>
          <a
            href="#garaje"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Carros, Pickup, Tuk Tuk, Camión y Bici
          </a>
          <a
            href="#premios"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Trofeos de Meta
          </a>
          <a
            href="#usuarios"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Multijugador Seguro
          </a>
          <a
            href="#livsform-lykke"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            LivsForm Lykke
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleStartSimulation}
            className="px-4 py-2 text-xs md:text-sm font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Jugar Ahora
          </button>
        </div>
      </header>

      <main id="inicio" className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-10 space-y-16">
        {/* HERO SPLIT: 2-Column Layout with Safe Username Setup & Illustrated 3D Preview */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Circuitos Recreativos 3D</span>
                <span aria-hidden="true">·</span>
                <span>Carros, Pickups, Tuk Tuks, Camiones y Bicicletas</span>
              </div>

              <h1
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-50 leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Juego de 3D de Carros
              </h1>

              <p className="text-slate-300 text-base leading-relaxed max-w-xl">
                Maneja libremente o compite por trofeos en pistas escénicas 3D inspiradas en
                Guatemala y el mundo, acompañadas de tránsito variado, pajaritos cantando en el
                cielo y gente caminando por los paseos, sin exponer calles reales ni datos
                personales.
              </p>
            </div>

            {/* Safe User Handle & Game Mode Box */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="hero-alias-input"
                    className="block text-xs font-medium text-slate-200 mb-1"
                  >
                    Escribe tu Usuario (Apodo de Piloto)
                  </label>
                  <input
                    id="hero-alias-input"
                    type="text"
                    maxLength={18}
                    value={p1Alias}
                    onChange={(e) => setP1Alias(sanitizeGamerUsername(e.target.value))}
                    placeholder="Ej. RayoVeloz7"
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="hero-mode-select"
                    className="block text-xs font-medium text-slate-200 mb-1"
                  >
                    Modo de Juego
                  </label>
                  <select
                    id="hero-mode-select"
                    value={sessionMode}
                    onChange={(e) => setSessionMode(e.target.value as SessionMode)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="SOLO">1 Jugador (Carrera y Paseo 3D)</option>
                    <option value="SPLIT_2P">2 Jugadores Local (Pantalla Dividida)</option>
                    <option value="ONLINE_MULTI">Multijugador en Sala (Solo por Usuario)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-emerald-950/30 border border-emerald-800/50 px-3 py-2 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Juego seguro: usa únicamente un apodo inventado de piloto. Nunca escribas nombres
                  completos, teléfonos ni direcciones reales.
                </span>
              </div>

              {sessionMode === 'ONLINE_MULTI' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="room-code-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Código de Sala
                    </label>
                    <input
                      id="room-code-input"
                      type="text"
                      maxLength={14}
                      value={roomCode}
                      onChange={(e) =>
                        setRoomCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
                      }
                      placeholder="PISTA1"
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-amber-400 uppercase focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col justify-end text-xs text-slate-400">
                    <span>
                      Comparte el código de sala para competir en el mismo circuito 3D usando tu
                      usuario de piloto.
                    </span>
                  </div>
                </div>
              )}

              {sessionMode === 'SPLIT_2P' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="p2-alias-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Usuario Jugador 2 (Flechas)
                    </label>
                    <input
                      id="p2-alias-input"
                      type="text"
                      maxLength={18}
                      value={p2Alias}
                      onChange={(e) => setP2Alias(sanitizeGamerUsername(e.target.value))}
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="p2-car-select"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Vehículo Jugador 2
                    </label>
                    <select
                      id="p2-car-select"
                      value={p2CarId}
                      onChange={(e) => {
                        const cid = e.target.value as CarModelId;
                        setP2CarId(cid);
                        setP2Paint(getCarById(cid).defaultPaint);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      {CARS_CATALOG.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  <span>Circuito: </span>
                  <strong className="text-slate-100">{activeMap.name}</strong>
                  <span aria-hidden="true"> · </span>
                  <strong className="text-amber-400">{activeCar.name}</strong>
                </div>

                <button
                  type="button"
                  onClick={handleStartSimulation}
                  className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  Entrar a la Pista 3D
                </button>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Showcase: Stylized Circuit Illustration */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[340px] flex flex-col justify-end">
            {!brokenImages[`hero_${activeMap.id}`] ? (
              <img
                src={activeMap.adaptedPhotoUrl}
                alt={activeMap.adaptedPhotoCaption}
                referrerPolicy="no-referrer"
                onError={() =>
                  setBrokenImages((p) => ({ ...p, [`hero_${activeMap.id}`]: true }))
                }
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex items-center justify-center">
                <Compass className="w-16 h-16 text-amber-400/60" />
              </div>
            )}
            <div className="relative z-10 p-6 bg-gradient-to-t from-black/95 via-black/55 to-transparent space-y-1.5">
              <div className="text-xs text-amber-300 font-medium">{activeMap.regionLabel}</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {activeMap.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 max-w-lg">
                {activeMap.adaptedPhotoCaption}
              </p>
              <div className="pt-1 text-xs text-slate-300">
                Tramos 3D: {activeMap.roads.slice(0, 4).map((r) => r.name).join(' · ')}
              </div>
            </div>
          </div>
        </section>

        {/* Clean Spec Strip Below Hero */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-slate-800/80">
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
              {CARS_CATALOG.length} Vehículos 3D
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Bicicletas, Tuk Tuks, Pickups 4x4, Camiones de carga y Carros deportivos
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
              {WORLD_MAPS_CATALOG.length} Circuitos 3D
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Escenarios recreativos estilizados sin mostrar avenidas ni direcciones reales
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
              Pajaritos y Peatones
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Cielo con nubes blancas, pajaritos volando y gente caminando por las aceras 3D
            </div>
          </div>
          <div>
            <div className="font-mono tabular-nums text-2xl font-bold text-slate-50">
              100% Seguro
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Solo ingresas tu apodo de usuario ficticio sin nombres personales expuestos
            </div>
          </div>
        </section>

        {/* SECTION 1: STYLIZED 3D CIRCUITS */}
        <section id="circuitos" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                01. Circuitos Escénicos 3D y Pistas de Carrera
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Todos los escenarios están construidos como pistas recreativas 3D estilizadas para
                jugar con total tranquilidad.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              {REGION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRegionFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    regionFilter === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMaps.map((m) => {
              const isSelected = m.id === selectedMapId;
              const cardImgKey = `card_${m.id}`;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMapId(m.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMapId(m.id);
                    }
                  }}
                  className={`cursor-pointer text-left rounded-xl overflow-hidden border transition-colors flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#131d31] border-amber-500'
                      : 'bg-[#0f1624] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="relative h-40 w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
                      {!brokenImages[cardImgKey] ? (
                        <img
                          src={m.adaptedPhotoUrl}
                          alt={m.adaptedPhotoCaption}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [cardImgKey]: true }))
                          }
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                          <MapIcon className="w-8 h-8 text-amber-400/60" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-3.5 py-2 bg-gradient-to-t from-black/90 via-black/45 to-transparent text-[11px] text-slate-200 truncate">
                        {m.adaptedPhotoCaption}
                      </div>
                    </div>

                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{m.country}</span>
                        <span aria-hidden="true">·</span>
                        <span>{m.checkpoints.length} metas con trofeo</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-50">{m.name}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 truncate">{m.roads[0]?.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMapId(m.id);
                        handleStartSimulation();
                      }}
                      className="font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap shrink-0"
                    >
                      {isSelected ? 'Conducir Aquí →' : 'Elegir Pista →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: VEHICLE GARAGE — BICICLETAS, TUK TUK, PICKUP, CAMIONES Y CARROS */}
        <section id="garaje" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                02. Garaje 3D: Bicicletas, Tuk Tuk, Pickup 4x4, Camiones y Carros
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Elige tu vehículo favorito y personaliza su pintura 3D y caja de velocidades.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTransmission('MT')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  transmission === 'MT'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Caja Mecánica (1–6 + R)
              </button>
              <button
                type="button"
                onClick={() => setTransmission('AT')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  transmission === 'AT'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Caja Automática (D / N / R)
              </button>
            </div>
          </div>

          {/* Interactive 360° 3D Vehicle Showroom + Live Specs & Paint Customizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 min-h-[290px]">
              <VehiclePreview3D carId={p1CarId} paintHex={p1Paint} />
            </div>

            <div className="lg:col-span-5 bg-[#0f1624] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{activeCar.brand}</span>
                  <span className="font-mono tabular-nums">
                    {activeCar.drivetrain} · {activeCar.yearTag}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold text-white">{activeCar.name}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {activeCar.summary}
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <div className="text-slate-400">Potencia</div>
                    <div className="font-mono tabular-nums font-bold text-slate-100">
                      {activeCar.horsepower} HP
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Vel. Máx</div>
                    <div className="font-mono tabular-nums font-bold text-amber-400">
                      {activeCar.topSpeedKmh} km/h
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Corte Motor</div>
                    <div className="font-mono tabular-nums font-bold text-slate-100">
                      {activeCar.redlineRpm} RPM
                    </div>
                  </div>
                </div>
              </div>

              {/* Paint Swatches */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>Color de carrocería en 3D:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PAINT_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() => setP1Paint(sw.hex)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        p1Paint === sw.hex
                          ? 'border-amber-400 bg-slate-800 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: sw.hex }}
                      />
                      <span>{sw.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartSimulation}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap"
              >
                Conducir {activeCar.name}
              </button>
            </div>
          </div>

          {/* Category Filter for Vehicles */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              {(
                [
                  { id: 'ALL', label: `Todos los Vehículos (${CARS_CATALOG.length})` },
                  { id: 'URBAN_SPECIAL', label: 'Bicicleta, Tuk Tuk, Pickup y Camión (4)' },
                  { id: 'CARS', label: 'Carros y Deportivos (8)' },
                ] as const
              ).map((vf) => (
                <button
                  key={vf.id}
                  type="button"
                  onClick={() => setVehicleFilter(vf.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    vehicleFilter === vf.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400">
              Todos estos vehículos también circulan en el tránsito 3D junto a pajaritos y gente
              caminando
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CARS_CATALOG.filter((car) => {
              const isSpecial =
                car.id === 'tuk_tuk' ||
                car.id === 'bicicleta' ||
                car.id === 'pickup' ||
                car.id === 'camion';
              if (vehicleFilter === 'URBAN_SPECIAL') return isSpecial;
              if (vehicleFilter === 'CARS') return !isSpecial;
              return true;
            }).map((car) => {
              const selected = car.id === p1CarId;
              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => handleSelectCar(car.id)}
                  className={`text-left p-5 rounded-xl border transition-colors flex flex-col justify-between gap-4 ${
                    selected
                      ? 'bg-[#131d31] border-amber-500'
                      : 'bg-[#0f1624] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{car.brand}</span>
                      <span className="font-mono tabular-nums">{car.drivetrain}</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-50">{car.name}</h3>
                    <div className="text-xs text-amber-400">{car.yearTag}</div>
                    <p className="text-xs text-slate-300 leading-relaxed pt-1">{car.summary}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
                    <span>{car.horsepower} HP</span>
                    <span>·</span>
                    <span>Máx {car.topSpeedKmh} km/h</span>
                    <span>·</span>
                    <span>{car.redlineRpm} RPM</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: TROPHIES & MEDALS PROGRESSION (NO PERSONAL NAMES) */}
        <section id="premios" className="space-y-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
              03. Medallas de Ruta y Gran Trofeo Súper Oro con Diamantes
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Cruza los arcos iluminados de cada circuito para coleccionar medallas deportivas y el
              Gran Trofeo Súper Oro con Diamantes usando tu usuario de piloto.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-5 bg-[#0f1624] border border-amber-500/60 rounded-xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="relative h-52 w-full bg-slate-950 overflow-hidden border-b border-slate-800">
                  {!brokenImages.grand_trophy_showcase ? (
                    <img
                      src={REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl}
                      alt="Gran Trofeo Súper Oro con Diamantes"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, grand_trophy_showcase: true }))
                      }
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-950 to-slate-900 flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-amber-400" />
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-xs font-semibold text-amber-400">
                    Premio Mayor de Cada Circuito
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    {GRAND_FINALE_AWARD_TITLE}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Al cruzar la meta final, el <strong className="text-white">{GRAND_FINALE_PRESENTER}</strong>{' '}
                    entrega el trofeo mayor con diamantes facetados en 3D directamente a tu usuario{' '}
                    <strong className="text-amber-300">{safeP1Display}</strong>.
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Disponible en los {WORLD_MAPS_CATALOG.length} circuitos 3D</span>
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  className="font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap"
                >
                  Competir por el Trofeo →
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-[#0f1624] border border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-amber-400">
                    Etapas Deportivas en {activeMap.name}
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mt-0.5">
                    Orden de Metas y Trofeos de la Pista Seleccionada
                  </h3>
                </div>

                <div className="space-y-2">
                  {activeMapCheckpointPlans.map((pl) => (
                    <div
                      key={`stage_card_${pl.checkpointNumber}`}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                        pl.isGrandFinale
                          ? 'bg-amber-950/25 border-amber-500/60 text-amber-100'
                          : 'bg-slate-950 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Trophy
                          className={`w-4 h-4 shrink-0 ${
                            pl.isGrandFinale ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        />
                        <div className="truncate">
                          <span className="font-semibold">Meta {pl.checkpointNumber}:</span>{' '}
                          <span>{pl.awardTitle}</span>
                        </div>
                      </div>
                      <span className="text-slate-400 shrink-0">{pl.presenterName}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Piloto activo: <strong className="text-slate-200">{safeP1Display}</strong></span>
                <span className="font-mono tabular-nums text-amber-400">
                  Trofeos acumulados en esta sesión: {awardsWon.length}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: MULTIPLAYER BY USERNAME & CONTROLS */}
        <section id="usuarios" className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
          <div className="lg:col-span-6 bg-[#0f1624] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <Users className="w-4 h-4" />
              <span>Juego por Usuario / Apodo Ficticio</span>
            </div>
            <h3 className="font-display text-xl font-bold text-slate-50">
              04. Salas de Carrera por Apodo de Usuario
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Escribe tu usuario inventado arriba para jugar solo, a pantalla dividida de 2
              jugadores en el mismo teclado, o en sala multijugador compartiendo el código de pista.
            </p>

            {activeRoomsInfo.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium text-slate-400">Salas activas ahora:</div>
                {activeRoomsInfo.map((rm) => {
                  const [rCode, rMap] = rm.roomKey.split('::');
                  const mapObj = getMapById(rMap);
                  return (
                    <div
                      key={rm.roomKey}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-amber-400">{rCode}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-slate-200">{mapObj.name}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-slate-400">{rm.aliases.join(', ')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionMode('ONLINE_MULTI');
                          setRoomCode(rCode);
                          setSelectedMapId(mapObj.id);
                          handleStartSimulation();
                        }}
                        className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-semibold whitespace-nowrap shrink-0"
                      >
                        Unirse ({rm.count})
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                No hay otras salas abiertas en este instante. Al iniciar en modo Multijugador se
                creará la sala <strong className="text-slate-200">{roomCode}</strong> con tu
                usuario <strong className="text-amber-300">{safeP1Display}</strong>.
              </div>
            )}
          </div>

          <div
            id="controles"
            className="lg:col-span-6 bg-[#0f1624] border border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <Gauge className="w-4 h-4" />
              <span>Mandos del Juego de Carros</span>
            </div>
            <h3 className="font-display text-xl font-bold text-slate-50">
              Timón, Pedales, Cambios y Cámaras 3D
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-100">Dirección y Aceleración</div>
                <div>Timón interactivo en pantalla o teclas W, A, S, D / Flechas</div>
                <div>Nitro deportivo: Shift Izquierdo o Espacio</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-100">Caja Mecánica y Automática</div>
                <div>Subir / Bajar cambio: Teclas E / Q o clic en ranuras R, N, 1–6</div>
                <div>Teclas directas 1 a 6, R (Reversa) y N (Neutro)</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-100">Vistas de Cámara (Tecla C)</div>
                <div>Alterna entre Cabina con Timón 3D, 3ª Persona y Vista Aérea</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-100">Ambiente 3D Vivo</div>
                <div>Tránsito de bicicletas, tuk tuks, pickups, camiones, pajaritos y peatones</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: SERVICIO DE LIVSFORM LYKKE, DESARROLLADORES KAAMT EALMT Y APORTACIÓN VOLUNTARIA */}
        <section
          id="livsform-lykke"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-900 items-stretch"
        >
          {/* Servicio de LivsForm Lykke & Sección Desarrolladores */}
          <div className="lg:col-span-7 bg-[#0f1624] border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 justify-between">
            <div className="bg-white rounded-xl p-3 shrink-0 shadow-md">
              <img
                src="/assets/aistudio/IMG_20261022_112510_49dbacbd.jpg"
                alt="LivsForm Lykke"
                className="w-44 sm:w-48 h-auto object-contain rounded-lg"
              />
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-400">
                  <span>Un servicio de LivsForm Lykke</span>
                  <span aria-hidden="true">·</span>
                  <span>Entorno Recreativo Seguro</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-50">
                  LivsForm Lykke
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Un servicio de <strong className="text-slate-100">LivsForm Lykke</strong> dedicado
                  a ofrecer experiencias interactivas 3D sanas, creativas y seguras para toda la
                  comunidad.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 space-y-1">
                <div className="text-xs font-medium text-slate-400">
                  Sección Desarrolladores
                </div>
                <div className="font-display text-lg font-bold text-amber-400 tracking-wide">
                  KAAMT EALMT
                </div>
              </div>
            </div>
          </div>

          {/* Pasarela Integrada en la App (Sin abrir pestañas externas _blank) */}
          <div className="lg:col-span-5 flex flex-col justify-between items-center gap-3">
            {/* Selector directo dentro de la misma App */}
            <div className="flex items-center justify-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-full">
              <button
                type="button"
                onClick={() => setActivePasarelaScreen('donacion')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activePasarelaScreen === 'donacion'
                    ? 'bg-[#3b82f6] text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Aportación
              </button>
              <button
                type="button"
                onClick={() => setActivePasarelaScreen('consultoria')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activePasarelaScreen === 'consultoria'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Consultoría
              </button>
              <button
                type="button"
                onClick={() => setActivePasarelaScreen('diploma')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activePasarelaScreen === 'diploma'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Diplomas
              </button>
            </div>

            <div
              id="seccion-consultoria"
              className={`${
                activePasarelaScreen === 'consultoria' ? 'block' : 'hidden'
              } bg-[#162e2a] border border-emerald-500/40 rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(0,0,0,0.4)]`}
            >
              <h2 className="font-display text-[1.4rem] font-bold text-[#4ade80] mb-2.5">
                Consultoría LivsForm Lykke
              </h2>
              <p className="text-[#9ca3af] text-sm leading-relaxed mb-4">
                Acceso directo desde la aplicación al módulo de consultoría especializada.
              </p>
              <div id="paypal-container-PXJM3VAXNCLQA" className="w-full mt-2 min-h-[24px]" />
              <a
                href="https://www.paypal.com/ncp/payment/PXJM3VAXNCLQA"
                target="_top"
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Abrir Consultoría en la App
              </a>
            </div>

            <div
              id="seccion-diplomas"
              className={`${
                activePasarelaScreen === 'diploma' ? 'block' : 'hidden'
              } bg-[#162e2a] border border-emerald-500/40 rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(0,0,0,0.4)]`}
            >
              <h2 className="font-display text-[1.4rem] font-bold text-[#4ade80] mb-2.5">
                Diplomas y Certificación
              </h2>
              <p className="text-[#9ca3af] text-sm leading-relaxed mb-4">
                Acceso directo desde la aplicación a diplomas y certificaciones de la plataforma.
              </p>
              <div id="paypal-container-V5RU7AKRHPB6L" className="w-full mt-2 min-h-[24px]" />
              <a
                href="https://www.paypal.com/ncp/payment/V5RU7AKRHPB6L"
                target="_top"
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Abrir Diplomas en la App
              </a>
            </div>

            <div
              id="seccion-donaciones"
              className={`${
                activePasarelaScreen === 'donacion' ? 'block' : 'hidden'
              } bg-[#1b2430] border border-[#3b82f6] rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(0,0,0,0.4)]`}
            >
              <h2 className="font-display text-[1.4rem] font-bold text-[#60a5fa] mb-2.5">
                Aportación Voluntaria Libre ❤️
              </h2>
              <p className="text-[#9ca3af] text-[0.95rem] leading-relaxed mb-5">
                Tu apoyo económico voluntario está destinado exclusivamente al soporte técnico,
                mantenimiento de servidores y el financiamiento para el desarrollo de futuras
                herramientas gratuitas dentro de esta plataforma. ¡Gracias por ayudarnos a mantener
                este entorno seguro!
              </p>
              <form
                className="mt-4 flex flex-col items-center gap-3"
                action="https://www.paypal.com/donate"
                method="post"
                target="_top"
              >
                <input type="hidden" name="hosted_button_id" value="4E83JUKUBJHGW" />
                <button
                  type="submit"
                  name="submit"
                  title="PayPal - Soporta nuestro desarrollo"
                  aria-label="Botón Donar con PayPal"
                  className="px-6 py-3 rounded-xl bg-[#ffc439] hover:bg-[#f4b41a] text-[#003087] font-bold text-sm shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]"
                >
                  <span>Donar con PayPal</span>
                </button>
                <a
                  href="https://www.paypal.com/donate/?hosted_button_id=4E83JUKUBJHGW"
                  target="_top"
                  className="text-xs font-medium text-[#60a5fa] hover:underline underline-offset-4"
                >
                  Abrir vínculo directo en la app →
                </a>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 px-6 md:px-10 py-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-7xl w-full mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span>Juego de 3D de Carros</span>
          <span aria-hidden="true">·</span>
          <span>Un servicio de LivsForm Lykke</span>
          <span aria-hidden="true">·</span>
          <span>Desarrolladores KAAMT EALMT</span>
        </div>
        <button
          type="button"
          onClick={handleStartSimulation}
          className="text-amber-400 hover:underline whitespace-nowrap"
        >
          Jugar en {activeMap.name} →
        </button>
      </footer>
    </div>
  );
}
