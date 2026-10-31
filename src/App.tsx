import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Camera,
  Car,
  Compass,
  Film,
  Gauge,
  Globe,
  GripHorizontal,
  History,
  Lock,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Navigation,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sun,
  Timer,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { MinimapCanvas } from './components/MinimapCanvas';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlacePhotosGallery } from './components/PlacePhotosGallery';
import {
  CustomOnlinePlaceTrack,
  OnlineRealMapsSelector,
  RealGoogleMapDriveLayer,
} from './components/RealGoogleMapDriveLayer';
import { SimulatorControlsRig } from './components/SimulatorControlsRig';
import { ThreeDrivingSimulator, VirtualRigInput } from './components/ThreeDrivingSimulator';
import { ValuesVideoAndVoiceStudio } from './components/ValuesVideoAndVoiceStudio';
import { VehiclePreview3D } from './components/VehiclePreview3D';
import {
  getCheckpointAwardPlan,
  GRAND_FINALE_AWARD_TITLE,
  GRAND_FINALE_PRESENTER,
  REAL_PEOPLE_ASSETS,
} from './data/awardsCatalog';
import { CARS_CATALOG, getCarById, PAINT_SWATCHES } from './data/carsCatalog';
import { getMapById, WORLD_MAPS_CATALOG } from './data/worldMapsCatalog';
import {
  createEphemeralPlayerSessionId,
  scrubLocationAndSensitiveText,
} from './engine/privacyShield';
import { soundEngine } from './engine/soundEngine';
import { useMultiplayerRoom } from './hooks/useMultiplayerRoom';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  AwardDeliveryRecord,
  CameraMode,
  CarModelId,
  DriveExperienceMode,
  GameState,
  GearLabel,
  LocalPersistenceStats,
  PlayerHudTelemetry,
  RaceHistoryRecord,
  RaceParticipantSummary,
  RegionGroup,
  RoadNode2D,
  SessionMode,
  TimeOfDay,
  TransmissionType,
  WorldMapSpec,
} from './types/game';

const REGION_TABS: Array<{ id: RegionGroup; label: string }> = [
  { id: 'GUATEMALA', label: 'Circuitos de Guatemala 3D' },
  { id: 'PAISES_MUNDO', label: 'España, Brasil, Argentina y Canadá 3D' },
  { id: 'PISTAS_CIRCUITO', label: 'Pistas Cerradas de Carrera 3D' },
];

const LOCAL_PROFILE_STORAGE_KEY = 'carros3d_local_profile_v2';
const CONTROLS_PANEL_OFFSET_KEY = 'carros3d_controls_panel_offset_v1';

const COVER_ART_PANORAMIC_URL = new URL(
  './assets/images/caratula_carros_dia_1793411363992.jpg',
  import.meta.url,
).href;

const COVER_ART_BOX_URL = new URL(
  './assets/images/portada_juego_carros_1793411363803.jpg',
  import.meta.url,
).href;

type ConnectionUsageMode = 'LOCAL_OFFLINE' | 'ONLINE_GLOBAL';
type TitleSubMenuTab = 'CARATULA' | 'PISTAS' | 'GARAJE' | 'VIDEOS' | 'TROFEOS' | 'SALAS';

function normalizeConnectionMode(raw?: string): ConnectionUsageMode {
  if (
    raw === 'LOCAL_OFFLINE' ||
    raw === 'LOCAL_NO_INSTALL' ||
    raw === 'OFFLINE_INSTALL_APP'
  ) {
    return 'LOCAL_OFFLINE';
  }
  return 'ONLINE_GLOBAL';
}

interface LocalSavedProfile {
  p1Alias?: string;
  p2Alias?: string;
  sessionMode?: SessionMode;
  driveMode?: DriveExperienceMode;
  connectionUsageMode?: ConnectionUsageMode;
  roomCode?: string;
  regionFilter?: RegionGroup;
  selectedMapId?: string;
  p1CarId?: CarModelId;
  p1Paint?: string;
  p2CarId?: CarModelId;
  p2Paint?: string;
  transmission?: TransmissionType;
  cameraMode?: CameraMode;
  timeOfDay?: TimeOfDay;
  soundMuted?: boolean;
  awardsWon?: AwardDeliveryRecord[];
  raceHistory?: RaceHistoryRecord[];
  totalKilometersDriven?: number;
  unlockedCarIds?: CarModelId[];
  totalMedalsObtained?: number;
  rigCompact?: boolean;
  realMapEnabled?: boolean;
  realMapTypeId?: 'hybrid' | 'roadmap';
  customPlaceTrack?: CustomOnlinePlaceTrack | null;
}

const STARTER_UNLOCKED_CARS: CarModelId[] = [
  'cuatrimoto_el',
  'triciclo_el',
  'bicicleta',
  'tuk_tuk',
  'byd_f',
  'toyota_corolla',
];

const VEHICLE_UNLOCK_MILESTONES: Array<{
  carId: CarModelId;
  minKm: number;
  minMedals: number;
}> = [
  { carId: 'pickup', minKm: 0.5, minMedals: 1 },
  { carId: 'nissan_sentra', minKm: 1.2, minMedals: 2 },
  { carId: 'camion', minKm: 2.5, minMedals: 4 },
  { carId: 'tesla', minKm: 4.0, minMedals: 6 },
  { carId: 'toyota_supra', minKm: 6.5, minMedals: 8 },
  { carId: 'toyota_gt', minKm: 9.5, minMedals: 11 },
  { carId: 'nissan_calsonic', minKm: 13.0, minMedals: 14 },
  { carId: 'lamborghini', minKm: 18.0, minMedals: 18 },
];

function formatRaceClock(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatRaceHistoryDate(dateIso: string, fallbackTs: number): string {
  try {
    const dt = new Date(dateIso || fallbackTs);
    if (Number.isNaN(dt.getTime())) return 'Reciente';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt);
  } catch {
    return new Date(fallbackTs).toLocaleDateString();
  }
}

function loadLocalProfile(): LocalSavedProfile {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalSavedProfile;
  } catch {
    return {};
  }
}

function loadControlsOffset(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(CONTROLS_PANEL_OFFSET_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return {
        x: Math.max(-800, Math.min(800, parsed.x)),
        y: Math.max(-100, Math.min(700, parsed.y)),
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { x: 0, y: 0 };
}

function sanitizeGamerUsername(raw: string): string {
  return scrubLocationAndSensitiveText(raw, 28)
    .replace(/@/g, '')
    .replace(/\d{5,}/g, '')
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .slice(0, 18);
}

export default function App() {
  const networkIsOnline = useOnlineStatus();
  const initialProfile = useMemo(() => loadLocalProfile(), []);

  // Ephemeral per-session anonymous ID (zero cross-session tracking, never broadcast to peers)
  const [playerId] = useState<string>(() => {
    try {
      localStorage.removeItem('guaterutas_driver_id');
    } catch {
      // Ignore storage restrictions
    }
    return createEphemeralPlayerSessionId();
  });
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');

  // APK-Ready 2-Option Connection Modality:
  // - 'LOCAL_OFFLINE': Local (Sin Internet) — 100% local 3D circuits, vehicles & trophies
  // - 'ONLINE_GLOBAL': Conexión a Internet Global + Pistas en Tiempo Real
  const [connectionUsageMode, setConnectionUsageMode] = useState<ConnectionUsageMode>(() =>
    normalizeConnectionMode(initialProfile.connectionUsageMode),
  );

  const isForcedLocalOffline = connectionUsageMode === 'LOCAL_OFFLINE';
  const isOnline = networkIsOnline && !isForcedLocalOffline;

  // Safe Anonymous User Alias & Experience Mode State (Persisted locally for offline & online use)
  const [sessionMode, setSessionMode] = useState<SessionMode>(
    initialProfile.sessionMode || 'SOLO',
  );
  const [driveMode, setDriveMode] = useState<DriveExperienceMode>(
    initialProfile.driveMode || 'RACE_4MIN',
  );
  const [showPreTrackLaunchModal, setShowPreTrackLaunchModal] = useState<boolean>(false);
  const [celebrateAllWinSeq, setCelebrateAllWinSeq] = useState<number>(0);
  const [raceAllWinModalData, setRaceAllWinModalData] = useState<{
    participants: RaceParticipantSummary[];
    elapsedSec: number;
    mapName: string;
  } | null>(null);

  const [p1Alias, setP1Alias] = useState<string>(initialProfile.p1Alias || 'PilotoGT1');
  const [roomCode, setRoomCode] = useState<string>(initialProfile.roomCode || 'PISTA1');
  const [p2Alias, setP2Alias] = useState<string>(initialProfile.p2Alias || 'PilotoGT2');

  // Stylized 3D Map & UI Drawer State
  const [regionFilter, setRegionFilter] = useState<RegionGroup>(
    initialProfile.regionFilter || 'GUATEMALA',
  );
  const [selectedMapId, setSelectedMapId] = useState<string>(
    initialProfile.selectedMapId || 'gt_antigua',
  );
  // Online Real Maps & Custom Real-World Track Selection (Active ONLY when online; offline falls back safely to 3D local circuits)
  const [realMapEnabled, setRealMapEnabled] = useState<boolean>(
    Boolean(initialProfile.realMapEnabled),
  );
  const [realMapTypeId, setRealMapTypeId] = useState<'hybrid' | 'roadmap'>(
    initialProfile.realMapTypeId || 'hybrid',
  );
  const [customPlaceTrack, setCustomPlaceTrack] = useState<CustomOnlinePlaceTrack | null>(
    initialProfile.customPlaceTrack || null,
  );
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);

  const [showHudPhotos, setShowHudPhotos] = useState<boolean>(false);
  const [showHudAwards, setShowHudAwards] = useState<boolean>(false);
  const [awardsWon, setAwardsWon] = useState<AwardDeliveryRecord[]>(
    Array.isArray(initialProfile.awardsWon) ? initialProfile.awardsWon : [],
  );
  const [raceHistory, setRaceHistory] = useState<RaceHistoryRecord[]>(() => {
    if (Array.isArray(initialProfile.raceHistory) && initialProfile.raceHistory.length > 0) {
      return initialProfile.raceHistory;
    }
    if (Array.isArray(initialProfile.awardsWon) && initialProfile.awardsWon.length > 0) {
      const grouped = new Map<string, RaceHistoryRecord>();
      for (const aw of initialProfile.awardsWon) {
        const dayKey = new Date(aw.timestamp).toISOString().slice(0, 10);
        const key = `${aw.mapId}_${dayKey}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.totalMedalsEarned += 1;
          if (aw.timestamp > existing.timestamp) {
            existing.timestamp = aw.timestamp;
            existing.dateIso = new Date(aw.timestamp).toISOString();
          }
        } else {
          grouped.set(key, {
            id: `hist_${key}`,
            dateIso: new Date(aw.timestamp).toISOString(),
            timestamp: aw.timestamp,
            mapId: aw.mapId,
            mapName: aw.mapName,
            totalMedalsEarned: 1,
          });
        }
      }
      return Array.from(grouped.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
    return [];
  });
  const currentRunIdRef = useRef<string>(
    `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  );
  const currentRunMedalsRef = useRef<number>(0);

  // Local Persistence Stats for "Logros Especiales" (Kilómetros, Vehículos Desbloqueados, Medallas Totales)
  const [persistenceStats, setPersistenceStats] = useState<LocalPersistenceStats>(() => {
    const savedAwards = Array.isArray(initialProfile.awardsWon) ? initialProfile.awardsWon : [];
    const savedHistory = Array.isArray(initialProfile.raceHistory)
      ? initialProfile.raceHistory
      : [];
    const historyMedalSum = savedHistory.reduce((acc, r) => acc + (r.totalMedalsEarned || 0), 0);
    const derivedMedals = Math.max(
      typeof initialProfile.totalMedalsObtained === 'number'
        ? initialProfile.totalMedalsObtained
        : 0,
      savedAwards.length,
      historyMedalSum,
    );
    const derivedKm =
      typeof initialProfile.totalKilometersDriven === 'number' &&
      Number.isFinite(initialProfile.totalKilometersDriven)
        ? Math.max(0, initialProfile.totalKilometersDriven)
        : Number((derivedMedals * 0.45).toFixed(2));

    const validIds = new Set<CarModelId>(CARS_CATALOG.map((c) => c.id));
    const unlockedSet = new Set<CarModelId>(STARTER_UNLOCKED_CARS);
    if (initialProfile.p1CarId && validIds.has(initialProfile.p1CarId)) {
      unlockedSet.add(initialProfile.p1CarId);
    }
    if (initialProfile.p2CarId && validIds.has(initialProfile.p2CarId)) {
      unlockedSet.add(initialProfile.p2CarId);
    }
    if (Array.isArray(initialProfile.unlockedCarIds)) {
      for (const cid of initialProfile.unlockedCarIds) {
        if (validIds.has(cid)) unlockedSet.add(cid);
      }
    }
    for (const rule of VEHICLE_UNLOCK_MILESTONES) {
      if (derivedKm >= rule.minKm || derivedMedals >= rule.minMedals) {
        unlockedSet.add(rule.carId);
      }
    }

    return {
      totalKilometersDriven: derivedKm,
      unlockedCarIds: Array.from(unlockedSet),
      totalMedalsObtained: derivedMedals,
    };
  });
  const [achievementsFilter, setAchievementsFilter] = useState<'ALL' | 'UNLOCKED' | 'IN_PROGRESS'>(
    'ALL',
  );
  const lastDriveSampleRef = useRef<{
    mapId: string;
    resetSeq: number;
    p1x: number;
    p1z: number;
    p2x?: number;
    p2z?: number;
  } | null>(null);
  const pendingMetersRef = useRef<number>(0);

  const [recentStageAward, setRecentStageAward] = useState<AwardDeliveryRecord | null>(null);
  const [grandFinaleModalAward, setGrandFinaleModalAward] = useState<AwardDeliveryRecord | null>(
    null,
  );
  const [vehicleFilter, setVehicleFilter] = useState<'ALL' | 'ELECTRIC_TRIKES' | 'URBAN_SPECIAL' | 'CARS'>('ALL');

  // Vehicle & Simulator Controls State
  const [p1CarId, setP1CarId] = useState<CarModelId>(initialProfile.p1CarId || 'cuatrimoto_el');
  const [p1Paint, setP1Paint] = useState<string>(initialProfile.p1Paint || '#16a34a');
  const [p2CarId, setP2CarId] = useState<CarModelId>(initialProfile.p2CarId || 'triciclo_el');
  const [p2Paint, setP2Paint] = useState<string>(initialProfile.p2Paint || '#0284c7');
  const [transmission, setTransmission] = useState<TransmissionType>(
    initialProfile.transmission || 'AT',
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialProfile.cameraMode || 'CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initialProfile.timeOfDay || 'DAY');
  const [soundMuted, setSoundMuted] = useState<boolean>(Boolean(initialProfile.soundMuted));

  // Independent, Compact, Draggable & Removable HUD Panels (Never covering Wheel or Pedals!)
  const [controlsBarVisible, setControlsBarVisible] = useState<boolean>(true);
  const [controlsBarExpanded, setControlsBarExpanded] = useState<boolean>(false);
  const [controlsOffset, setControlsOffset] = useState<{ x: number; y: number }>(
    loadControlsOffset,
  );
  const controlsDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const [rigVisible, setRigVisible] = useState<boolean>(true);
  const [gearboxVisible, setGearboxVisible] = useState<boolean>(true);
  const [rigCompact, setRigCompact] = useState<boolean>(
    initialProfile.rigCompact !== undefined ? initialProfile.rigCompact : true,
  );
  const [minimapVisible, setMinimapVisible] = useState<boolean>(true);
  const [topInfoMinimized, setTopInfoMinimized] = useState<boolean>(false);
  const [resetHudLayoutSeq, setResetHudLayoutSeq] = useState<number>(0);

  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [descentTrigger, setDescentTrigger] = useState<number>(0);

  // Image Resilience & Offline Pasarela Notice
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [offlinePasarelaNotice, setOfflinePasarelaNotice] = useState<boolean>(false);

  // Dynamic Youthful Sub-Menu & Official Cover Art Showcase State
  const [activeSubMenu, setActiveSubMenu] = useState<TitleSubMenuTab>('CARATULA');
  const [heroVisualTab, setHeroVisualTab] = useState<'CARATULA' | 'PISTA'>('CARATULA');

  // Bottom Pasarela / Donation Screen State (Default 'donacion' visible; compatible with Android cambiarPantalla)
  const [activePasarelaScreen, setActivePasarelaScreen] = useState<
    'donacion' | 'consultoria' | 'diploma'
  >('donacion');

  // Persist user profile, vehicles, circuits & trophies locally so everything works offline across sessions
  useEffect(() => {
    try {
      const toSave: LocalSavedProfile = {
        p1Alias,
        p2Alias,
        sessionMode,
        driveMode,
        connectionUsageMode,
        roomCode,
        regionFilter,
        selectedMapId,
        p1CarId,
        p1Paint,
        p2CarId,
        p2Paint,
        transmission,
        cameraMode,
        timeOfDay,
        soundMuted,
        awardsWon: awardsWon.slice(0, 50),
        raceHistory: raceHistory.slice(0, 60),
        totalKilometersDriven: Number(persistenceStats.totalKilometersDriven.toFixed(3)),
        unlockedCarIds: persistenceStats.unlockedCarIds,
        totalMedalsObtained: persistenceStats.totalMedalsObtained,
        rigCompact,
        realMapEnabled,
        realMapTypeId,
        customPlaceTrack,
      };
      localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore quota / private browsing errors safely
    }
  }, [
    p1Alias,
    p2Alias,
    sessionMode,
    driveMode,
    connectionUsageMode,
    roomCode,
    regionFilter,
    selectedMapId,
    p1CarId,
    p1Paint,
    p2CarId,
    p2Paint,
    transmission,
    cameraMode,
    timeOfDay,
    soundMuted,
    awardsWon,
    raceHistory,
    persistenceStats,
    rigCompact,
    realMapEnabled,
    realMapTypeId,
    customPlaceTrack,
  ]);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (isOnline && offlinePasarelaNotice) {
      setOfflinePasarelaNotice(false);
    }
  }, [isOnline, offlinePasarelaNotice]);

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

  // Active Online Rooms Lobby Preview (Skipped cleanly when offline)
  const [activeRoomsInfo, setActiveRoomsInfo] = useState<
    Array<{
      roomKey: string;
      count: number;
      aliases: string[];
      realMapMode?: boolean;
      customTrack?: CustomOnlinePlaceTrack | null;
    }>
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

  const hasGoogleMapsKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const isRealMapOverlayActive = Boolean(isOnline && realMapEnabled && hasGoogleMapsKey);

  const activeMap = useMemo(() => getMapById(selectedMapId), [selectedMapId]);
  const effectiveMap = useMemo<WorldMapSpec>(() => {
    if (!isOnline || !customPlaceTrack) return activeMap;
    return {
      ...activeMap,
      id: customPlaceTrack.id,
      name: customPlaceTrack.name,
      regionLabel: customPlaceTrack.formattedAddress,
      centerLat: customPlaceTrack.lat,
      centerLon: customPlaceTrack.lon,
    };
  }, [activeMap, customPlaceTrack, isOnline]);

  const mapOrderIndex = useMemo(
    () => Math.max(0, WORLD_MAPS_CATALOG.findIndex((m) => m.id === selectedMapId)),
    [selectedMapId],
  );
  const activeCar = useMemo(() => getCarById(p1CarId), [p1CarId]);

  const activeMapCheckpointPlans = useMemo(
    () =>
      effectiveMap.checkpoints.map((_, idx) =>
        getCheckpointAwardPlan(
          effectiveMap.id,
          mapOrderIndex,
          idx,
          effectiveMap.checkpoints.length,
        ),
      ),
    [effectiveMap, mapOrderIndex],
  );

  const [telemetry, setTelemetry] = useState<PlayerHudTelemetry>(() => ({
    speedKmh: 0,
    rpm: activeCar.idleRpm,
    redlineRpm: activeCar.redlineRpm,
    gear: '1',
    transmission: initialProfile.transmission || 'AT',
    steerDegrees: 0,
    throttle: 0,
    brake: 0,
    streetName: activeMap.roads[0]?.name || activeMap.name,
    lat: 0,
    lon: 0,
    x: activeMap.spawn.x,
    z: activeMap.spawn.z,
    heading: activeMap.spawn.heading,
    checkpointsCollected: 0,
    totalCheckpoints: activeMap.checkpoints.length,
    lapTimeSec: 0,
    nitroPct: 100,
    driveMode,
    raceRemainingSec: 240,
    addTimeBonusSec: 0,
    nextCheckpointDistMeters: 0,
    nextCheckpointRelAngleRad: 0,
    participantCount: 1,
  }));
  const [activeCheckpoint, setActiveCheckpoint] = useState<RoadNode2D | null>(
    activeMap.checkpoints[0] || null,
  );
  const [p2MinimapPos, setP2MinimapPos] = useState<{
    x: number;
    z: number;
    heading: number;
  } | null>(null);

  // WebSocket + Offline BroadcastChannel Multiplayer Hook (Syncs Chosen Name + Chosen Transport + Value Message)
  const { remotePlayersRef, peerList, connected, sendPositionUpdate } = useMultiplayerRoom({
    enabled: gameState === 'PLAYING',
    sessionMode,
    playerId,
    alias: sanitizeGamerUsername(p1Alias).trim() || 'Piloto1',
    carId: p1CarId,
    paintHex: p1Paint,
    valueMessage: activeCar.valueMessage,
    mapId: effectiveMap.id,
    roomCode: roomCode.trim().toUpperCase() || 'PISTA1',
    transmission,
    spawn: effectiveMap.spawn,
    realMapMode: isRealMapOverlayActive,
    customTrack: isOnline ? customPlaceTrack : null,
    forceOffline: isForcedLocalOffline,
  });

  // Fetch active multiplayer rooms when in Title Menu & online
  useEffect(() => {
    if (gameState !== 'TITLE_MENU' || !isOnline) {
      if (!isOnline) {
        setActiveRoomsInfo([]);
      }
      return;
    }
    let active = true;
    const loadRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          rooms?: Array<{
            roomKey: string;
            count: number;
            aliases: string[];
            realMapMode?: boolean;
            customTrack?: CustomOnlinePlaceTrack | null;
          }>;
        };
        if (active && data.ok && Array.isArray(data.rooms)) {
          setActiveRoomsInfo(data.rooms);
        }
      } catch {
        // Ignore offline fetch cleanly
      }
    };
    void loadRooms();
    const timer = window.setInterval(loadRooms, 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gameState, isOnline]);

  // Keyboard shortcut 'H' toggles the floating Controles (H) panel without touching the steering wheel!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH' && gameState === 'PLAYING') {
        setControlsBarVisible((prev) => !prev);
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

  // Block mobile browser pinch-zoom & double-tap zoom gestures while in 3D PLAYING mode so simultaneous Steering + Gas never zooms the screen
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const preventZoomGesture = (e: Event) => {
      e.preventDefault();
    };
    const preventMultiTouchBrowserZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('gesturestart', preventZoomGesture, { passive: false });
    document.addEventListener('gesturechange', preventZoomGesture, { passive: false });
    document.addEventListener('gestureend', preventZoomGesture, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchBrowserZoom, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', preventZoomGesture);
      document.removeEventListener('gesturechange', preventZoomGesture);
      document.removeEventListener('gestureend', preventZoomGesture);
      document.removeEventListener('touchmove', preventMultiTouchBrowserZoom);
    };
  }, [gameState]);

  const handleSelectCar = (carId: CarModelId) => {
    const spec = getCarById(carId);
    setP1CarId(carId);
    setP1Paint(spec.defaultPaint);
  };

  // Opens the Pre-Track Experience Selector Modal when entering any track/city
  const handleStartSimulation = () => {
    setShowPreTrackLaunchModal(true);
  };

  const startFreshRaceRun = useCallback(() => {
    currentRunIdRef.current = `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentRunMedalsRef.current = 0;
  }, []);

  const recordOrUpdateCurrentRaceResult = useCallback(
    (
      mapId: string,
      mapName: string,
      medalsDelta: number,
      modeOverride?: DriveExperienceMode,
      elapsedSec?: number,
    ) => {
      const runId = currentRunIdRef.current;
      const nextMedals = Math.max(1, currentRunMedalsRef.current + medalsDelta);
      currentRunMedalsRef.current = nextMedals;
      const nowTs = Date.now();
      const nowIso = new Date(nowTs).toISOString();

      setRaceHistory((prev) => {
        const existingIdx = prev.findIndex((item) => item.id === runId);
        const updatedRecord: RaceHistoryRecord = {
          id: runId,
          dateIso: nowIso,
          timestamp: nowTs,
          mapId,
          mapName,
          totalMedalsEarned: nextMedals,
          driveMode: modeOverride ?? driveMode,
          elapsedSec: elapsedSec ?? (existingIdx >= 0 ? prev[existingIdx].elapsedSec : undefined),
        };
        if (existingIdx >= 0) {
          const rest = prev.filter((_, idx) => idx !== existingIdx);
          return [updatedRecord, ...rest].slice(0, 60);
        }
        return [updatedRecord, ...prev].slice(0, 60);
      });
    },
    [driveMode],
  );

  const handleLaunchTrackWithMode = (chosenMode: DriveExperienceMode, chosenSession?: SessionMode) => {
    soundEngine.init();
    startFreshRaceRun();
    setDriveMode(chosenMode);
    if (chosenSession) {
      setSessionMode(chosenSession);
      if (chosenSession === 'ONLINE_MULTI' && connectionUsageMode === 'LOCAL_OFFLINE') {
        setConnectionUsageMode('ONLINE_GLOBAL');
      }
    }
    setRaceAllWinModalData(null);
    setGrandFinaleModalAward(null);
    setShowPreTrackLaunchModal(false);
    setResetTrigger((n) => n + 1);
    setDescentTrigger((n) => n + 1);
    setGameState('PLAYING');
  };

  const handleResetAllHudPositions = () => {
    setControlsOffset({ x: 0, y: 0 });
    setRigVisible(true);
    setGearboxVisible(true);
    setControlsBarVisible(true);
    setResetHudLayoutSeq((n) => n + 1);
    try {
      localStorage.removeItem(CONTROLS_PANEL_OFFSET_KEY);
    } catch {
      // Ignore storage errors
    }
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

  const flushPendingMetersAndUnlocks = useCallback(
    (medalsDelta = 0, activeDrivenCars: CarModelId[] = []) => {
      const metersToCommit = pendingMetersRef.current;
      pendingMetersRef.current = 0;
      if (metersToCommit <= 0 && medalsDelta <= 0 && activeDrivenCars.length === 0) return;

      setPersistenceStats((prev) => {
        const nextKm = Math.max(0, prev.totalKilometersDriven + metersToCommit / 1000);
        const nextMedals = Math.max(0, prev.totalMedalsObtained + medalsDelta);
        const unlockedSet = new Set<CarModelId>(prev.unlockedCarIds);
        for (const cid of activeDrivenCars) {
          unlockedSet.add(cid);
        }
        for (const rule of VEHICLE_UNLOCK_MILESTONES) {
          if (nextKm >= rule.minKm || nextMedals >= rule.minMedals) {
            unlockedSet.add(rule.carId);
          }
        }
        return {
          totalKilometersDriven: nextKm,
          unlockedCarIds: Array.from(unlockedSet),
          totalMedalsObtained: nextMedals,
        };
      });
    },
    [],
  );

  // Flush any remaining fractional meters when returning to menu from 3D track
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      lastDriveSampleRef.current = null;
      flushPendingMetersAndUnlocks(0, []);
    }
  }, [gameState, flushPendingMetersAndUnlocks]);

  const handleTelemetry = useCallback(
    (
      hud: PlayerHudTelemetry,
      cp: RoadNode2D | null,
      p2Pos: { x: number; z: number; heading: number } | null,
    ) => {
      setTelemetry(hud);
      setActiveCheckpoint(cp);
      setP2MinimapPos(p2Pos);

      const prevSample = lastDriveSampleRef.current;
      if (
        prevSample &&
        prevSample.mapId === effectiveMap.id &&
        prevSample.resetSeq === resetTrigger
      ) {
        const d1 = Math.hypot(hud.x - prevSample.p1x, hud.z - prevSample.p1z);
        if (d1 > 0.03 && d1 < 45) {
          pendingMetersRef.current += d1;
        }
        if (
          p2Pos &&
          typeof prevSample.p2x === 'number' &&
          typeof prevSample.p2z === 'number'
        ) {
          const d2 = Math.hypot(p2Pos.x - prevSample.p2x, p2Pos.z - prevSample.p2z);
          if (d2 > 0.03 && d2 < 45) {
            pendingMetersRef.current += d2;
          }
        }
        if (pendingMetersRef.current >= 15) {
          flushPendingMetersAndUnlocks(0, []);
        }
      }
      lastDriveSampleRef.current = {
        mapId: effectiveMap.id,
        resetSeq: resetTrigger,
        p1x: hud.x,
        p1z: hud.z,
        p2x: p2Pos?.x,
        p2z: p2Pos?.z,
      };
    },
    [effectiveMap.id, resetTrigger, flushPendingMetersAndUnlocks],
  );

  const stageAwardTimerRef = useRef<number | null>(null);
  const handleAwardDelivered = useCallback(
    (award: AwardDeliveryRecord) => {
      setAwardsWon((prev) => [award, ...prev.slice(0, 49)]);
      recordOrUpdateCurrentRaceResult(award.mapId, award.mapName, 1);
      flushPendingMetersAndUnlocks(
        1,
        sessionMode === 'SPLIT_2P' ? [p1CarId, p2CarId] : [p1CarId],
      );
      if (award.isGrandFinale) {
        startFreshRaceRun();
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
    },
    [
      recordOrUpdateCurrentRaceResult,
      flushPendingMetersAndUnlocks,
      sessionMode,
      p1CarId,
      p2CarId,
      startFreshRaceRun,
    ],
  );

  const handleRaceAllWinSummary = useCallback(
    (participants: RaceParticipantSummary[], elapsedSec: number) => {
      const participationAward: AwardDeliveryRecord = {
        id: `${effectiveMap.id}_allwin_${Date.now()}`,
        mapId: effectiveMap.id,
        mapName: effectiveMap.name,
        checkpointNumber: effectiveMap.checkpoints.length,
        totalCheckpoints: effectiveMap.checkpoints.length,
        isGrandFinale: false,
        presenterName: 'Comité Deportivo · Todos Ganan',
        presenterRole: 'Medalla Automática para Todos los Participantes',
        awardTitle: `Medalla de Oro · Todos Somos Ganadores (${participants.length} pilotos)`,
        awardKind: 'PARTICIPATION_ALL_WIN',
        photoUrl: REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl,
        photoCropSlot: 0,
        timestamp: Date.now(),
      };
      setAwardsWon((prev) => [participationAward, ...prev.slice(0, 49)]);
      const localEarnedBonus = Math.max(
        1,
        participants.filter((p) => p.isHuman && !p.isOnlinePeer).length,
      );
      recordOrUpdateCurrentRaceResult(
        effectiveMap.id,
        effectiveMap.name,
        localEarnedBonus,
        'RACE_4MIN',
        elapsedSec,
      );
      flushPendingMetersAndUnlocks(
        localEarnedBonus,
        sessionMode === 'SPLIT_2P' ? [p1CarId, p2CarId] : [p1CarId],
      );
      startFreshRaceRun();
      setRaceAllWinModalData({
        participants,
        elapsedSec,
        mapName: effectiveMap.name,
      });
    },
    [
      effectiveMap,
      recordOrUpdateCurrentRaceResult,
      flushPendingMetersAndUnlocks,
      sessionMode,
      p1CarId,
      p2CarId,
      startFreshRaceRun,
    ],
  );

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
    setRaceAllWinModalData(null);
    setRecentStageAward(null);
    setCustomPlaceTrack(null);
    setSelectedMapId(nextMap.id);
    setShowPreTrackLaunchModal(true);
  }, [mapOrderIndex]);

  const handlePasarelaNavigationGuard = (e: React.SyntheticEvent) => {
    if (!isOnline) {
      e.preventDefault();
      setOfflinePasarelaNotice(true);
    }
  };

  const filteredMaps = useMemo(
    () => WORLD_MAPS_CATALOG.filter((m) => m.group === regionFilter),
    [regionFilter],
  );

  const safeP1Display = sanitizeGamerUsername(p1Alias).trim() || 'Piloto1';
  const safeP2Display = sanitizeGamerUsername(p2Alias).trim() || 'Piloto2';

  const completedCircuitCount = useMemo(() => {
    const completedIds = new Set(
      awardsWon.filter((a) => a.isGrandFinale).map((a) => a.mapId),
    );
    return completedIds.size;
  }, [awardsWon]);
  const hasCompletedAllTracks = completedCircuitCount >= WORLD_MAPS_CATALOG.length;

  const handleSelectLocalOffline = useCallback(() => {
    setConnectionUsageMode('LOCAL_OFFLINE');
  }, []);

  const handleSelectOnlineGlobal = useCallback(() => {
    setConnectionUsageMode('ONLINE_GLOBAL');
  }, []);

  const gmpQuotaBanner = gmpQuotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  const preTrackLaunchModalElement = showPreTrackLaunchModal ? (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-[min(780px,96vw)] bg-white border-2 border-sky-300 rounded-3xl overflow-hidden shadow-2xl text-slate-900 my-auto">
        <div className="bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 px-6 py-4 text-white flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-amber-200 uppercase tracking-wide">
              Iniciar Pista en {effectiveMap.country} · Patrimonio: {effectiveMap.culturalHeritageTitle}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold mt-0.5">
              {effectiveMap.name} — Elige tu Modalidad de Recorrido
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPreTrackLaunchModal(false)}
            aria-label="Cerrar selector de modalidad"
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* OPTION 1: PASEO LIBRE POR CALLES Y PAISAJES */}
            <div
              className={`rounded-2xl border-2 p-5 flex flex-col justify-between gap-4 transition-all ${
                driveMode === 'FREE_ROAM'
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-md'
                  : 'bg-sky-50/50 border-sky-200 hover:border-emerald-400'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 shrink-0" />
                    <span>Opción 1 · Sin Reloj</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Paisajes 3D Reales
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-950">
                  Pasear Libre por Calles y Paisajes
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Recorre sin prisa todas las calles, montañas, volcanes, palmeras, flores, ríos,
                  lagos, lagunas y mares en movimiento, junto al patrimonio monumental (
                  <strong>{effectiveMap.culturalHeritageTitle}</strong>) y los letreros de juegos
                  lúdicos del siglo XIX y XX.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleLaunchTrackWithMode('FREE_ROAM')}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Salir a Pasear Libre →</span>
              </button>
            </div>

            {/* OPTION 2: CARRERA ADD TIME 4 MINUTOS — TODOS GANAN MEDALLA */}
            <div
              className={`rounded-2xl border-2 p-5 flex flex-col justify-between gap-4 transition-all ${
                driveMode === 'RACE_4MIN'
                  ? 'bg-amber-50/90 border-amber-500 shadow-md'
                  : 'bg-sky-50/50 border-sky-200 hover:border-amber-400'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <Timer className="w-4 h-4 shrink-0" />
                    <span>Opción 2 · 4:00 Min + Add Time</span>
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">
                    ¡Todos Ganan Medalla!
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-950">
                  Carrera Add Time · 4 Minutos
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  Participan otros carros y transportes en pista, todos cuentan con{' '}
                  <strong>flecha guía 3D hacia la meta</strong>, bonos <strong>+15s Add Time</strong>{' '}
                  y al cierre{' '}
                  <strong>todos reciben medallas automáticamente por participar</strong>.
                </p>

                {/* Sub-selector: Local 1P / Local 2P / Online Multiple Users */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-800">
                    Elige participantes para esta carrera:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        {
                          id: 'SOLO',
                          label: 'Local · 1 Usuario + Carros Participantes',
                        },
                        {
                          id: 'SPLIT_2P',
                          label: 'Local · 2 Usuarios (Pantalla Dividida) + Participantes',
                        },
                        {
                          id: 'ONLINE_MULTI',
                          label: 'Con Internet · Múltiples Usuarios en Línea (Nombre sobre Transporte)',
                        },
                      ] as Array<{ id: SessionMode; label: string }>
                    ).map((sm) => (
                      <button
                        key={sm.id}
                        type="button"
                        onClick={() => {
                          setSessionMode(sm.id);
                          if (sm.id === 'ONLINE_MULTI' && connectionUsageMode === 'LOCAL_OFFLINE') {
                            setConnectionUsageMode('ONLINE_GLOBAL');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                          sessionMode === sm.id
                            ? 'bg-sky-600 border-sky-700 text-white'
                            : 'bg-white border-sky-200 text-slate-700 hover:border-sky-400'
                        }`}
                      >
                        {sm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLaunchTrackWithMode('RACE_4MIN', sessionMode)}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4 text-slate-950" />
                <span>¡Iniciar Carrera 4:00 (Todos Ganan)! →</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-100 text-xs text-slate-600">
            <span>
              Piloto: <strong className="text-slate-900">{safeP1Display}</strong> · Transporte:{' '}
              <strong className="text-sky-800">{activeCar.name}</strong> (Valor:{' '}
              <em className="text-amber-700 font-semibold">{activeCar.valueMessage}</em>)
            </span>
            {sessionMode === 'ONLINE_MULTI' && (
              <span className="text-sky-700 font-semibold">
                Sala {roomCode.toUpperCase()} · Tu apodo aparecerá arriba de tu transporte
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // =========================================================================
  // IN-GAME 3D DRIVING VIEWPORT (100% LOCAL & OFFLINE CAPABLE + ONLINE REAL MAPS)
  // =========================================================================
  if (gameState === 'PLAYING') {
    return (
      <div className="game-viewport-lock relative w-screen h-screen overflow-hidden bg-[#090d16] select-none touch-none flex flex-col">
        {gmpQuotaBanner}
        {preTrackLaunchModalElement}
        <OfflineIndicator
          forceOfflineMode={isForcedLocalOffline}
          onSwitchToOnline={handleSelectOnlineGlobal}
        />

        <div className="relative flex-1 w-full overflow-hidden touch-none">
          <RealGoogleMapDriveLayer
            enabled={isRealMapOverlayActive}
            isOnline={isOnline}
            mapTypeId={realMapTypeId}
            activeMap={effectiveMap}
            customPlaceTrack={customPlaceTrack}
            playerX={telemetry.x}
            playerZ={telemetry.z}
            playerHeading={telemetry.heading}
            remotePlayers={peerList}
            onQuotaExceeded={() => setGmpQuotaExceeded(true)}
          />

          <ThreeDrivingSimulator
            map={effectiveMap}
            mapOrderIndex={mapOrderIndex}
            extraRoads={[]}
            realMapOverlayMode={isRealMapOverlayActive}
            gameState={gameState}
            driveMode={driveMode}
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
            onRaceAllWinSummary={handleRaceAllWinSummary}
            onRoundComplete={() => {}}
            resetTrigger={resetTrigger}
            descentTrigger={descentTrigger}
            celebrateAllWinSeq={celebrateAllWinSeq}
          />

          {/* Top-Center Compact 4:00 Add Time Race & Live Route Guidance Bar (Zero backdrop-blur over WebGL) */}
          <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 max-w-[min(480px,88vw)]">
            {driveMode === 'RACE_4MIN' ? (
              <div className="pointer-events-auto bg-[#0b101b] border border-amber-500/70 rounded-xl px-3 py-1.5 shadow-xl flex flex-wrap items-center justify-center gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-mono tabular-nums font-bold text-amber-300">
                  <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{formatRaceClock(telemetry.raceRemainingSec ?? 240)}</span>
                  {(telemetry.addTimeBonusSec ?? 0) > 0 && (
                    <span className="text-[10px] font-sans font-bold text-emerald-300">
                      +{telemetry.addTimeBonusSec}s Add Time
                    </span>
                  )}
                </div>

                <span aria-hidden="true" className="text-slate-600">
                  |
                </span>

                <div
                  title="Flecha guía hacia la siguiente meta"
                  className="flex items-center gap-1 text-sky-300 font-semibold"
                >
                  <Navigation
                    className="w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform duration-150"
                    style={{
                      transform: `rotate(${Math.round(
                        -((telemetry.nextCheckpointRelAngleRad || 0) * 180) / Math.PI,
                      )}deg)`,
                    }}
                  />
                  <span className="font-mono tabular-nums">
                    {telemetry.nextCheckpointDistMeters ?? 0} m
                  </span>
                  <span className="hidden sm:inline text-[11px] text-slate-300">a meta</span>
                </div>

                <span aria-hidden="true" className="hidden sm:inline text-slate-600">
                  |
                </span>

                <button
                  type="button"
                  onClick={() => setCelebrateAllWinSeq((s) => s + 1)}
                  title="Entregar medallas automáticas a todos los participantes"
                  className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                >
                  Medallas ({telemetry.participantCount ?? 6})
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto bg-[#0b101b] border border-slate-700 rounded-xl px-3 py-1 shadow-lg flex items-center gap-2 text-[11px] text-slate-200">
                <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[280px]">
                  Paseo Libre · {effectiveMap.culturalHeritageTitle}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDriveMode('RACE_4MIN');
                    setResetTrigger((n) => n + 1);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold whitespace-nowrap cursor-pointer"
                >
                  Carrera 4:00
                </button>
              </div>
            )}
          </div>

          {/* Top Left Compact Circuit Info + Quick Restore Chips when any panel is hidden */}
          <div className="pointer-events-none fixed top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[min(380px,54vw)]">
            <div className="pointer-events-auto bg-[#0b101b] border border-slate-800 rounded-xl px-3 py-2 shadow-lg w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
                  <span className="font-semibold text-amber-400 truncate">
                    {effectiveMap.name}
                  </span>
                  {isRealMapOverlayActive && (
                    <span className="text-[10px] font-semibold text-sky-300 shrink-0">
                      (Mapa Real)
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-amber-300 shrink-0">
                    Metas: {telemetry.checkpointsCollected}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTopInfoMinimized((v) => !v)}
                  title={topInfoMinimized ? 'Mostrar detalle de pista' : 'Compactar info de pista'}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                >
                  {topInfoMinimized ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
              </div>

              {!topInfoMinimized && (
                <>
                  <div className="text-sm font-display font-bold text-slate-50 truncate mt-0.5">
                    {telemetry.streetName}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span>
                      Piloto: <strong className="text-slate-100">{safeP1Display}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{activeCar.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-300 truncate">{activeCar.valueMessage}</span>
                    {sessionMode === 'ONLINE_MULTI' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-400">
                          Sala {roomCode.toUpperCase()} (
                          {connected
                            ? `${peerList.length + 1} en línea`
                            : peerList.length > 0
                              ? `${peerList.length + 1} local`
                              : 'modo local'}
                          )
                        </span>
                      </>
                    )}
                  </div>

                  {telemetry.currentAwardTitle && (
                    <div className="mt-1 pt-1 border-t border-slate-800/70 text-[11px] text-amber-300 flex items-center gap-1.5 truncate">
                      <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">Meta: {telemetry.currentAwardTitle}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tiny Unobtrusive Restore Chips ONLY for hidden panels */}
            {(!controlsBarVisible || !rigVisible || !gearboxVisible) && (
              <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
                {!controlsBarVisible && (
                  <button
                    type="button"
                    onClick={() => setControlsBarVisible(true)}
                    className="px-2.5 py-1 rounded-lg bg-[#0b101b]/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-amber-300 flex items-center gap-1 shadow"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Controles (H)</span>
                  </button>
                )}
                {!rigVisible && (
                  <button
                    type="button"
                    onClick={() => setRigVisible(true)}
                    className="px-2.5 py-1 rounded-lg bg-[#0b101b]/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 shadow"
                  >
                    Mostrar Volante
                  </button>
                )}
                {!gearboxVisible && (
                  <button
                    type="button"
                    onClick={() => setGearboxVisible(true)}
                    className="px-2.5 py-1 rounded-lg bg-[#0b101b]/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 shadow"
                  >
                    Mostrar Velocímetro
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Top Right: Player 2 Split Telemetry + Optional Minimap */}
          <div className="pointer-events-none fixed top-16 right-3 z-10 flex flex-col items-end gap-2">
            {sessionMode === 'SPLIT_2P' && (
              <div className="pointer-events-auto bg-[#0b101b]/90 border border-slate-800 rounded-xl px-3 py-2 shadow-lg text-right">
                <div className="text-[11px] text-sky-400 font-semibold">
                  {safeP2Display} · Flechas
                </div>
                <div className="font-mono tabular-nums text-xs font-bold text-slate-200 mt-0.5">
                  {Math.round(telemetry.p2SpeedKmh || 0)} km/h · D{telemetry.p2Gear || '1'}
                </div>
              </div>
            )}

            {minimapVisible && (
              <div className="pointer-events-auto hidden xl:block relative">
                <button
                  type="button"
                  onClick={() => setMinimapVisible(false)}
                  title="Ocultar minimapa"
                  className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
                <MinimapCanvas
                  map={effectiveMap}
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

          {/* COMPACT, DRAGGABLE, REMOVABLE FLOATING "CONTROLES (H)" WIDGET (Top-Right by default — NEVER covers Wheel or Pedals!) */}
          {controlsBarVisible && (
            <div
              className="fixed top-3 right-3 z-30 pointer-events-auto select-none max-w-[min(520px,94vw)]"
              style={{
                transform: `translate3d(${controlsOffset.x}px, ${controlsOffset.y}px, 0)`,
              }}
            >
              <div className="bg-[#0b101b] border border-slate-700 rounded-xl shadow-2xl px-2.5 py-1.5">
                {/* Compact Single-Row Header: Drag Handle + Essential Quick Actions + Expand/Shrink + Close (X) */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div
                    onPointerDown={(e) => {
                      controlsDragRef.current = {
                        active: true,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: controlsOffset.x,
                        origY: controlsOffset.y,
                      };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!controlsDragRef.current.active) return;
                      const nx = Math.max(
                        -(window.innerWidth - 220),
                        Math.min(
                          12,
                          controlsDragRef.current.origX +
                            (e.clientX - controlsDragRef.current.startX),
                        ),
                      );
                      const ny = Math.max(
                        -8,
                        Math.min(
                          window.innerHeight - 80,
                          controlsDragRef.current.origY +
                            (e.clientY - controlsDragRef.current.startY),
                        ),
                      );
                      setControlsOffset({ x: nx, y: ny });
                    }}
                    onPointerUp={() => {
                      if (controlsDragRef.current.active) {
                        controlsDragRef.current.active = false;
                        try {
                          localStorage.setItem(
                            CONTROLS_PANEL_OFFSET_KEY,
                            JSON.stringify(controlsOffset),
                          );
                        } catch {
                          // Ignore storage errors
                        }
                      }
                    }}
                    onPointerCancel={() => {
                      controlsDragRef.current.active = false;
                    }}
                    title="Arrastra aquí para mover esta barra a cualquier lugar"
                    className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-800 cursor-move touch-none text-[11px] font-semibold text-slate-200 whitespace-nowrap"
                  >
                    <GripHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Controles (H)</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isOnline && hasGoogleMapsKey && (
                      <button
                        type="button"
                        onClick={() => setRealMapEnabled((prev) => !prev)}
                        title="Alternar entre Mapa Real en Línea y Circuito 3D Local"
                        className={`px-2 py-1 rounded-md border text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap ${
                          realMapEnabled
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-sky-300'
                        }`}
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span>{realMapEnabled ? 'Mapa Real' : '3D Local'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setCameraMode((prev) =>
                          prev === 'CHASE' ? 'COCKPIT' : prev === 'COCKPIT' ? 'AERIAL' : 'CHASE',
                        )
                      }
                      title="Cambiar vista de cámara (Tecla C)"
                      className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 whitespace-nowrap"
                    >
                      {cameraMode === 'COCKPIT'
                        ? 'Cabina'
                        : cameraMode === 'AERIAL'
                          ? 'Aérea'
                          : '3ª Pers.'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setResetTrigger((n) => n + 1)}
                      title="Reposicionar vehículo en la pista"
                      className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSoundMuted((m) => !m)}
                      title={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
                      className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200"
                    >
                      {soundMuted ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setControlsBarExpanded((v) => !v)}
                      title={
                        controlsBarExpanded ? 'Hacer más pequeño' : 'Abrir opciones de pista y carro'
                      }
                      className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-amber-300 flex items-center gap-1 whitespace-nowrap"
                    >
                      {controlsBarExpanded ? (
                        <>
                          <Minimize2 className="w-3 h-3" />
                          <span>Pequeño</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3" />
                          <span>Opciones</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameState('TITLE_MENU')}
                      className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold whitespace-nowrap"
                    >
                      Menú
                    </button>

                    <button
                      type="button"
                      onClick={() => setControlsBarVisible(false)}
                      title="Quitar barra de controles de la pantalla (Tecla H para recuperar)"
                      className="p-1 rounded-md text-slate-400 hover:text-red-300 hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Compact Options Popover (Only when user clicks "Opciones") */}
                {controlsBarExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <select
                        aria-label="Cambiar circuito 3D"
                        value={selectedMapId}
                        onChange={(e) => {
                          setCustomPlaceTrack(null);
                          setSelectedMapId(e.target.value);
                          setShowPreTrackLaunchModal(true);
                        }}
                        className="bg-slate-900 border border-slate-700 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 truncate focus:outline-none focus:border-amber-500"
                      >
                        {WORLD_MAPS_CATALOG.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.country} — {m.name}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label="Cambiar vehículo 3D"
                        value={p1CarId}
                        onChange={(e) => handleSelectCar(e.target.value as CarModelId)}
                        className="bg-slate-900 border border-slate-700 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 truncate focus:outline-none focus:border-amber-500"
                      >
                        {CARS_CATALOG.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.valueMessage})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Drive Experience Switcher: Paseo Libre vs Carrera 4:00 Add Time */}
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setDriveMode('FREE_ROAM');
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          driveMode === 'FREE_ROAM'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Paseo Libre (Paisajes)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDriveMode('RACE_4MIN');
                          setResetTrigger((n) => n + 1);
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          driveMode === 'RACE_4MIN'
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Carrera 4:00 Add Time
                      </button>
                    </div>

                    {/* Quick Modality Switcher inside Simulator (APK Ready: Local vs Global Online) */}
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-1.5 space-y-1">
                      <div className="text-[10px] font-semibold text-slate-400 px-1">
                        Modalidad de Juego:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={handleSelectLocalOffline}
                          className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            connectionUsageMode === 'LOCAL_OFFLINE'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-slate-300 hover:text-white'
                          }`}
                        >
                          Local (Sin Internet)
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectOnlineGlobal}
                          className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                            connectionUsageMode === 'ONLINE_GLOBAL'
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-900 text-slate-300 hover:text-white'
                          }`}
                        >
                          Conexión Global + Pistas en Tiempo Real
                        </button>
                      </div>
                    </div>

                    {/* Live Real Google Maps & Other Tracks Selector for Online Players */}
                    <OnlineRealMapsSelector
                      compact
                      variant="dark"
                      isOnline={isOnline}
                      realMapEnabled={realMapEnabled}
                      realMapTypeId={realMapTypeId}
                      customPlaceTrack={customPlaceTrack}
                      onToggleRealMap={setRealMapEnabled}
                      onChangeMapTypeId={setRealMapTypeId}
                      onSelectCustomPlaceTrack={(track) => {
                        setCustomPlaceTrack(track);
                        setResetTrigger((n) => n + 1);
                      }}
                      onQuotaExceeded={() => setGmpQuotaExceeded(true)}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
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
                            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                              timeOfDay === t.id
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHudPhotos((v) => !v);
                            setShowHudAwards(false);
                          }}
                          className={`px-2 py-1 rounded-md border flex items-center gap-1 whitespace-nowrap ${
                            showHudPhotos
                              ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                          }`}
                        >
                          <Camera className="w-3 h-3" />
                          <span>Vista</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowHudAwards((v) => !v);
                            setShowHudPhotos(false);
                          }}
                          className={`px-2 py-1 rounded-md border flex items-center gap-1 whitespace-nowrap ${
                            showHudAwards
                              ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                          }`}
                        >
                          <Trophy className="w-3 h-3 text-amber-400" />
                          <span className="font-mono tabular-nums">({awardsWon.length})</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRigCompact((c) => !c)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
                        >
                          Mandos: {rigCompact ? 'Pequeños' : 'Normales'}
                        </button>
                        {!minimapVisible && (
                          <button
                            type="button"
                            onClick={() => setMinimapVisible(true)}
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
                          >
                            Mostrar Mapa
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleResetAllHudPositions}
                        className="text-amber-400 hover:underline whitespace-nowrap"
                      >
                        Restablecer posiciones
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intermediate Checkpoint Toast: Sporting Medal & Trophy */}
          {recentStageAward && !grandFinaleModalAward && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 w-[min(430px,90vw)] bg-[#0b101b]/95 border border-amber-500/80 rounded-xl p-3 shadow-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg border border-amber-400/60 bg-amber-950/50 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-amber-400" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-amber-400 font-semibold">
                  Meta {recentStageAward.checkpointNumber}/{recentStageAward.totalCheckpoints} ·{' '}
                  {recentStageAward.mapName}
                </div>
                <div className="font-display text-sm font-bold text-white truncate">
                  ¡Premio ganado para {safeP1Display}!
                </div>
                <div className="text-xs text-slate-300 truncate">{recentStageAward.awardTitle}</div>
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

          {/* COLLECTIVE AUTOMATIC MEDALS MODAL ("¡Todos Somos Ganadores!" in RACE_4MIN) */}
          {raceAllWinModalData && !grandFinaleModalAward && (
            <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
              <div className="w-[min(640px,95vw)] bg-white border-2 border-amber-400 rounded-3xl overflow-hidden shadow-2xl text-slate-900 my-auto">
                <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 px-6 py-4 text-slate-950 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide">
                      Carrera Add Time Finalizada · {raceAllWinModalData.mapName}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold">
                      ¡Todos Somos Ganadores! Medallas Automáticas
                    </h2>
                  </div>
                  <Award className="w-10 h-10 text-slate-950 shrink-0" />
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    En esta modalidad deportiva todos los participantes reciben automáticamente su{' '}
                    <strong className="text-amber-700">Medalla de Oro de Participación</strong> por
                    compartir la pista, guiarse hacia las metas y celebrar juntos.
                  </p>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {raceAllWinModalData.participants.map((part) => (
                      <div
                        key={part.id}
                        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                          part.isHuman && !part.isOnlinePeer
                            ? 'bg-amber-50 border-amber-300'
                            : part.isOnlinePeer
                              ? 'bg-sky-50 border-sky-200'
                              : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{part.alias}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-sky-800">{part.vehicleName}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Valor en vehículo: <strong>{part.valueMessage}</strong> · Metas:{' '}
                            {part.checkpoints}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-400/90 text-slate-950 font-bold whitespace-nowrap shrink-0">
                          Medalla Entregada
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setRaceAllWinModalData(null);
                        setDriveMode('FREE_ROAM');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold cursor-pointer"
                    >
                      Seguir Paseando Libre
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startFreshRaceRun();
                        setRaceAllWinModalData(null);
                        setResetTrigger((n) => n + 1);
                      }}
                      className="px-4 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-950 text-xs sm:text-sm font-bold cursor-pointer"
                    >
                      Repetir Carrera 4:00
                    </button>
                    <button
                      type="button"
                      onClick={handleAdvanceToNextScreen}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
                    >
                      Siguiente Ciudad / Pista →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GRAND FINALE CEREMONY OVERLAY: Dos Madres Educadoras de San Lolek (Podio Virtual) */}
          {grandFinaleModalAward && (
            <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-4">
              <div className="w-[min(580px,95vw)] bg-white border-2 border-sky-300 rounded-3xl overflow-hidden shadow-2xl text-slate-900">
                <div className="relative h-64 w-full bg-sky-200 overflow-hidden border-b border-sky-200">
                  {!brokenImages.grand_trophy_modal ? (
                    <img
                      src={REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl}
                      alt="Dos Madres Educadoras de San Lolek entregando el Gran Trofeo en el podio virtual"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, grand_trophy_modal: true }))
                      }
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sky-300 via-sky-100 to-amber-100 flex items-center justify-center">
                      <Trophy className="w-16 h-16 text-amber-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                  <div className="absolute bottom-3 inset-x-5">
                    <div className="text-xs font-bold text-amber-300">
                      {hasCompletedAllTracks
                        ? `¡Ciclo Completo de las ${WORLD_MAPS_CATALOG.length} Pistas Logrado!`
                        : `Fin de Ciclo Completado · ${grandFinaleModalAward.mapName}`}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                      {GRAND_FINALE_AWARD_TITLE}
                    </h2>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    ¡Felicidades, <strong className="text-sky-700">{safeP1Display}</strong>! En el
                    podio deportivo imaginario del videojuego, las{' '}
                    <strong className="text-slate-900">{GRAND_FINALE_PRESENTER}</strong> —con su
                    hábito blanco con azul, viseras para el sol y lentes de sol, acompañadas por los
                    niños invitados apoyando desde la grada virtual— te entregan el{' '}
                    <strong className="text-amber-700">{GRAND_FINALE_AWARD_TITLE}</strong>.
                  </p>

                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Ciclo general de pistas:{' '}
                      <strong className="text-sky-800">
                        {completedCircuitCount} / {WORLD_MAPS_CATALOG.length} circuitos
                      </strong>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-amber-700 text-sm">
                      {awardsWon.length} premios ganados
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setGrandFinaleModalAward(null)}
                      className="px-4 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-xs sm:text-sm font-bold text-sky-950 whitespace-nowrap cursor-pointer"
                    >
                      Seguir Manejando Aquí
                    </button>
                    <button
                      type="button"
                      onClick={handleAdvanceToNextScreen}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold whitespace-nowrap shadow-sm cursor-pointer"
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
            <div className="fixed left-4 top-28 z-30 w-[min(420px,92vw)] shadow-2xl">
              <PlacePhotosGallery
                mapSpec={activeMap}
                compact
                onClose={() => setShowHudPhotos(false)}
              />
            </div>
          )}

          {/* Trophy Cabinet Floating Drawer inside Simulator */}
          {showHudAwards && (
            <div className="fixed left-4 top-28 z-30 w-[min(420px,92vw)] bg-[#0b101b] border border-slate-800 rounded-xl p-4 shadow-2xl space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display text-sm font-bold text-white">
                    Metas del Circuito y Vitrina Local ({awardsWon.length})
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
                  <div className="text-slate-400 font-medium">Últimos trofeos guardados:</div>
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

          {/* Draggable, Compact & Independently Hideable Steering Wheel + Pedals + Gearbox */}
          <SimulatorControlsRig
            telemetry={telemetry}
            transmission={transmission}
            rigVisible={rigVisible}
            gearboxVisible={gearboxVisible}
            compactMode={rigCompact}
            resetLayoutSeq={resetHudLayoutSeq}
            onToggleRigVisible={setRigVisible}
            onToggleGearboxVisible={setGearboxVisible}
            onToggleCompactMode={() => setRigCompact((c) => !c)}
            onChangeTransmission={(mode) => setTransmission(mode)}
            onSelectGear={(gear) =>
              setRequestedGear((prev) => ({ seq: prev.seq + 1, gear }))
            }
            onShiftStep={(delta) =>
              setRequestedGear((prev) => ({ seq: prev.seq + 1, delta }))
            }
            onVirtualInput={handleVirtualInput}
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // TITLE MENU — DAYTIME SKY-BLUE YOUTHFUL INTERFACE + OFFICIAL COVER ART + DYNAMIC SUBMENU
  // =========================================================================
  const openSubMenuSection = (tab: TitleSubMenuTab) => {
    setActiveSubMenu(tab);
    const el = document.getElementById('submenu-juego');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#bae6fd] via-[#e6f5ff] to-[#f8fcff] text-slate-900 flex flex-col">
      {gmpQuotaBanner}
      {preTrackLaunchModalElement}
      <OfflineIndicator
        forceOfflineMode={isForcedLocalOffline}
        onSwitchToOnline={handleSelectOnlineGlobal}
      />

      {/* Strict 3-Zone Daytime Sky Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 md:px-10 py-4 border-b border-sky-200/90 bg-white/85 backdrop-blur-md sticky top-0 z-40">
        <a
          href="#inicio"
          className="font-display italic text-xl font-bold tracking-tight whitespace-nowrap shrink-0 drop-shadow-[0_1px_0_rgba(255,255,255,0.92)]"
        >
          <span className="bg-gradient-to-b from-[#0066FF] via-[#0047B8] to-[#002E7A] bg-clip-text text-transparent">
            GuateRutas{' '}
          </span>
          <span className="bg-gradient-to-b from-[#FF2E40] via-[#E10600] to-[#A80016] bg-clip-text text-transparent">
            3D{' '}
          </span>
          <span className="bg-gradient-to-r from-[#0052CC] to-[#0284C7] bg-clip-text text-transparent">
            y más allá
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => openSubMenuSection('CARATULA')}
            className={`hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubMenu === 'CARATULA' ? 'text-sky-700 underline' : ''
            }`}
          >
            Carátula
          </button>
          <button
            type="button"
            onClick={() => openSubMenuSection('PISTAS')}
            className={`hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubMenu === 'PISTAS' ? 'text-sky-700 underline' : ''
            }`}
          >
            Pistas 3D
          </button>
          <button
            type="button"
            onClick={() => openSubMenuSection('GARAJE')}
            className={`hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubMenu === 'GARAJE' ? 'text-sky-700 underline' : ''
            }`}
          >
            Garaje 3D
          </button>
          <button
            type="button"
            onClick={() => openSubMenuSection('VIDEOS')}
            className={`hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubMenu === 'VIDEOS' ? 'text-sky-700 underline' : ''
            }`}
          >
            Videos y Vida
          </button>
          <button
            type="button"
            onClick={() => openSubMenuSection('TROFEOS')}
            className={`hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubMenu === 'TROFEOS' ? 'text-sky-700 underline' : ''
            }`}
          >
            Trofeos
          </button>
          <a
            href="#livsform-lykke"
            className="hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            LivsForm Lykke
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleStartSimulation}
            className="px-4 py-2 text-xs md:text-sm font-bold text-white bg-sky-600 rounded-xl hover:bg-sky-500 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Jugar Ahora
          </button>
        </div>
      </header>

      <main id="inicio" className="flex-1 max-w-7xl w-full mx-auto px-6 md:px-10 py-8 space-y-10">
        {/* HERO SPLIT: Daytime Sky Youthful Setup + Official Video Game Cover Art */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-800">
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Paisajes 3D estilo Carátula</span>
                <span aria-hidden="true">·</span>
                <span>Paseo Libre o Carrera 4:00 Add Time</span>
                <span aria-hidden="true">·</span>
                <span>Avatares 3D y Patrimonio Cultural</span>
              </div>

              <div className="space-y-2">
                <h1 className="font-display italic text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] text-balance drop-shadow-[0_2px_0_rgba(255,255,255,0.92)]">
                  <span className="bg-gradient-to-b from-[#0066FF] via-[#0047B8] to-[#002B73] bg-clip-text text-transparent">
                    GuateRutas{' '}
                  </span>
                  <span className="bg-gradient-to-b from-[#FF3347] via-[#E10600] to-[#9E0014] bg-clip-text text-transparent">
                    3D{' '}
                  </span>
                  <span className="bg-gradient-to-r from-[#0052CC] via-[#0369A1] to-[#0284C7] bg-clip-text text-transparent">
                    y más allá
                  </span>
                </h1>
                <div className="flex items-center gap-1.5 max-w-xs" aria-hidden="true">
                  <div className="h-[3px] w-16 rounded-full bg-gradient-to-r from-[#0052CC] to-[#38BDF8] -skew-x-12" />
                  <div className="h-[3px] w-10 rounded-full bg-gradient-to-r from-[#E10600] to-[#FF4D5E] -skew-x-12" />
                </div>
                <p className="font-display italic text-lg sm:text-xl font-bold tracking-wide bg-gradient-to-r from-[#0047B8] via-[#0264B8] to-[#D90429] bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                  Juegos de 3D de Carros
                </p>
              </div>

              <p className="text-slate-700 text-base leading-relaxed max-w-xl">
                Recorre montañas, volcanes, palmeras, flores, ríos, lagos y mares con agua en
                movimiento junto a monumentos culturales como el{' '}
                <strong className="text-slate-900">Cristo Redentor en Brasil</strong>. Conduce
                carros, cuatrimotos y triciclos eléctricos con{' '}
                <strong className="text-sky-800">avatares 3D</strong>, ya sea en{' '}
                <strong className="text-slate-900">Local (Sin Internet)</strong> o en{' '}
                <strong className="text-sky-800">
                  Conexión a Internet Global + Pistas en Tiempo Real
                </strong>
                .
              </p>
            </div>

            {/* Youthful Sky-Daylight Control Card: 2-Option APK Modality + Alias + Launch */}
            <div className="bg-white/95 border border-sky-200 rounded-2xl p-5 space-y-4 shadow-md shadow-sky-900/5">
              {/* Clean 2-Option Modality Selector: Local (Sin Internet) vs Conexión Global + Pistas en Tiempo Real */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span>Modalidad de Juego:</span>
                  <span className="text-[11px] font-semibold text-sky-700">
                    {connectionUsageMode === 'LOCAL_OFFLINE'
                      ? 'Local (Sin Internet) activo'
                      : networkIsOnline
                        ? 'Conexión Global + Pistas en Tiempo Real activa'
                        : 'Sin señal — circuitos locales automáticos'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleSelectLocalOffline}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      connectionUsageMode === 'LOCAL_OFFLINE'
                        ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-sm'
                        : 'bg-sky-50/70 border-sky-200 text-slate-800 hover:bg-sky-100/80'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      <WifiOff
                        className={`w-4 h-4 shrink-0 ${
                          connectionUsageMode === 'LOCAL_OFFLINE'
                            ? 'text-slate-950'
                            : 'text-amber-600'
                        }`}
                      />
                      <span>Local (Sin Internet)</span>
                    </div>
                    <div
                      className={`text-[11px] mt-1 leading-snug ${
                        connectionUsageMode === 'LOCAL_OFFLINE'
                          ? 'text-slate-900'
                          : 'text-slate-600'
                      }`}
                    >
                      Circuitos 3D integrados, 1 o 2 jugadores y trofeos en tu dispositivo
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectOnlineGlobal}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      connectionUsageMode === 'ONLINE_GLOBAL'
                        ? 'bg-sky-600 border-sky-700 text-white shadow-sm'
                        : 'bg-sky-50/70 border-sky-200 text-slate-800 hover:bg-sky-100/80'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      <Globe
                        className={`w-4 h-4 shrink-0 ${
                          connectionUsageMode === 'ONLINE_GLOBAL'
                            ? 'text-amber-300'
                            : 'text-sky-600'
                        }`}
                      />
                      <span>Conexión a Internet Global + Pistas en Tiempo Real</span>
                    </div>
                    <div
                      className={`text-[11px] mt-1 leading-snug ${
                        connectionUsageMode === 'ONLINE_GLOBAL' ? 'text-sky-100' : 'text-slate-600'
                      }`}
                    >
                      Salas multijugador globales, Mapas Reales y rutas del mundo en vivo
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="hero-alias-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Apodo Juvenil de Piloto
                  </label>
                  <input
                    id="hero-alias-input"
                    type="text"
                    maxLength={18}
                    value={p1Alias}
                    onChange={(e) => setP1Alias(sanitizeGamerUsername(e.target.value))}
                    placeholder="Ej. RayoCielo7"
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="hero-mode-select"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Modo de Jugadores
                  </label>
                  <select
                    id="hero-mode-select"
                    value={sessionMode}
                    onChange={(e) => setSessionMode(e.target.value as SessionMode)}
                    className="w-full px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="SOLO">1 Jugador Local (Sin Internet o Con Internet)</option>
                    <option value="SPLIT_2P">2 Jugadores Local (Pantalla Dividida)</option>
                    <option value="ONLINE_MULTI">Sala Multijugador (Red Local o En Línea)</option>
                  </select>
                </div>
              </div>

              {sessionMode === 'ONLINE_MULTI' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="room-code-input"
                        className="block text-xs font-semibold text-slate-800 mb-1"
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
                        className="w-full px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 font-mono text-sm font-bold text-sky-800 uppercase focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex flex-col justify-end text-xs text-slate-600">
                      <span>
                        En línea puedes activar Mapas Reales y elegir otras pistas para la sala; sin
                        internet usa circuitos locales 3D.
                      </span>
                    </div>
                  </div>

                  <OnlineRealMapsSelector
                    compact
                    variant="day"
                    isOnline={isOnline}
                    realMapEnabled={realMapEnabled}
                    realMapTypeId={realMapTypeId}
                    customPlaceTrack={customPlaceTrack}
                    onToggleRealMap={setRealMapEnabled}
                    onChangeMapTypeId={setRealMapTypeId}
                    onSelectCustomPlaceTrack={setCustomPlaceTrack}
                    onQuotaExceeded={() => setGmpQuotaExceeded(true)}
                  />
                </div>
              )}

              {sessionMode === 'SPLIT_2P' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="p2-alias-input"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Apodo Jugador 2 (Flechas)
                    </label>
                    <input
                      id="p2-alias-input"
                      type="text"
                      maxLength={18}
                      value={p2Alias}
                      onChange={(e) => setP2Alias(sanitizeGamerUsername(e.target.value))}
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="p2-car-select"
                      className="block text-xs font-semibold text-slate-800 mb-1"
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
                      className="w-full px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
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

              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-300/90 px-3 py-2 text-xs text-emerald-950">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Escudo Anti-Ubicación y Anti-Crackers:</strong> tu ubicación física real,
                  GPS e IP jamás se leen ni se entregan a terceros, servidores ni otros jugadores.
                </span>
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span>Pista: </span>
                  <strong className="text-slate-900">{effectiveMap.name}</strong>
                  {isRealMapOverlayActive && (
                    <span className="text-sky-700 font-semibold"> (Mapa Real)</span>
                  )}
                  <span aria-hidden="true"> · </span>
                  <strong className="text-amber-700">{activeCar.name}</strong>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openSubMenuSection('VIDEOS')}
                    className="px-3.5 py-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Film className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>Videos y Vida</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-sm transition-transform active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Entrar a la Pista 3D</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Showcase: Official Daytime Video Game Cover Art + Circuit Preview Switcher */}
          <div className="lg:col-span-6 relative rounded-3xl overflow-hidden border-2 border-white bg-sky-200 min-h-[370px] flex flex-col justify-between shadow-xl shadow-sky-900/10">
            {heroVisualTab === 'CARATULA' ? (
              !brokenImages.cover_panoramic ? (
                <img
                  src={COVER_ART_PANORAMIC_URL}
                  alt="Carátula Oficial de Juego de 3D de Carros en día soleado"
                  onError={() =>
                    setBrokenImages((prev) => ({ ...prev, cover_panoramic: true }))
                  }
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-300 to-amber-200 flex items-center justify-center">
                  <Car className="w-16 h-16 text-white" />
                </div>
              )
            ) : !brokenImages[`hero_${activeMap.id}`] ? (
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
              <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-300 to-emerald-200 flex items-center justify-center">
                <Compass className="w-16 h-16 text-white" />
              </div>
            )}

            {/* Top Interactive Switcher inside Cover Art Frame */}
            <div className="relative z-10 p-4 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
                {heroVisualTab === 'CARATULA'
                  ? 'Carátula Oficial del Videojuego'
                  : activeMap.regionLabel}
              </span>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/90 backdrop-blur-md border border-sky-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setHeroVisualTab('CARATULA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    heroVisualTab === 'CARATULA'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-700 hover:text-sky-700'
                  }`}
                >
                  Carátula 3D
                </button>
                <button
                  type="button"
                  onClick={() => setHeroVisualTab('PISTA')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    heroVisualTab === 'PISTA'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-700 hover:text-sky-700'
                  }`}
                >
                  Vista de Pista
                </button>
              </div>
            </div>

            {/* Bottom Scrim with Title & Quick Play */}
            <div className="relative z-10 p-6 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-sky-300 font-semibold">
                  {heroVisualTab === 'CARATULA'
                    ? `Piloto: ${safeP1Display} · ${activeCar.name}`
                    : activeMap.adaptedPhotoCaption}
                </div>
                {heroVisualTab === 'CARATULA' ? (
                  <>
                    <h2 className="font-display italic text-2xl sm:text-3xl font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,18,56,0.75)]">
                      <span className="bg-gradient-to-b from-[#E0F2FE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                        GuateRutas{' '}
                      </span>
                      <span className="bg-gradient-to-b from-[#FF6B7A] via-[#EF233C] to-[#D90429] bg-clip-text text-transparent">
                        3D{' '}
                      </span>
                      <span className="bg-gradient-to-r from-[#BAE6FD] to-[#38BDF8] bg-clip-text text-transparent">
                        y más allá
                      </span>
                    </h2>
                    <div className="font-display italic text-sm sm:text-base font-bold tracking-wide bg-gradient-to-r from-[#93C5FD] via-[#E0F2FE] to-[#FF6B7A] bg-clip-text text-transparent">
                      Juegos de 3D de Carros
                    </div>
                  </>
                ) : (
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                    {effectiveMap.name}
                  </h2>
                )}
                <p className="text-xs text-sky-100/90 max-w-md">
                  {heroVisualTab === 'CARATULA'
                    ? `Circuito listo: ${effectiveMap.name} · ${WORLD_MAPS_CATALOG.length} pistas locales y ${CARS_CATALOG.length} vehículos 3D.`
                    : `Tramos: ${activeMap.roads.slice(0, 3).map((r) => r.name).join(' · ')}`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartSimulation}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-transform hover:scale-105 cursor-pointer whitespace-nowrap shrink-0"
              >
                ¡Arrancar Carrera! →
              </button>
            </div>
          </div>
        </section>

        {/*DYNAMIC SUB-MENU BAR — YOUTHFUL DAYTIME SKY NAVIGATION */}
        <section id="submenu-juego" className="space-y-6 scroll-mt-20">
          <div className="bg-white/95 border border-sky-200 rounded-2xl p-3 sm:p-4 shadow-md shadow-sky-900/5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                  Submenú Dinámico del Videojuego
                </h2>
                <p className="text-xs text-slate-600">
                  Explora la carátula oficial, cambia de pista 3D, personaliza tu carro o revisa tus
                  trofeos con un toque.
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-sky-800 font-semibold">
                {CARS_CATALOG.length} Vehículos · {WORLD_MAPS_CATALOG.length} Pistas ·{' '}
                {awardsWon.length} Trofeos
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Secciones del videojuego"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-sky-100/80 rounded-xl border border-sky-200/80"
            >
              {(
                [
                  { id: 'CARATULA', label: 'Carátula y Rápido', icon: Sun },
                  { id: 'PISTAS', label: `Pistas 3D (${WORLD_MAPS_CATALOG.length})`, icon: MapIcon },
                  { id: 'GARAJE', label: `Garaje 3D (${CARS_CATALOG.length})`, icon: Car },
                  { id: 'VIDEOS', label: 'Videos y Vida', icon: Film },
                  { id: 'TROFEOS', label: 'Copa y Trofeos', icon: Trophy },
                  { id: 'SALAS', label: 'Salas y Mandos', icon: Users },
                ] as Array<{
                  id: TitleSubMenuTab;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                }>
              ).map((item) => {
                const IconComp = item.icon;
                const active = activeSubMenu === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveSubMenu(item.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-sky-600 text-white shadow-sm scale-[1.01]'
                        : 'bg-white/70 text-slate-700 hover:bg-white hover:text-sky-700'
                    }`}
                  >
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : 'text-sky-600'}`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =============================================================== */}
          {/* SUBMENU TAB 1: CARÁTULA DEL VIDEOJUEGO E INICIO RÁPIDO JUVENIL   */}
          {/* =============================================================== */}
          {activeSubMenu === 'CARATULA' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Official Vertical 3:4 Box Cover Art Card */}
              <div className="lg:col-span-4 bg-white border-2 border-sky-200 rounded-3xl p-4 shadow-md shadow-sky-900/5 flex flex-col justify-between gap-4">
                <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-sky-200 border border-sky-300 shadow-inner">
                  {!brokenImages.cover_box ? (
                    <img
                      src={COVER_ART_BOX_URL}
                      alt="Portada Oficial Edición Día de Juego de 3D de Carros"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, cover_box: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-sky-400 via-sky-200 to-amber-200 flex items-center justify-center">
                      <Car className="w-14 h-14 text-sky-900" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-white space-y-0.5">
                    <div className="text-[11px] font-semibold text-amber-300">
                      Carátula Oficial · Edición Juvenil
                    </div>
                    <div className="font-display italic text-lg font-bold leading-tight drop-shadow-[0_2px_5px_rgba(0,18,56,0.75)]">
                      <span className="bg-gradient-to-b from-[#E0F2FE] via-[#60A5FA] to-[#2563EB] bg-clip-text text-transparent">
                        GuateRutas{' '}
                      </span>
                      <span className="bg-gradient-to-b from-[#FF6B7A] via-[#EF233C] to-[#D90429] bg-clip-text text-transparent">
                        3D{' '}
                      </span>
                      <span className="bg-gradient-to-r from-[#BAE6FD] to-[#38BDF8] bg-clip-text text-transparent">
                        y más allá
                      </span>
                    </div>
                    <div className="font-display italic text-xs font-bold tracking-wide bg-gradient-to-r from-[#93C5FD] via-[#E0F2FE] to-[#FF6B7A] bg-clip-text text-transparent">
                      Juegos de 3D de Carros
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Modalidad actual</span>
                    <strong className="text-sky-700">
                      {connectionUsageMode === 'LOCAL_OFFLINE'
                        ? 'Local (Sin Internet)'
                        : 'Conexión Global + Pistas en Vivo'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Jugar Ahora en {effectiveMap.name}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Daytime Quick-Configurator */}
              <div className="lg:col-span-8 bg-white/95 border border-sky-200 rounded-3xl p-6 shadow-md shadow-sky-900/5 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-4">
                    <div>
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                        Preparación Rápida de Carrera
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600">
                        Ajusta el cielo del día, tu vehículo 3D y tu pista favorita antes de salir a
                        correr.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-sky-50 border border-sky-200 shrink-0">
                      {(
                        [
                          { id: 'DAY', label: 'Cielo de Día' },
                          { id: 'GOLDEN', label: 'Atardecer' },
                          { id: 'NIGHT', label: 'Noche' },
                        ] as Array<{ id: TimeOfDay; label: string }>
                      ).map((tod) => (
                        <button
                          key={tod.id}
                          type="button"
                          onClick={() => setTimeOfDay(tod.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            timeOfDay === tod.id
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'text-slate-700 hover:text-sky-700'
                          }`}
                        >
                          {tod.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Vehicle Selector (Featuring Electric Quad-Trike & Solar Electric Tricycle!) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        1. Elige Rápido tu Transporte con Avatar 3D ({activeCar.name}):
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveSubMenu('GARAJE')}
                        className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                      >
                        Abrir Garaje 360° ({CARS_CATALOG.length}) →
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {CARS_CATALOG.slice(0, 6).map((car) => {
                        const isPicked = car.id === p1CarId;
                        return (
                          <button
                            key={car.id}
                            type="button"
                            onClick={() => handleSelectCar(car.id)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isPicked
                                ? 'bg-sky-600 border-sky-700 text-white shadow-sm'
                                : 'bg-sky-50/70 border-sky-200 text-slate-800 hover:bg-sky-100'
                            }`}
                          >
                            <div className="text-xs font-bold truncate">{car.name}</div>
                            <div
                              className={`text-[11px] truncate mt-0.5 ${
                                isPicked ? 'text-amber-200 font-semibold' : 'text-sky-800 font-medium'
                              }`}
                            >
                              Valor: {car.valueMessage}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Circuit Selector */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        2. Elige Rápido tu Pista 3D ({effectiveMap.name}):
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveSubMenu('PISTAS')}
                        className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                      >
                        Ver las {WORLD_MAPS_CATALOG.length} Pistas y Mapas Reales →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {WORLD_MAPS_CATALOG.slice(0, 4).map((m) => {
                        const isPicked = !customPlaceTrack && m.id === selectedMapId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setCustomPlaceTrack(null);
                              setSelectedMapId(m.id);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isPicked
                                ? 'bg-amber-400/90 border-amber-500 text-slate-950 shadow-sm'
                                : 'bg-sky-50/70 border-sky-200 text-slate-800 hover:bg-sky-100'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{m.name}</div>
                              <div
                                className={`text-[11px] truncate ${
                                  isPicked ? 'text-slate-800' : 'text-slate-600'
                                }`}
                              >
                                {m.country} · {m.checkpoints.length} metas
                              </div>
                            </div>
                            <span className="text-xs font-bold shrink-0">
                              {isPicked ? 'Lista' : 'Elegir'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Quick Summary Strip */}
                <div className="pt-4 border-t border-sky-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                    <div className="text-slate-500">Cielo Activo</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {timeOfDay === 'DAY'
                        ? 'Día Soleado'
                        : timeOfDay === 'GOLDEN'
                          ? 'Atardecer Dorado'
                          : 'Noche Clara'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                    <div className="text-slate-500">Transmisión</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {transmission === 'AT' ? 'Automática (D/R)' : 'Mecánica (1–6)'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                    <div className="text-slate-500">Controles (H)</div>
                    <div className="font-bold text-slate-900 mt-0.5">Móviles y Compactos</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80">
                    <div className="text-slate-500">Modalidad</div>
                    <div className="font-bold text-sky-700 mt-0.5">
                      {connectionUsageMode === 'LOCAL_OFFLINE'
                        ? 'Local (Sin Internet)'
                        : 'Internet Global + Pistas'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SUBMENU TAB 2: PISTAS 3D Y MAPAS REALES EN LÍNEA                 */}
          {/* =============================================================== */}
          {activeSubMenu === 'PISTAS' && (
            <div id="circuitos" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/90 border border-sky-200 rounded-2xl p-5 shadow-sm">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">
                    Circuitos Escénicos 3D y Pistas del Mundo
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Todos los escenarios locales funcionan con o sin internet; en línea también
                    puedes activar Mapas Reales y buscar nuevas pistas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-sky-100/80 border border-sky-200 rounded-xl">
                  {REGION_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRegionFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        regionFilter === tab.id
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-700 hover:text-sky-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Online Real Maps & Custom Tracks Selector (Daytime Sky Theme) */}
              <OnlineRealMapsSelector
                variant="day"
                isOnline={isOnline}
                realMapEnabled={realMapEnabled}
                realMapTypeId={realMapTypeId}
                customPlaceTrack={customPlaceTrack}
                onToggleRealMap={setRealMapEnabled}
                onChangeMapTypeId={setRealMapTypeId}
                onSelectCustomPlaceTrack={setCustomPlaceTrack}
                onQuotaExceeded={() => setGmpQuotaExceeded(true)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMaps.map((m) => {
                  const isSelected = !customPlaceTrack && m.id === selectedMapId;
                  const cardImgKey = `card_${m.id}`;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setCustomPlaceTrack(null);
                        setSelectedMapId(m.id);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCustomPlaceTrack(null);
                          setSelectedMapId(m.id);
                        }
                      }}
                      className={`cursor-pointer text-left rounded-2xl overflow-hidden border-2 transition-all flex flex-col justify-between shadow-sm ${
                        isSelected
                          ? 'bg-sky-50 border-sky-600 shadow-md'
                          : 'bg-white border-sky-200/90 hover:border-sky-400'
                      }`}
                    >
                      <div>
                        <div className="relative h-40 w-full bg-sky-200 overflow-hidden border-b border-sky-200">
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
                            <div className="w-full h-full bg-gradient-to-br from-sky-300 to-sky-100 flex items-center justify-center">
                              <MapIcon className="w-8 h-8 text-sky-700" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 px-3.5 py-2 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent text-[11px] text-white truncate">
                            {m.adaptedPhotoCaption}
                          </div>
                        </div>

                        <div className="p-4 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Globe className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span>{m.country}</span>
                            <span aria-hidden="true">·</span>
                            <span>{m.checkpoints.length} metas con trofeo</span>
                          </div>
                          <h4 className="font-display text-lg font-bold text-slate-900">
                            {m.name}
                          </h4>
                          <div className="text-[11px] font-bold text-amber-700">
                            Patrimonio: {m.culturalHeritageTitle}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{m.description}</p>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-2 border-t border-sky-100 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 truncate">
                          Paseo Libre o Carrera 4:00
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomPlaceTrack(null);
                            setSelectedMapId(m.id);
                            handleStartSimulation();
                          }}
                          className="font-bold text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isSelected ? 'Conducir Aquí →' : 'Iniciar Pista →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SUBMENU TAB 3: GARAJE 3D INTERACTIVO DE DÍA                      */}
          {/* =============================================================== */}
          {activeSubMenu === 'GARAJE' && (
            <div id="garaje" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/90 border border-sky-200 rounded-2xl p-5 shadow-sm">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">
                    Garaje 3D: Cuatrimotos y Triciclos Eléctricos, Bicicletas, Tuk Tuk, Pickup y Carros
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Todos los vehículos son manejados por avatares 3D estilo carátula y portan un
                    mensaje positivo de valores en su carrocería.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-sky-100/80 border border-sky-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTransmission('MT')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      transmission === 'MT'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-sky-800'
                    }`}
                  >
                    Caja Mecánica (1–6 + R)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransmission('AT')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      transmission === 'AT'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-700 hover:text-sky-800'
                    }`}
                  >
                    Caja Automática (D / N / R)
                  </button>
                </div>
              </div>

              {/* 360° Sunny Showroom + Paint Swatches */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-7 min-h-[290px]">
                  <VehiclePreview3D carId={p1CarId} paintHex={p1Paint} />
                </div>

                <div className="lg:col-span-5 bg-white border border-sky-200 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>{activeCar.brand}</span>
                      <span className="font-mono tabular-nums text-sky-700">
                        {activeCar.drivetrain} · {activeCar.yearTag}
                      </span>
                    </div>
                    <h4 className="font-display text-2xl font-bold text-slate-900">
                      {activeCar.name}
                    </h4>
                    <div className="text-xs font-bold text-emerald-700">
                      Avatar 3D al volante · Mensaje: “{activeCar.valueMessage}”
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {activeCar.summary}
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-sky-100 text-xs">
                      <div>
                        <div className="text-slate-500">Potencia</div>
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {activeCar.horsepower} HP
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Vel. Máx</div>
                        <div className="font-mono tabular-nums font-bold text-sky-700">
                          {activeCar.topSpeedKmh} km/h
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Corte Motor</div>
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {activeCar.redlineRpm} RPM
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Paint Swatches */}
                  <div className="space-y-2 pt-2 border-t border-sky-100">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-sky-600" />
                      <span>Color de carrocería en 3D:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {PAINT_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setP1Paint(sw.hex)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            p1Paint === sw.hex
                              ? 'border-sky-600 bg-sky-100 text-sky-950'
                              : 'border-sky-200 bg-sky-50/60 text-slate-700 hover:border-sky-400'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-slate-400"
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
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Conducir {activeCar.name} →
                  </button>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-sky-200 rounded-xl shadow-sm">
                  {(
                    [
                      { id: 'ALL', label: `Todos (${CARS_CATALOG.length})` },
                      {
                        id: 'ELECTRIC_TRIKES',
                        label: 'Cuatrimoto y Triciclo Eléctrico (2)',
                      },
                      { id: 'URBAN_SPECIAL', label: 'Bicicleta, Tuk Tuk, Pickup y Camión (4)' },
                      { id: 'CARS', label: 'Carros y Deportivos (8)' },
                    ] as const
                  ).map((vf) => (
                    <button
                      key={vf.id}
                      type="button"
                      onClick={() => setVehicleFilter(vf.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        vehicleFilter === vf.id
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-700 hover:text-sky-700'
                      }`}
                    >
                      {vf.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-600">
                  Cada vehículo incluye Avatar 3D al volante y mensaje de valores
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {CARS_CATALOG.filter((car) => {
                  const isElectricTrike =
                    car.id === 'cuatrimoto_el' || car.id === 'triciclo_el';
                  const isSpecial =
                    car.id === 'tuk_tuk' ||
                    car.id === 'bicicleta' ||
                    car.id === 'pickup' ||
                    car.id === 'camion';
                  if (vehicleFilter === 'ELECTRIC_TRIKES') return isElectricTrike;
                  if (vehicleFilter === 'URBAN_SPECIAL') return isSpecial;
                  if (vehicleFilter === 'CARS') return !isSpecial && !isElectricTrike;
                  return true;
                }).map((car) => {
                  const selected = car.id === p1CarId;
                  return (
                    <button
                      key={car.id}
                      type="button"
                      onClick={() => handleSelectCar(car.id)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-sm ${
                        selected
                          ? 'bg-sky-50 border-sky-600 shadow-md'
                          : 'bg-white border-sky-200/90 hover:border-sky-400'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                          <span>{car.brand}</span>
                          <span className="font-mono tabular-nums text-sky-700">
                            {car.drivetrain}
                          </span>
                        </div>
                        <h4 className="font-display text-lg font-bold text-slate-900">
                          {car.name}
                        </h4>
                        <div className="text-xs font-bold text-emerald-700">
                          Valor: {car.valueMessage}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">{car.summary}</p>
                      </div>

                      <div className="pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-700 font-mono tabular-nums font-semibold">
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
            </div>
          )}

          {/* =============================================================== */}
          {/* SUBMENU TAB: VIDEOS DEL JUEGO, VALORES, PROTECCIÓN Y VIDA       */}
          {/* =============================================================== */}
          {activeSubMenu === 'VIDEOS' && (
            <ValuesVideoAndVoiceStudio coverArtUrl={COVER_ART_PANORAMIC_URL} isOnline={isOnline} />
          )}

          {/* =============================================================== */}
          {/* SUBMENU TAB 4: COPA Y TROFEOS GUARDADOS LOCALMENTE               */}
          {/* =============================================================== */}
          {activeSubMenu === 'TROFEOS' && (
            <div id="premios" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 bg-white border-2 border-amber-300 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="relative h-56 w-full bg-sky-100 overflow-hidden border-b border-amber-200">
                      {!brokenImages.grand_trophy_showcase ? (
                        <img
                          src={REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl}
                          alt="Dos Madres Educadoras de San Lolek entregando el Gran Trofeo en el podio virtual"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, grand_trophy_showcase: true }))
                          }
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-200 to-sky-100 flex items-center justify-center">
                          <Trophy className="w-12 h-12 text-amber-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 space-y-2">
                      <div className="text-xs font-bold text-amber-700">
                        Premio Principal al Final de Cada Ciclo y de Todas las Pistas
                      </div>
                      <h3 className="font-display text-xl font-bold text-slate-900">
                        {GRAND_FINALE_AWARD_TITLE}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        En el podio deportivo imaginario al cierre de cada circuito y del campeonato
                        general, las{' '}
                        <strong className="text-slate-900">{GRAND_FINALE_PRESENTER}</strong> (con
                        hábito blanco con azul, viseras para el sol y lentes de sol, junto a los niños
                        invitados animando) entregan el trofeo mayor a{' '}
                        <strong className="text-sky-700">{safeP1Display}</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-3 border-t border-amber-100 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Ciclos completados: {completedCircuitCount} / {WORLD_MAPS_CATALOG.length} pistas
                    </span>
                    <button
                      type="button"
                      onClick={handleStartSimulation}
                      className="font-bold text-sky-700 hover:text-sky-900 whitespace-nowrap cursor-pointer"
                    >
                      Competir por el Trofeo →
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white border border-sky-200 rounded-2xl p-6 flex flex-col justify-between gap-4 shadow-sm">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-bold text-sky-700">
                        Etapas Deportivas en {effectiveMap.name}
                      </div>
                      <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                        Orden de Metas y Medallas de la Pista Seleccionada
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {activeMapCheckpointPlans.map((pl) => (
                        <div
                          key={`stage_card_${pl.checkpointNumber}`}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            pl.isGrandFinale
                              ? 'bg-amber-50 border-amber-300 text-slate-900 font-semibold'
                              : 'bg-sky-50/70 border-sky-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Trophy
                              className={`w-4 h-4 shrink-0 ${
                                pl.isGrandFinale ? 'text-amber-600' : 'text-sky-600'
                              }`}
                            />
                            <div className="truncate">
                              <span className="font-bold">Meta {pl.checkpointNumber}:</span>{' '}
                              <span>{pl.awardTitle}</span>
                            </div>
                          </div>
                          <span className="text-slate-600 shrink-0">{pl.presenterName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-sky-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      Piloto activo: <strong className="text-slate-900">{safeP1Display}</strong>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-amber-700">
                      Trofeos guardados en tu equipo: {awardsWon.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel de Logros Especiales (Persistencia en Juego Local) */}
              {(() => {
                const totalKm = persistenceStats.totalKilometersDriven;
                const unlockedCount = Math.min(
                  CARS_CATALOG.length,
                  new Set(persistenceStats.unlockedCarIds).size,
                );
                const totalMedals = Math.max(
                  persistenceStats.totalMedalsObtained,
                  awardsWon.length,
                  raceHistory.reduce((sum, r) => sum + r.totalMedalsEarned, 0),
                );
                const kmGoal = totalKm < 5 ? 5 : totalKm < 15 ? 15 : totalKm < 30 ? 30 : 60;
                const kmPct = Math.min(100, Math.round((totalKm / kmGoal) * 100));
                const vehiclesPct = Math.min(
                  100,
                  Math.round((unlockedCount / CARS_CATALOG.length) * 100),
                );
                const medalGoal =
                  totalMedals < 5 ? 5 : totalMedals < 15 ? 15 : totalMedals < 30 ? 30 : 60;
                const medalsPct = Math.min(100, Math.round((totalMedals / medalGoal) * 100));

                const nextLockedRule = VEHICLE_UNLOCK_MILESTONES.find(
                  (r) => !persistenceStats.unlockedCarIds.includes(r.carId),
                );
                const nextLockedCarName = nextLockedRule
                  ? getCarById(nextLockedRule.carId).name
                  : null;

                const specialAchievementsList = [
                  {
                    id: 'ach_km_1',
                    title: 'Primeros Pasos en Ruta 3D',
                    category: 'Kilómetros recorridos',
                    description:
                      'Recorre tus primeros 2.00 km acumulando distancia en Paseo Libre o Carrera Add Time.',
                    currentLabel: `${totalKm.toFixed(2)} / 2.00 km`,
                    pct: Math.min(100, Math.round((totalKm / 2) * 100)),
                    unlocked: totalKm >= 2,
                    actionLabel: 'Salir a Rodar →',
                    onAction: handleStartSimulation,
                  },
                  {
                    id: 'ach_km_15',
                    title: 'Gran Viajero de Paisajes y Volcanes',
                    category: 'Kilómetros recorridos',
                    description:
                      'Alcanza 15.00 km totales guardados localmente explorando ciudades, costas y montañas.',
                    currentLabel: `${totalKm.toFixed(2)} / 15.00 km`,
                    pct: Math.min(100, Math.round((totalKm / 15) * 100)),
                    unlocked: totalKm >= 15,
                    actionLabel: 'Sumar Kilómetros →',
                    onAction: handleStartSimulation,
                  },
                  {
                    id: 'ach_cars_10',
                    title: 'Escudería Diversa en Garaje Local',
                    category: 'Vehículos desbloqueados',
                    description:
                      'Desbloquea al menos 10 transportes 3D combinando kilómetros recorridos y medallas.',
                    currentLabel: `${unlockedCount} / 10 vehículos`,
                    pct: Math.min(100, Math.round((unlockedCount / 10) * 100)),
                    unlocked: unlockedCount >= 10,
                    actionLabel: 'Ver Garaje 3D →',
                    onAction: () => setActiveSubMenu('GARAJE'),
                  },
                  {
                    id: 'ach_cars_all',
                    title: 'Colección Completa de los 14 Vehículos 3D',
                    category: 'Vehículos desbloqueados',
                    description: `Desbloquea la flota completa de ${CARS_CATALOG.length} vehículos con avatares 3D y mensajes de valores.`,
                    currentLabel: `${unlockedCount} / ${CARS_CATALOG.length} vehículos`,
                    pct: vehiclesPct,
                    unlocked: unlockedCount >= CARS_CATALOG.length,
                    actionLabel: 'Abrir Garaje 3D →',
                    onAction: () => setActiveSubMenu('GARAJE'),
                  },
                  {
                    id: 'ach_medals_10',
                    title: 'Medallista Solidario · Todos Ganan',
                    category: 'Medallas obtenidas',
                    description:
                      'Acumula 10 medallas deportivas cruzando metas escénicas o carreras de 4 minutos.',
                    currentLabel: `${totalMedals} / 10 medallas`,
                    pct: Math.min(100, Math.round((totalMedals / 10) * 100)),
                    unlocked: totalMedals >= 10,
                    actionLabel: 'Competir Ahora →',
                    onAction: handleStartSimulation,
                  },
                  {
                    id: 'ach_medals_25',
                    title: 'Leyenda Local de Copa San Lolek',
                    category: 'Medallas obtenidas',
                    description:
                      'Obtén 25 medallas acumuladas en tu dispositivo para coronar tu historial local.',
                    currentLabel: `${totalMedals} / 25 medallas`,
                    pct: Math.min(100, Math.round((totalMedals / 25) * 100)),
                    unlocked: totalMedals >= 25,
                    actionLabel: 'Buscar Más Metas →',
                    onAction: handleStartSimulation,
                  },
                ];

                const visibleAchievements = specialAchievementsList.filter((item) => {
                  if (achievementsFilter === 'UNLOCKED') return item.unlocked;
                  if (achievementsFilter === 'IN_PROGRESS') return !item.unlocked;
                  return true;
                });

                const unlockedAchievementsCount = specialAchievementsList.filter(
                  (a) => a.unlocked,
                ).length;

                return (
                  <div className="bg-white border border-sky-200 rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-sky-100">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-sky-700 font-semibold">
                          <span>Persistencia en Juego Local</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {unlockedAchievementsCount} de {specialAchievementsList.length} logros completados
                          </span>
                        </div>
                        <h3 className="font-display text-2xl font-bold text-slate-900">
                          Logros Especiales
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                          Tu avance en kilómetros, vehículos desbloqueados y medallas se guarda
                          automáticamente en este dispositivo, incluso jugando en modalidad Local
                          (Sin Internet).
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 p-1 bg-sky-100/80 border border-sky-200 rounded-xl">
                          {(
                            [
                              { id: 'ALL', label: 'Todos' },
                              { id: 'UNLOCKED', label: 'Completados' },
                              { id: 'IN_PROGRESS', label: 'En Progreso' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setAchievementsFilter(tab.id)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                achievementsFilter === tab.id
                                  ? 'bg-sky-600 text-white shadow-sm'
                                  : 'text-slate-700 hover:text-sky-800'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleStartSimulation}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
                        >
                          Sumar Progreso en Pista →
                        </button>
                      </div>
                    </div>

                    {/* 3 Core Local Persistence Indicators */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* 1. Kilómetros totales recorridos */}
                      <div className="p-5 rounded-xl bg-sky-50/60 border border-sky-200 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                            <span>Kilómetros totales recorridos</span>
                            <Gauge className="w-4 h-4 text-sky-600 shrink-0" />
                          </div>
                          <div className="font-display text-3xl font-bold text-slate-950 font-mono tabular-nums">
                            {totalKm.toFixed(2)} km
                          </div>
                          <div className="text-xs text-slate-600">
                            Siguiente meta de ruta:{' '}
                            <span className="font-mono tabular-nums font-semibold text-sky-800">
                              {kmGoal.toFixed(0)} km
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-sky-200/80 overflow-hidden">
                            <div
                              className="h-full bg-sky-600 rounded-full transition-transform duration-200 origin-left"
                              style={{ transform: `scaleX(${kmPct / 100})` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                            <span>Guardado en tu equipo</span>
                            <span>{kmPct}%</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Vehículos desbloqueados */}
                      <div className="p-5 rounded-xl bg-sky-50/60 border border-sky-200 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                            <span>Vehículos desbloqueados</span>
                            <Car className="w-4 h-4 text-emerald-600 shrink-0" />
                          </div>
                          <div className="font-display text-3xl font-bold text-slate-950 font-mono tabular-nums">
                            {unlockedCount} / {CARS_CATALOG.length}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {nextLockedRule && nextLockedCarName ? (
                              <>
                                Próximo: <strong className="text-slate-800">{nextLockedCarName}</strong> (
                                <span className="font-mono tabular-nums">
                                  {nextLockedRule.minKm} km
                                </span>{' '}
                                o{' '}
                                <span className="font-mono tabular-nums">
                                  {nextLockedRule.minMedals}
                                </span>{' '}
                                medallas)
                              </>
                            ) : (
                              <span className="text-emerald-700 font-semibold">
                                ¡Garaje completo de {CARS_CATALOG.length} transportes desbloqueado!
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-emerald-200/70 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-transform duration-200 origin-left"
                              style={{ transform: `scaleX(${vehiclesPct / 100})` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                            <span>Flota local 3D</span>
                            <span>{vehiclesPct}%</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Total de medallas obtenidas */}
                      <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
                            <span>Total de medallas obtenidas</span>
                            <Award className="w-4 h-4 text-amber-600 shrink-0" />
                          </div>
                          <div className="font-display text-3xl font-bold text-slate-950 font-mono tabular-nums">
                            {totalMedals}
                          </div>
                          <div className="text-xs text-slate-700">
                            Siguiente escalón de honor:{' '}
                            <span className="font-mono tabular-nums font-semibold text-amber-800">
                              {medalGoal} medallas
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full bg-amber-200/80 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-transform duration-200 origin-left"
                              style={{ transform: `scaleX(${medalsPct / 100})` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums">
                            <span>Acumulado histórico permanente</span>
                            <span>{medalsPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Special Achievement Milestones */}
                    <div className="pt-2 border-t border-sky-100 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">
                          Desafíos de Persistencia Local:
                        </span>
                        <span>
                          Conduce en Paseo Libre o Carrera Add Time para desbloquear nuevos vehículos y metas
                        </span>
                      </div>

                      {visibleAchievements.length === 0 ? (
                        <div className="py-6 px-4 rounded-xl bg-sky-50/60 border border-dashed border-sky-200 text-center text-xs text-slate-600">
                          No hay logros en este filtro todavía. Cambia a &ldquo;Todos&rdquo; o entra a una pista 3D para avanzar.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {visibleAchievements.map((ach) => (
                            <div
                              key={ach.id}
                              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                ach.unlocked
                                  ? 'bg-emerald-50/50 border-emerald-300'
                                  : 'bg-white border-sky-200/90'
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                  <span>{ach.category}</span>
                                  <span
                                    className={`font-semibold ${
                                      ach.unlocked ? 'text-emerald-700' : 'text-sky-700'
                                    }`}
                                  >
                                    {ach.unlocked ? 'Completado' : 'En progreso'}
                                  </span>
                                </div>
                                <h4 className="font-display text-base font-bold text-slate-900">
                                  {ach.title}
                                </h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {ach.description}
                                </p>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-sky-100">
                                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                                  <span className="font-semibold text-slate-800">
                                    {ach.currentLabel}
                                  </span>
                                  <span className="text-slate-500">{ach.pct}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-transform duration-200 origin-left ${
                                      ach.unlocked ? 'bg-emerald-600' : 'bg-sky-600'
                                    }`}
                                    style={{ transform: `scaleX(${ach.pct / 100})` }}
                                  />
                                </div>
                                <div className="flex justify-end pt-0.5">
                                  <button
                                    type="button"
                                    onClick={ach.onAction}
                                    className="text-xs font-bold text-sky-700 hover:text-sky-950 whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    {ach.actionLabel}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Historial de Resultados de Carreras Anteriores */}
              <div className="bg-white border border-sky-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                      <History className="w-4 h-4" />
                      <span>Registro Histórico de Carreras</span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                      Historial de Resultados Anteriores
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Consulta la fecha, pista recorrida y el total de medallas ganadas en tus
                      carreras previas.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-slate-700">
                      Carreras:{' '}
                      <strong className="font-mono tabular-nums text-sky-800">
                        {raceHistory.length}
                      </strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-slate-800 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Medallas totales:{' '}
                        <strong className="font-mono tabular-nums text-amber-800">
                          {raceHistory.reduce((sum, r) => sum + r.totalMedalsEarned, 0)}
                        </strong>
                      </span>
                    </div>
                    {raceHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRaceHistory([])}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-xs font-semibold text-slate-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Limpiar historial de carreras"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Limpiar</span>
                      </button>
                    )}
                  </div>
                </div>

                {raceHistory.length === 0 ? (
                  <div className="py-8 px-4 rounded-xl bg-sky-50/60 border border-dashed border-sky-200 text-center space-y-3">
                    <Award className="w-9 h-9 text-amber-500 mx-auto" />
                    <div className="space-y-1">
                      <div className="font-display text-base font-bold text-slate-900">
                        Aún no hay carreras registradas en el historial
                      </div>
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        Cruza las metas de cualquier ciudad o completa una Carrera Add Time de 4
                        minutos para guardar automáticamente la fecha, pista y medallas ganadas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartSimulation}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      Iniciar Pista Ahora →
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-sky-200 text-slate-500 font-semibold text-xs">
                          <th className="py-2.5 pr-4">Fecha</th>
                          <th className="py-2.5 px-4">Mapa / Pista</th>
                          <th className="py-2.5 px-4">Modalidad</th>
                          <th className="py-2.5 pl-4 text-right">Total Medallas Ganadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100">
                        {raceHistory.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-sky-50/70 transition-colors text-slate-800"
                          >
                            <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-600 font-mono tabular-nums">
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{formatRaceHistoryDate(item.dateIso, item.timestamp)}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <MapIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>{item.mapName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                              {item.driveMode === 'RACE_4MIN'
                                ? `Carrera Add Time${
                                    item.elapsedSec ? ` (${formatRaceClock(item.elapsedSec)})` : ''
                                  }`
                                : item.driveMode === 'FREE_ROAM'
                                  ? 'Paseo Libre'
                                  : 'Circuito 3D'}
                            </td>
                            <td className="py-3 pl-4 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-mono tabular-nums font-bold text-xs">
                                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  {item.totalMedalsEarned}{' '}
                                  {item.totalMedalsEarned === 1 ? 'medalla' : 'medallas'}
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SUBMENU TAB 5: SALAS LOCALES / ONLINE Y MANDOS COMPACTOS         */}
          {/* =============================================================== */}
          {activeSubMenu === 'SALAS' && (
            <div id="usuarios" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white border border-sky-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-sky-700 text-xs font-bold">
                  <Users className="w-4 h-4" />
                  <span>Modalidad Local y Multijugador</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  1 Jugador, 2 Jugadores Pantalla Dividida y Salas por Apodo
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Elige en cualquier momento entre{' '}
                  <strong>Local (Sin Internet)</strong> para correr con los circuitos 3D integrados
                  en tu equipo, o{' '}
                  <strong>Conexión a Internet Global + Pistas en Tiempo Real</strong> para unirte a
                  salas en línea y manejar sobre mapas reales.
                </p>

                {!isOnline ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                    <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Local (Sin Internet) activo:</strong> todos los circuitos 3D, 1
                      Jugador, Pantalla Dividida de 2 Jugadores y tus trofeos funcionan al 100% de
                      forma local.
                    </span>
                  </div>
                ) : activeRoomsInfo.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-bold text-slate-700">
                      Salas en línea activas ahora:
                    </div>
                    {activeRoomsInfo.map((rm) => {
                      const [rCode, rMap] = rm.roomKey.split('::');
                      const mapObj = getMapById(rMap);
                      const trackLabel = rm.customTrack ? rm.customTrack.name : mapObj.name;
                      return (
                        <div
                          key={rm.roomKey}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-sky-800">{rCode}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-900 font-semibold">{trackLabel}</span>
                            {rm.realMapMode && (
                              <span className="text-sky-700 font-bold"> (Mapa Real)</span>
                            )}
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-600">{rm.aliases.join(', ')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionMode('ONLINE_MULTI');
                              setRoomCode(rCode);
                              if (rm.customTrack) {
                                setCustomPlaceTrack(rm.customTrack);
                                setRealMapEnabled(true);
                              } else {
                                setCustomPlaceTrack(null);
                                setSelectedMapId(mapObj.id);
                                setRealMapEnabled(Boolean(rm.realMapMode));
                              }
                              handleStartSimulation();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Unirse ({rm.count})
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-slate-700">
                    Sala lista para crear o unirte con código{' '}
                    <strong className="text-sky-800 font-mono">{roomCode}</strong> y tu apodo{' '}
                    <strong className="text-slate-900">{safeP1Display}</strong>.
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Privacidad Total en Salas:</strong> el servidor asigna identificadores
                    opacos temporales, bloquea WebRTC P2P y jamás registra ni comparte direcciones
                    IP ni ubicaciones con terceros ni con crackers.
                  </span>
                </div>
              </div>

              <div
                id="controles"
                className="lg:col-span-6 bg-white border border-sky-200 rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sky-700 text-xs font-bold">
                  <Gauge className="w-4 h-4" />
                  <span>Mandos Independientes y Desplazables</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  Timón, Acelerador y Controles (H) Sin Estorbar
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 space-y-1">
                    <div className="font-bold text-slate-900">Mover, Achicar o Quitar (H)</div>
                    <div>
                      Arrastra el encabezado <strong>⠿</strong> de Controles (H), Volante o
                      Velocímetro para ubicarlos donde prefieras o ciérralos con <strong>✕</strong>.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 space-y-1">
                    <div className="font-bold text-slate-900">Multitáctil Simultáneo</div>
                    <div>
                      Gira el timón y mantén presionado Acelerar o Nitro al mismo tiempo sin que la
                      pantalla se acerque ni se aleje.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 space-y-1">
                    <div className="font-bold text-slate-900">Caja Mecánica y Automática</div>
                    <div>Teclas E / Q o botones táctiles directos R, N, D y cambios 1 a 6.</div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 space-y-1">
                    <div className="font-bold text-slate-900">Vistas de Cámara (Tecla C)</div>
                    <div>Alterna entre Cabina con Timón 3D, 3ª Persona fija y Vista Aérea.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* BOTTOM SECTION: SERVICIO DE LIVSFORM LYKKE, DESARROLLADORES KAAMT EALMT Y PASARELA INTEGRADA */}
        <section
          id="livsform-lykke"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-sky-200 items-stretch"
        >
          {/* Servicio de LivsForm Lykke & Sección Desarrolladores */}
          <div className="lg:col-span-7 bg-white border border-sky-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 justify-between shadow-sm">
            <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-3 shrink-0 shadow-sm">
              {!brokenImages.livsform_logo ? (
                <img
                  src="/assets/aistudio/IMG_20261022_112510_49dbacbd.jpg"
                  alt="LivsForm Lykke"
                  onError={() =>
                    setBrokenImages((prev) => ({ ...prev, livsform_logo: true }))
                  }
                  className="w-44 sm:w-48 h-auto object-contain rounded-lg"
                />
              ) : (
                <div className="w-44 h-32 flex items-center justify-center font-display font-bold text-sky-800">
                  LivsForm Lykke
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-sky-700">
                  <span>Un servicio de LivsForm Lykke</span>
                  <span aria-hidden="true">·</span>
                  <span>Entorno Recreativo Seguro</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-900">LivsForm Lykke</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Un servicio de <strong className="text-slate-900">LivsForm Lykke</strong> dedicado
                  a ofrecer experiencias interactivas 3D sanas, creativas y seguras que funcionan de
                  forma local con o sin internet para toda la comunidad.
                </p>
              </div>

              <div className="pt-4 border-t border-sky-100 space-y-1">
                <div className="text-xs font-semibold text-slate-500">Sección Desarrolladores</div>
                <div className="font-display text-lg font-bold text-sky-800 tracking-wide">
                  KAAMT EALMT
                </div>
              </div>
            </div>
          </div>

          {/* Pasarela Integrada en la App (Sin abrir pestañas externas _blank; protegida en modo sin internet) */}
          <div className="lg:col-span-5 flex flex-col justify-between items-center gap-3">
            {/* Selector directo dentro de la misma App */}
            <div className="flex items-center justify-center gap-1 p-1 bg-white border border-sky-200 rounded-xl w-full shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setActivePasarelaScreen('donacion');
                  setOfflinePasarelaNotice(false);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activePasarelaScreen === 'donacion'
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-slate-700 hover:text-sky-700'
                }`}
              >
                Aportación
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePasarelaScreen('consultoria');
                  setOfflinePasarelaNotice(false);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activePasarelaScreen === 'consultoria'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-700 hover:text-emerald-700'
                }`}
              >
                Consultoría
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePasarelaScreen('diploma');
                  setOfflinePasarelaNotice(false);
                }}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activePasarelaScreen === 'diploma'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-700 hover:text-emerald-700'
                }`}
              >
                Diplomas
              </button>
            </div>

            {offlinePasarelaNotice && (
              <div className="w-full rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 flex items-start justify-between gap-2">
                <span>
                  Estás usando la aplicación en <strong>Modo Local Sin Internet</strong>. El juego
                  3D funciona completo sin conexión; esta pasarela en línea se activará cuando
                  conectes a internet.
                </span>
                <button
                  type="button"
                  onClick={() => setOfflinePasarelaNotice(false)}
                  className="p-0.5 rounded hover:bg-amber-200/60 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div
              id="seccion-consultoria"
              className={`${
                activePasarelaScreen === 'consultoria' ? 'block' : 'hidden'
              } bg-[#162e2a] border border-emerald-500/40 rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(15,23,42,0.18)]`}
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
                onClick={handlePasarelaNavigationGuard}
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Abrir Consultoría en la App
              </a>
            </div>

            <div
              id="seccion-diplomas"
              className={`${
                activePasarelaScreen === 'diploma' ? 'block' : 'hidden'
              } bg-[#162e2a] border border-emerald-500/40 rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(15,23,42,0.18)]`}
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
                onClick={handlePasarelaNavigationGuard}
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm transition-colors"
              >
                Abrir Diplomas en la App
              </a>
            </div>

            <div
              id="seccion-donaciones"
              className={`${
                activePasarelaScreen === 'donacion' ? 'block' : 'hidden'
              } bg-[#1b2430] border border-[#3b82f6] rounded-2xl p-6 text-center w-full shadow-[0_8px_24px_rgba(15,23,42,0.18)]`}
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
                onSubmit={handlePasarelaNavigationGuard}
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
                  onClick={handlePasarelaNavigationGuard}
                  className="text-xs font-medium text-[#60a5fa] hover:underline underline-offset-4"
                >
                  Abrir vínculo directo en la app →
                </a>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sky-200/90 px-6 md:px-10 py-6 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-4 max-w-7xl w-full mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display italic font-bold">
            <span className="text-[#0047B8]">GuateRutas </span>
            <span className="text-[#E10600]">3D </span>
            <span className="text-[#0055D4]">y más allá</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-display italic text-[#0052CC] font-semibold">
            Juegos de 3D de Carros
          </span>
          <span aria-hidden="true">·</span>
          <span>Un servicio de LivsForm Lykke</span>
          <span aria-hidden="true">·</span>
          <span>Desarrolladores KAAMT EALMT</span>
        </div>
        <button
          type="button"
          onClick={handleStartSimulation}
          className="font-bold text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
        >
          Jugar en {effectiveMap.name} →
        </button>
      </footer>
    </div>
  );
}
