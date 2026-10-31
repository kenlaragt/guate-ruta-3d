import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CheckpointPresenterPlan,
  getCheckpointAwardPlan,
  REAL_PEOPLE_ASSETS,
} from '../data/awardsCatalog';
import { getCarById } from '../data/carsCatalog';
import {
  CarRig3D,
  createCheckpointMetaStage3D,
  createLandmarkGroup,
  createRealHouseMesh,
  createRealisticCarRig,
  createWalkingPedestrian3D,
  WalkingPedestrian3D,
} from '../engine/models3d';
import { createProceduralTexturePack } from '../engine/proceduralTextures';
import {
  createGuidanceArrowRig3D,
  createScenicWorldEnvironment3D,
  ScenicWorldHandle3D,
} from '../engine/scenicWorld3d';
import { soundEngine } from '../engine/soundEngine';
import {
  AnimatedWorldWildlifeHandle,
  createClosedCircuitInfrastructure3D,
  createWorldWildlifeAndZoo3D,
} from '../engine/zooAndCircuit3d';
import {
  AwardDeliveryRecord,
  CameraMode,
  CarModelId,
  DriveExperienceMode,
  GameState,
  GearLabel,
  PlayerHudTelemetry,
  RaceParticipantSummary,
  RemoteOnlinePlayer,
  RoadNode2D,
  RoadSegmentSpec,
  SessionMode,
  TimeOfDay,
  TransmissionType,
  WorldMapSpec,
} from '../types/game';

export interface VirtualRigInput {
  steer: number | null; // -1 (left) to +1 (right)
  throttle: boolean;
  brake: boolean;
  nitro: boolean;
}

interface ThreeDrivingSimulatorProps {
  map: WorldMapSpec;
  mapOrderIndex: number;
  extraRoads: RoadSegmentSpec[];
  gameState: GameState;
  driveMode: DriveExperienceMode;
  sessionMode: SessionMode;
  cameraMode: CameraMode;
  realMapOverlayMode: boolean;
  timeOfDay: TimeOfDay;
  soundMuted: boolean;
  // Player 1
  p1Alias: string;
  p1CarId: CarModelId;
  p1Paint: string;
  p1Transmission: TransmissionType;
  requestedGear: { seq: number; gear?: GearLabel; delta?: 1 | -1 };
  virtualInputRef: React.MutableRefObject<VirtualRigInput>;
  // Player 2 (for 2P local split-screen)
  p2Alias: string;
  p2CarId: CarModelId;
  p2Paint: string;
  // Online Multiplayer
  remotePlayersRef: React.MutableRefObject<Map<string, RemoteOnlinePlayer>>;
  onLocalNetworkTick?: (state: {
    x: number;
    z: number;
    heading: number;
    steerAngle: number;
    speedKmh: number;
    gear: GearLabel;
    checkpoints: number;
  }) => void;
  onTelemetry: (
    hud: PlayerHudTelemetry,
    activeCheckpoint: RoadNode2D | null,
    p2Pos: { x: number; z: number; heading: number } | null,
  ) => void;
  onAwardDelivered?: (award: AwardDeliveryRecord) => void;
  onRaceAllWinSummary?: (participants: RaceParticipantSummary[], elapsedSec: number) => void;
  onRoundComplete: (summary: { lapTimeSec: number; checkpoints: number; topSpeedKmh: number }) => void;
  resetTrigger: number;
  descentTrigger?: number;
  celebrateAllWinSeq?: number;
}

// Pre-allocated math helpers at module scope (Zero GC inside render loop)
const _camIdealPos = new THREE.Vector3();
const _camIdealLook = new THREE.Vector3();
const _p2CamIdealPos = new THREE.Vector3();
const _p2CamIdealLook = new THREE.Vector3();

const GEAR_SPEED_RATIOS: Record<number, number> = {
  1: 0.32,
  2: 0.5,
  3: 0.66,
  4: 0.8,
  5: 0.91,
  6: 1.0,
};

const GEAR_TORQUE_MULT: Record<number, number> = {
  1: 1.75,
  2: 1.45,
  3: 1.25,
  4: 1.1,
  5: 0.98,
  6: 0.9,
};

interface BuildingCollider {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

interface TrafficAgent {
  rig: CarRig3D;
  path: RoadNode2D[];
  segIndex: number;
  t: number;
  speed: number;
  laneOffset: number;
  reverseDir: boolean;
  pedalPhase: number;
  isRaceParticipant?: boolean;
  alias?: string;
  transportName?: string;
  valueMessage?: string;
  checkpointsPassed?: number;
}

interface PedestrianAgent {
  actor: WalkingPedestrian3D;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  walkPhase: number;
}

function distToSegmentSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 0.001) return wx * wx + wz * wz;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const cx = ax + t * vx;
  const cz = az + t * vz;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
}

export const ThreeDrivingSimulator: React.FC<ThreeDrivingSimulatorProps> = ({
  map,
  mapOrderIndex,
  extraRoads,
  realMapOverlayMode,
  gameState,
  driveMode,
  sessionMode,
  cameraMode,
  timeOfDay,
  soundMuted,
  p1Alias,
  p1CarId,
  p1Paint,
  p1Transmission,
  requestedGear,
  virtualInputRef,
  p2Alias,
  p2CarId,
  p2Paint,
  remotePlayersRef,
  onLocalNetworkTick,
  onTelemetry,
  onAwardDelivered,
  onRaceAllWinSummary,
  onRoundComplete,
  resetTrigger,
  descentTrigger = 0,
  celebrateAllWinSeq = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const descentStartTimeRef = useRef<number>(performance.now());
  const prevCelebrateSeqRef = useRef<number>(celebrateAllWinSeq);

  // Store latest props in refs so WebGL context stays stable across HUD state updates
  const latestPropsRef = useRef({
    mapOrderIndex,
    gameState,
    driveMode,
    sessionMode,
    cameraMode,
    timeOfDay,
    soundMuted,
    p1Alias,
    p2Alias,
    p1Transmission,
    celebrateAllWinSeq,
    onLocalNetworkTick,
    onTelemetry,
    onAwardDelivered,
    onRaceAllWinSummary,
    onRoundComplete,
  });
  latestPropsRef.current = {
    mapOrderIndex,
    gameState,
    driveMode,
    sessionMode,
    cameraMode,
    timeOfDay,
    soundMuted,
    p1Alias,
    p2Alias,
    p1Transmission,
    celebrateAllWinSeq,
    onLocalNetworkTick,
    onTelemetry,
    onAwardDelivered,
    onRaceAllWinSummary,
    onRoundComplete,
  };

  const p1PhysicsRef = useRef({
    x: map.spawn.x,
    z: map.spawn.z,
    heading: map.spawn.heading,
    speedMs: 0, // signed m/s (+ forward, - reverse)
    steerNorm: 0, // -1 right to +1 left
    gear: '1' as GearLabel,
    rpm: 900,
    nitroPct: 100,
    checkpointIdx: 0,
    checkpointsCollected: 0,
    lapTimeSec: 0,
    raceRemainingSec: 240,
    addTimeBonusSec: 0,
    topSpeedKmh: 0,
    finished: false,
    allWinAwarded: false,
  });

  const p2PhysicsRef = useRef({
    x: map.spawn.x + 3.6,
    z: map.spawn.z + 2.5,
    heading: map.spawn.heading,
    speedMs: 0,
    steerNorm: 0,
    gear: '1' as GearLabel,
    rpm: 900,
    checkpointIdx: 0,
    checkpointsCollected: 0,
  });

  // Handle manual/UI gear requests from SimulatorControlsRig
  useEffect(() => {
    if (requestedGear.seq === 0) return;
    const p1 = p1PhysicsRef.current;
    const spec = getCarById(p1CarId);
    if (requestedGear.gear) {
      p1.gear = requestedGear.gear;
      soundEngine.playShiftClick(spec.engineTone === 'inline6_turbo' || spec.engineTone === 'rb26_race');
    } else if (requestedGear.delta) {
      const order: GearLabel[] = ['R', 'N', '1', '2', '3', '4', '5', '6'];
      const idx = order.indexOf(p1.gear);
      const nextIdx = Math.max(0, Math.min(order.length - 1, idx + requestedGear.delta));
      if (nextIdx !== idx) {
        p1.gear = order[nextIdx];
        soundEngine.playShiftClick(spec.engineTone === 'inline6_turbo' || spec.engineTone === 'rb26_race');
      }
    }
  }, [requestedGear, p1CarId]);

  useEffect(() => {
    soundEngine.setMuted(soundMuted);
  }, [soundMuted]);

  // Reset positions & 4-minute Add Time clock when map, driveMode or resetTrigger changes
  useEffect(() => {
    p1PhysicsRef.current = {
      x: map.spawn.x,
      z: map.spawn.z,
      heading: map.spawn.heading,
      speedMs: 0,
      steerNorm: 0,
      gear: '1',
      rpm: 900,
      nitroPct: 100,
      checkpointIdx: 0,
      checkpointsCollected: 0,
      lapTimeSec: 0,
      raceRemainingSec: 240,
      addTimeBonusSec: 0,
      topSpeedKmh: 0,
      finished: false,
      allWinAwarded: false,
    };
    p2PhysicsRef.current = {
      x: map.spawn.x + 3.6,
      z: map.spawn.z + 2.5,
      heading: map.spawn.heading,
      speedMs: 0,
      steerNorm: 0,
      gear: '1',
      rpm: 900,
      checkpointIdx: 0,
      checkpointsCollected: 0,
    };
  }, [map, driveMode, resetTrigger]);

  // Trigger synchronized sky-to-street satellite camera descent when map changes or user clicks "Bajar Satélite"
  useEffect(() => {
    descentStartTimeRef.current = performance.now();
  }, [map.id, descentTrigger]);

  // Main Three.js Scene & Simulation Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard per threejs/SKILL.md
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: realMapOverlayMode,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if (realMapOverlayMode) {
      renderer.setClearColor(0x000000, 0);
    }
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl && !realMapOverlayMode;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();

    // Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Cameras (Player 1 + Player 2 for Split-Screen)
    const width0 = container.clientWidth || window.innerWidth;
    const height0 = container.clientHeight || window.innerHeight;
    const cam1 = new THREE.PerspectiveCamera(62, width0 / height0, 0.2, 1300);
    cam1.position.set(map.spawn.x, 4, map.spawn.z + 9);
    const cam2 = new THREE.PerspectiveCamera(62, (width0 * 0.5) / height0, 0.2, 1300);
    cam2.position.set(map.spawn.x + 4, 4, map.spawn.z + 11);

    // 3-Point Warm/Cool Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3b4232, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sunLight.position.set(120, 175, 95);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      const d = 160;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 480;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.55);
    rimLight.position.set(-140, 80, -130);
    scene.add(rimLight);

    let scenicWorld: ScenicWorldHandle3D | null = null;

    // Helper to apply time-of-day atmosphere (crisp horizon visibility for mountains, volcanoes & Cristo Redentor)
    const applyAtmosphere = (tod: TimeOfDay) => {
      scenicWorld?.setTimeOfDay(tod);
      if (tod === 'NIGHT') {
        if (realMapOverlayMode) {
          scene.background = null;
          scene.fog = null;
        } else {
          const bg = new THREE.Color(0x091122);
          scene.background = bg;
          scene.fog = new THREE.FogExp2(0x091122, 0.00085);
        }
        sunLight.color.setHex(0x93c5fd);
        sunLight.intensity = 0.65;
        hemiLight.intensity = 0.48;
        renderer.toneMappingExposure = 1.22;
      } else if (tod === 'GOLDEN') {
        if (realMapOverlayMode) {
          scene.background = null;
          scene.fog = null;
        } else {
          const bg = new THREE.Color(0xd98a5f);
          scene.background = bg;
          scene.fog = new THREE.FogExp2(0xd98a5f, 0.00048);
        }
        sunLight.color.setHex(0xffb86c);
        sunLight.intensity = 2.25;
        sunLight.position.set(180, 75, 130);
        hemiLight.intensity = 0.85;
        renderer.toneMappingExposure = 1.1;
      } else {
        if (realMapOverlayMode) {
          scene.background = null;
          scene.fog = null;
        } else {
          const bg = new THREE.Color(map.skyTintDay || '#58b4f8');
          scene.background = bg;
          scene.fog = new THREE.FogExp2(0xdbf0ff, 0.00038);
        }
        sunLight.color.setHex(0xfff6e5);
        sunLight.intensity = 2.2;
        sunLight.position.set(120, 175, 95);
        hemiLight.intensity = 0.96;
        renderer.toneMappingExposure = 1.07;
      }
    };
    applyAtmosphere(latestPropsRef.current.timeOfDay);

    // Procedural PBR Textures
    const texPack = createProceduralTexturePack(renderer, map.houseStyle);
    const allRoads = [...map.roads, ...extraRoads];
    const colliders: BuildingCollider[] = [];
    let welcomeBillboardTex: THREE.Texture | null = null;

    // Helper: minimum distance from any road centerline or landmark
    const isClearOfRoadsAndLandmarks = (cx: number, cz: number, minPad: number): boolean => {
      for (const seg of allRoads) {
        const reqDist = seg.width * 0.5 + minPad;
        const reqSq = reqDist * reqDist;
        for (let i = 0; i < seg.points.length - 1; i++) {
          const a = seg.points[i];
          const b = seg.points[i + 1];
          if (distToSegmentSq(cx, cz, a.x, a.z, b.x, b.z) < reqSq) {
            return false;
          }
        }
      }
      for (const lm of map.landmarks) {
        const dSq = (cx - lm.x) * (cx - lm.x) + (cz - lm.z) * (cz - lm.z);
        if (dSq < 24 * 24) return false;
      }
      return true;
    };

    // Build stylized 3D circuits, 3D houses, trees, cover-art landscapes, moving water, and landmarks
    if (!realMapOverlayMode) {
      // Build All Road Ribbons & Intersection Discs
      const junctionSet = new Map<
        string,
        { x: number; z: number; maxW: number; surface: RoadSegmentSpec['surface'] }
      >();

      allRoads.forEach((seg, segIdx) => {
        for (let i = 0; i < seg.points.length - 1; i++) {
          const a = seg.points[i];
          const b = seg.points[i + 1];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dz);
          if (len < 1) continue;

          const stripGeo = new THREE.PlaneGeometry(seg.width, len);
          stripGeo.rotateX(-Math.PI / 2);

          const uvAttr = stripGeo.attributes.uv as THREE.BufferAttribute;
          const vRepeat = Math.max(1, len / 14);
          for (let u = 0; u < uvAttr.count; u++) {
            uvAttr.setY(u, uvAttr.getY(u) * vRepeat);
          }

          const roadMat = new THREE.MeshStandardMaterial({
            map: texPack.roads[seg.surface],
            roughness: seg.surface === 'cobblestone' ? 0.86 : 0.72,
            metalness: 0.06,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });

          const strip = new THREE.Mesh(stripGeo, roadMat);
          const yLayer = 0.05 + (seg.isMainArtery ? 0.018 : 0) + (segIdx % 5) * 0.002;
          strip.position.set((a.x + b.x) / 2, yLayer, (a.z + b.z) / 2);
          strip.rotation.y = Math.atan2(dx, dz);
          strip.receiveShadow = true;
          scene.add(strip);

          for (const pt of [a, b]) {
            const key = `${Math.round(pt.x / 3)},${Math.round(pt.z / 3)}`;
            const prev = junctionSet.get(key);
            if (!prev || seg.width > prev.maxW) {
              junctionSet.set(key, { x: pt.x, z: pt.z, maxW: seg.width, surface: seg.surface });
            }
          }
        }
      });

      // Smooth circular intersection pads
      const asphaltPatchMat = new THREE.MeshStandardMaterial({
        color: map.houseStyle === 'colonial_gt' ? 0x524c44 : 0x262b34,
        roughness: 0.82,
      });
      for (const jn of junctionSet.values()) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(jn.maxW * 0.54, 18).rotateX(-Math.PI / 2),
          asphaltPatchMat,
        );
        disc.position.set(jn.x, 0.046, jn.z);
        scene.add(disc);
      }

      // Place Landmarks
      for (const lm of map.landmarks) {
        const lmGroup = createLandmarkGroup(lm, texPack);
        scene.add(lmGroup);
      }

      // Place Adapted Town Photo Welcome Billboard beside spawn road
      if (map.adaptedPhotoUrl) {
        const signGroup = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.2, 10);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.65,
          roughness: 0.35,
        });
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-3.6, 3.1, 0);
        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(3.6, 3.1, 0);

        const frameMesh = new THREE.Mesh(
          new THREE.BoxGeometry(8.2, 4.7, 0.28),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.45,
            roughness: 0.5,
          }),
        );
        frameMesh.position.set(0, 5.2, 0);

        const photoMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.42,
          metalness: 0.05,
        });
        const loader = new THREE.TextureLoader();
        welcomeBillboardTex = loader.load(map.adaptedPhotoUrl, (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          photoMat.map = loaded;
          photoMat.needsUpdate = true;
        });

        const photoFront = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.2), photoMat);
        photoFront.position.set(0, 5.2, 0.16);
        const photoBack = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.2), photoMat);
        photoBack.position.set(0, 5.2, -0.16);
        photoBack.rotation.y = Math.PI;

        signGroup.add(leftPost, rightPost, frameMesh, photoFront, photoBack);
        const spawnSin = Math.sin(map.spawn.heading);
        const spawnCos = Math.cos(map.spawn.heading);
        const sideX = spawnCos * 11.5;
        const sideZ = -spawnSin * 11.5;
        signGroup.position.set(
          map.spawn.x - spawnSin * 26 + sideX,
          0,
          map.spawn.z - spawnCos * 26 + sideZ,
        );
        signGroup.rotation.y = map.spawn.heading;
        scene.add(signGroup);
      }

      // Place Real 3D Houses ("Casas Reales") along streets (skip on dedicated Zoo Safari & Closed-Circuit Race Tracks)
      let houseSeed = 1;
      for (const seg of map.isClosedCircuit || map.isZooSafari ? [] : map.roads) {
        for (let i = 0; i < seg.points.length - 1; i++) {
          const a = seg.points[i];
          const b = seg.points[i + 1];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const segLen = Math.hypot(dx, dz);
          if (segLen < 28) continue;

          const ux = dx / segLen;
          const uz = dz / segLen;
          const nx = -uz;
          const nz = ux;

          for (let distAlong = 18; distAlong < segLen - 18; distAlong += 24) {
            for (const side of [-1, 1]) {
              houseSeed++;
              const hw = 10 + (houseSeed % 4) * 1.8;
              const hd = 9 + ((houseSeed * 3) % 3) * 1.6;
              const isColonialSingle = map.houseStyle === 'colonial_gt' && houseSeed % 2 === 0;
              const hh = isColonialSingle ? 4.4 : 6.8 + (houseSeed % 3) * 1.8;

              const setback = seg.width * 0.5 + hd * 0.5 + 3.2;
              const hx = a.x + ux * distAlong + nx * side * setback;
              const hz = a.z + uz * distAlong + nz * side * setback;

              const tooCloseToHouse = colliders.some(
                (c) =>
                  Math.abs(c.x - hx) < c.halfW + hw * 0.5 + 1.5 &&
                  Math.abs(c.z - hz) < c.halfD + hd * 0.5 + 1.5,
              );
              if (tooCloseToHouse) continue;

              if (!isClearOfRoadsAndLandmarks(hx, hz, Math.max(hw, hd) * 0.52)) {
                continue;
              }

              const facadeTex = texPack.houseFacades[houseSeed % texPack.houseFacades.length];
              const roofTex =
                map.houseStyle === 'colonial_gt' ||
                map.houseStyle === 'latin_residential' ||
                map.houseStyle === 'european_classic'
                  ? texPack.roofTile
                  : texPack.roofSlate;

              const houseMesh = createRealHouseMesh(
                hw,
                hd,
                hh,
                map.houseStyle,
                facadeTex,
                roofTex,
                houseSeed,
              );
              houseMesh.position.set(hx, 0, hz);
              houseMesh.rotation.y = Math.atan2(-nx * side, -nz * side);
              scene.add(houseMesh);

              colliders.push({
                x: hx,
                z: hz,
                halfW: hw * 0.5 + 0.7,
                halfD: hd * 0.5 + 0.7,
              });
            }
          }
        }
      }

      // Place Street Trees & Ravine Groves via InstancedMesh (2-part: Trunk + Crown)
      const treePositions: Array<{ x: number; z: number; scale: number }> = [];
      for (let t = 0; t < 260; t++) {
        const angle = t * 2.39996;
        const rad = 22 + ((t * 19) % 340);
        const tx = Math.cos(angle) * rad;
        const tz = Math.sin(angle) * rad;
        if (isClearOfRoadsAndLandmarks(tx, tz, 3.2)) {
          const hitsHouse = colliders.some(
            (c) => Math.abs(c.x - tx) < c.halfW + 1.6 && Math.abs(c.z - tz) < c.halfD + 1.6,
          );
          if (!hitsHouse) {
            treePositions.push({ x: tx, z: tz, scale: 0.85 + (t % 5) * 0.08 });
          }
        }
        if (treePositions.length >= 150) break;
      }

      if (treePositions.length > 0) {
        const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 2.8, 8);
        trunkGeo.translate(0, 1.4, 0);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
        const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);

        const crownGeo =
          map.foliageType === 'pine' || map.foliageType === 'cypress'
            ? new THREE.ConeGeometry(2.1, 5.5, 9)
            : new THREE.DodecahedronGeometry(2.3, 1);
        crownGeo.translate(0, 4.4, 0);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
        const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);

        const dummy = new THREE.Object3D();
        const tint = new THREE.Color();

        treePositions.forEach((tp, idx) => {
          dummy.position.set(tp.x, 0, tp.z);
          dummy.rotation.set(0, idx * 0.9, 0);
          dummy.scale.setScalar(tp.scale);
          dummy.updateMatrix();
          trunkInst.setMatrixAt(idx, dummy.matrix);
          crownInst.setMatrixAt(idx, dummy.matrix);

          if (map.foliageType === 'jacaranda' && idx % 3 === 0) {
            tint.setHex(0x8b5cf6);
          } else if (map.foliageType === 'palm') {
            tint.setHex(idx % 2 === 0 ? 0x16a34a : 0x15803d);
          } else {
            tint.setHex(idx % 2 === 0 ? 0x166534 : 0x22543d);
          }
          crownInst.setColorAt(idx, tint);
        });

        trunkInst.instanceMatrix.needsUpdate = true;
        crownInst.instanceMatrix.needsUpdate = true;
        if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
        trunkInst.computeBoundingSphere();
        crownInst.computeBoundingSphere();
        scene.add(trunkInst, crownInst);
      }

      // Build Cover-Art 3D Scenic Horizon Dome, Mountains, Volcanoes, Moving Seas/Lakes/Lagoons/Rivers,
      // 3D Palm Trees, Flower Meadows, and Intercultural / Disability Respect / 19th-20th C. Ludic Games Signs
      scenicWorld = createScenicWorldEnvironment3D(
        map,
        allRoads,
        colliders,
        texPack,
        isSoftwareGl,
      );
      scenicWorld.setTimeOfDay(latestPropsRef.current.timeOfDay);
      scene.add(scenicWorld.group);
    }

    // Sky White Clouds & 3D Flying Songbirds ("Pajaritos")
    const wildlifeHandle: AnimatedWorldWildlifeHandle = createWorldWildlifeAndZoo3D(map, true);
    scene.add(wildlifeHandle.group);

    // Closed-Circuit Motorsport Infrastructure (Start/Finish Gantry, Red/White FIA Kerbs & Tire Walls)
    const circuitInfra = createClosedCircuitInfrastructure3D(map);
    scene.add(circuitInfra.group);

    // Load Textures for 3D Walking Pedestrians ("Gente Caminando") & Grand Trophy Showcase
    const peopleLoader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const pedestriansTex = peopleLoader.load(REAL_PEOPLE_ASSETS.pedestriansSheetUrl, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = maxAniso;
      loaded.needsUpdate = true;
    });
    pedestriansTex.colorSpace = THREE.SRGBColorSpace;

    const grandTrophyTex = peopleLoader.load(
      REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = maxAniso;
        loaded.needsUpdate = true;
      },
    );
    grandTrophyTex.colorSpace = THREE.SRGBColorSpace;

    // Helper: align finish arch with nearest road segment heading
    const findRoadHeadingAt = (px: number, pz: number): number => {
      let bestSq = Infinity;
      let bestHeading = map.spawn.heading;
      for (const seg of allRoads) {
        for (let i = 0; i < seg.points.length - 1; i++) {
          const a = seg.points[i];
          const b = seg.points[i + 1];
          const dSq = distToSegmentSq(px, pz, a.x, a.z, b.x, b.z);
          if (dSq < bestSq) {
            bestSq = dSq;
            bestHeading = Math.atan2(-(b.x - a.x), -(b.z - a.z));
          }
        }
      }
      return bestHeading;
    };

    // Populate ALL 3D Checkpoint Finish Stages simultaneously on the circuit
    const metaStages = map.checkpoints.map((cp, idx) => {
      const stage = createCheckpointMetaStage3D(grandTrophyTex);
      const plan = getCheckpointAwardPlan(
        map.id,
        latestPropsRef.current.mapOrderIndex,
        idx,
        map.checkpoints.length,
      );
      stage.configureForPlan(plan);
      stage.group.position.set(cp.x, 0, cp.z);
      stage.group.rotation.y = findRoadHeadingAt(cp.x, cp.z);
      stage.setActiveTarget(idx === 0);
      scene.add(stage.group);
      return { stage, plan, cp };
    });

    let configuredCpKey = '';
    let activeAwardPlan: CheckpointPresenterPlan | null = metaStages[0]?.plan ?? null;
    const syncMetaStageToCheckpoint = (cpZeroIdx: number) => {
      if (metaStages.length === 0) return;
      const normIdx = ((cpZeroIdx % metaStages.length) + metaStages.length) % metaStages.length;
      const nextKey = `${map.id}_${latestPropsRef.current.mapOrderIndex}_${normIdx}`;
      if (nextKey === configuredCpKey) return;
      configuredCpKey = nextKey;

      for (let i = 0; i < metaStages.length; i++) {
        const refreshedPlan = getCheckpointAwardPlan(
          map.id,
          latestPropsRef.current.mapOrderIndex,
          i,
          metaStages.length,
        );
        metaStages[i].plan = refreshedPlan;
        metaStages[i].stage.configureForPlan(refreshedPlan);
        metaStages[i].stage.setActiveTarget(i === normIdx);
      }
      activeAwardPlan = metaStages[normIdx].plan;
    };
    syncMetaStageToCheckpoint(p1PhysicsRef.current.checkpointIdx);

    // Create Player 1 Vehicle Rig (Car, Cuatrimoto Eléctrica, Triciclo Eléctrico, Tuk Tuk, Bicicleta or Camión)
    const p1Spec = getCarById(p1CarId);
    const p1Rig = createRealisticCarRig(
      p1Spec,
      p1Paint,
      texPack.contactShadow,
      isSoftwareGl,
      sessionMode !== 'SOLO' || driveMode === 'RACE_4MIN' ? p1Alias || 'Piloto 1' : undefined,
      p1Spec.valueMessage,
    );
    scene.add(p1Rig.group);
    const p1LabelSprite = p1Rig.group.getObjectByName('driverLabelSprite');

    // Create Player 2 Vehicle Rig (visible in SPLIT_2P)
    const p2Spec = getCarById(p2CarId);
    const p2Rig = createRealisticCarRig(
      p2Spec,
      p2Paint,
      texPack.contactShadow,
      isSoftwareGl,
      p2Alias || 'Piloto 2',
      p2Spec.valueMessage,
    );
    p2Rig.group.visible = sessionMode === 'SPLIT_2P';
    scene.add(p2Rig.group);

    // 3D Overhead Route Guidance Arrows pointing to Next Meta (for P1 & P2)
    const p1GuideArrow = createGuidanceArrowRig3D(0xfbbf24);
    scene.add(p1GuideArrow.group);
    const p2GuideArrow = createGuidanceArrowRig3D(0x38bdf8);
    scene.add(p2GuideArrow.group);

    // Create Live Traffic + Participating Race Vehicles (with 3D Avatars & Value Messages on Every Vehicle!)
    const aiTraffic: TrafficAgent[] = [];
    const trafficBlueprints: Array<{
      id: CarModelId;
      paint: string;
      lane: number;
      speed: number;
      reverse: boolean;
    }> = map.isClosedCircuit
      ? [
          { id: 'nissan_calsonic', paint: '#0284c7', lane: -2.6, speed: 24.5, reverse: false },
          { id: 'lamborghini', paint: '#eab308', lane: 2.6, speed: 26.2, reverse: false },
          { id: 'cuatrimoto_el', paint: '#16a34a', lane: -3.1, speed: 18.4, reverse: false },
          { id: 'triciclo_el', paint: '#0284c7', lane: 3.1, speed: 16.5, reverse: false },
          { id: 'pickup', paint: '#2563eb', lane: -2.4, speed: 20.8, reverse: false },
          { id: 'toyota_supra', paint: '#dc2626', lane: 2.3, speed: 23.4, reverse: false },
          { id: 'toyota_gt', paint: '#f8fafc', lane: -2.0, speed: 25.1, reverse: false },
          { id: 'tuk_tuk', paint: '#dc2626', lane: 3.2, speed: 12.5, reverse: false },
          { id: 'bicicleta', paint: '#16a34a', lane: 3.8, speed: 7.2, reverse: false },
        ]
      : [
          { id: 'cuatrimoto_el', paint: '#16a34a', lane: 2.6, speed: 12.8, reverse: false },
          { id: 'triciclo_el', paint: '#0284c7', lane: 2.7, speed: 11.4, reverse: false },
          { id: 'tuk_tuk', paint: '#dc2626', lane: 2.5, speed: 9.2, reverse: false },
          { id: 'bicicleta', paint: '#16a34a', lane: 3.7, speed: 5.5, reverse: false },
          { id: 'pickup', paint: '#2563eb', lane: 2.4, speed: 13.0, reverse: false },
          { id: 'cuatrimoto_el', paint: '#f97316', lane: 2.6, speed: 12.4, reverse: true },
          { id: 'triciclo_el', paint: '#eab308', lane: 2.7, speed: 11.1, reverse: true },
          { id: 'tuk_tuk', paint: '#eab308', lane: 2.5, speed: 8.9, reverse: true },
          { id: 'bicicleta', paint: '#0284c7', lane: 3.8, speed: 5.2, reverse: true },
          { id: 'camion', paint: '#f8fafc', lane: 2.3, speed: 10.4, reverse: true },
          { id: 'pickup', paint: '#dc2626', lane: 2.4, speed: 12.8, reverse: true },
          { id: 'toyota_corolla', paint: '#cbd5e1', lane: 2.4, speed: 12.6, reverse: false },
          { id: 'byd_f', paint: '#0284c7', lane: 2.4, speed: 11.8, reverse: false },
          { id: 'camion', paint: '#1d4ed8', lane: 2.3, speed: 9.6, reverse: false },
          { id: 'nissan_sentra', paint: '#f97316', lane: 2.4, speed: 13.2, reverse: true },
          { id: 'toyota_supra', paint: '#eab308', lane: 2.4, speed: 14.2, reverse: true },
        ];
    const candidateRoads = map.roads.filter((r) => r.points.length >= 2);
    if (candidateRoads.length > 0) {
      for (let i = 0; i < trafficBlueprints.length; i++) {
        const bp = trafficBlueprints[i];
        const road = candidateRoads[i % candidateRoads.length];
        const orderedPts = bp.reverse ? [...road.points].reverse() : road.points;
        const aiSpec = getCarById(bp.id);
        const aiRig = createRealisticCarRig(
          aiSpec,
          bp.paint || aiSpec.defaultPaint,
          texPack.contactShadow,
          isSoftwareGl,
          undefined,
          aiSpec.valueMessage,
        );
        scene.add(aiRig.group);
        aiTraffic.push({
          rig: aiRig,
          path: orderedPts,
          segIndex: i % Math.max(1, orderedPts.length - 1),
          t: (i * 0.17 + 0.14) % 0.88,
          speed: bp.speed,
          laneOffset: Math.min(bp.lane, road.width * 0.44),
          reverseDir: bp.reverse,
          pedalPhase: i * 1.3,
        });
      }

      // Dedicated Companion Race Participants when in 4-Minute Add Time Race Mode ("se vea participar otros carros")
      if (driveMode === 'RACE_4MIN') {
        const raceLoopPath: RoadNode2D[] =
          map.checkpoints.length >= 3
            ? [map.spawn, ...map.checkpoints, map.spawn]
            : candidateRoads[0].points;
        const participantRoster: Array<{
          alias: string;
          carId: CarModelId;
          paint: string;
          lane: number;
          speed: number;
        }> = [
          { alias: 'Mateo', carId: 'cuatrimoto_el', paint: '#16a34a', lane: -1.8, speed: 16.8 },
          { alias: 'Sofía', carId: 'triciclo_el', paint: '#0284c7', lane: 1.9, speed: 15.6 },
          { alias: 'Valentina', carId: 'toyota_supra', paint: '#ef4444', lane: -2.1, speed: 20.5 },
          { alias: 'Lucas', carId: 'nissan_calsonic', paint: '#2563eb', lane: 2.1, speed: 21.4 },
          { alias: 'Diego', carId: 'pickup', paint: '#eab308', lane: -1.6, speed: 18.6 },
        ];
        participantRoster.forEach((rp, idx) => {
          const rpSpec = getCarById(rp.carId);
          const rpRig = createRealisticCarRig(
            rpSpec,
            rp.paint,
            texPack.contactShadow,
            isSoftwareGl,
            rp.alias,
            rpSpec.valueMessage,
          );
          scene.add(rpRig.group);
          aiTraffic.push({
            rig: rpRig,
            path: raceLoopPath,
            segIndex: idx % Math.max(1, raceLoopPath.length - 1),
            t: (0.06 + idx * 0.14) % 0.85,
            speed: rp.speed,
            laneOffset: rp.lane,
            reverseDir: false,
            pedalPhase: idx * 0.9,
            isRaceParticipant: true,
            alias: rp.alias,
            transportName: rpSpec.name,
            valueMessage: rpSpec.valueMessage,
            checkpointsPassed: 1,
          });
        });
      }
    }

    // Create 3D Walking Pedestrians with Real Human Photographs strolling along sidewalks
    const pedestrians: PedestrianAgent[] = [];
    // First place 4 immediate sidewalk pedestrians right ahead of the player spawn so they are visible from second 0
    const spawnSin = Math.sin(map.spawn.heading);
    const spawnCos = Math.cos(map.spawn.heading);
    const spawnFwdX = -spawnSin;
    const spawnFwdZ = -spawnCos;
    const spawnRightX = spawnCos;
    const spawnRightZ = -spawnSin;
    const mainRoadHalf = (map.roads[0]?.width ?? 9) * 0.5 + 1.35;
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const side = sIdx % 2 === 0 ? 1 : -1;
      const startAhead = 14 + sIdx * 9;
      const endAhead = startAhead + 36;
      const actor = createWalkingPedestrian3D(
        pedestriansTex,
        texPack.contactShadow,
        sIdx,
      );
      scene.add(actor.group);
      pedestrians.push({
        actor,
        ax: map.spawn.x + spawnFwdX * startAhead + spawnRightX * side * mainRoadHalf,
        az: map.spawn.z + spawnFwdZ * startAhead + spawnRightZ * side * mainRoadHalf,
        bx: map.spawn.x + spawnFwdX * endAhead + spawnRightX * side * mainRoadHalf,
        bz: map.spawn.z + spawnFwdZ * endAhead + spawnRightZ * side * mainRoadHalf,
        t: 0.2 + (sIdx * 0.2) % 0.65,
        dir: sIdx % 2 === 0 ? 1 : -1,
        speed: 1.32 + (sIdx % 3) * 0.18,
        walkPhase: sIdx * 1.15,
      });
    }

    if (candidateRoads.length > 0) {
      let pedCount = pedestrians.length;
      const maxPeds = 22;
      for (let rIdx = 0; rIdx < candidateRoads.length && pedCount < maxPeds; rIdx++) {
        const road = candidateRoads[rIdx];
        for (let sIdx = 0; sIdx < road.points.length - 1 && pedCount < maxPeds; sIdx++) {
          const a = road.points[sIdx];
          const b = road.points[sIdx + 1];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dz);
          if (len < 22) continue;
          const nx = -dz / len;
          const nz = dx / len;
          for (const side of [-1, 1] as const) {
            if (pedCount >= maxPeds) break;
            const sidewalkDist = road.width * 0.5 + 1.35;
            const actor = createWalkingPedestrian3D(
              pedestriansTex,
              texPack.contactShadow,
              pedCount,
            );
            scene.add(actor.group);
            pedestrians.push({
              actor,
              ax: a.x + nx * side * sidewalkDist,
              az: a.z + nz * side * sidewalkDist,
              bx: b.x + nx * side * sidewalkDist,
              bz: b.z + nz * side * sidewalkDist,
              t: (pedCount * 0.19) % 0.92,
              dir: pedCount % 2 === 0 ? 1 : -1,
              speed: 1.25 + (pedCount % 4) * 0.22,
              walkPhase: pedCount * 0.9,
            });
            pedCount++;
          }
        }
      }
    }

    // Dynamic Map of Remote Online Multiplayer Car Rigs (with Overhead Chosen Player Name + Chosen Transport + Value Motto)
    const remoteRigs = new Map<
      string,
      { rig: CarRig3D; carId: CarModelId; alias: string; paintHex: string; valueMessage?: string }
    >();

    const buildAndEmitAllWinSummary = () => {
      const props = latestPropsRef.current;
      const p1 = p1PhysicsRef.current;
      const p2 = p2PhysicsRef.current;
      if (p1.allWinAwarded) return;
      p1.allWinAwarded = true;
      soundEngine.playGrandTrophyFanfare();

      const participants: RaceParticipantSummary[] = [
        {
          id: 'local_p1',
          alias: props.p1Alias || 'Piloto 1',
          vehicleName: p1Spec.name,
          valueMessage: p1Spec.valueMessage,
          checkpoints: Math.max(1, p1.checkpointsCollected),
          isHuman: true,
          medalTitle: 'Medalla de Oro · Todos Somos Ganadores',
        },
      ];

      if (props.sessionMode === 'SPLIT_2P') {
        participants.push({
          id: 'local_p2',
          alias: props.p2Alias || 'Piloto 2',
          vehicleName: p2Spec.name,
          valueMessage: p2Spec.valueMessage,
          checkpoints: Math.max(1, p2.checkpointsCollected),
          isHuman: true,
          medalTitle: 'Medalla de Oro · Todos Somos Ganadores',
        });
      }

      if (props.sessionMode === 'ONLINE_MULTI') {
        for (const [peerId, peer] of remotePlayersRef.current.entries()) {
          const peerSpec = getCarById(peer.carId);
          participants.push({
            id: `online_${peerId}`,
            alias: peer.alias || 'Piloto en Línea',
            vehicleName: peerSpec.name,
            valueMessage: peer.valueMessage || peerSpec.valueMessage,
            checkpoints: Math.max(1, peer.checkpoints || 1),
            isHuman: true,
            isOnlinePeer: true,
            medalTitle: 'Medalla de Oro · Participación en Línea',
          });
        }
      }

      aiTraffic
        .filter((ag) => ag.isRaceParticipant)
        .forEach((ag, idx) => {
          participants.push({
            id: `companion_${idx}`,
            alias: ag.alias || `Corredor ${idx + 1}`,
            vehicleName: ag.transportName || 'Vehículo 3D',
            valueMessage: ag.valueMessage || 'Juego Limpio y Amistad',
            checkpoints: Math.max(1, ag.checkpointsPassed || 1),
            isHuman: false,
            medalTitle: 'Medalla de Oro · Compañero de Pista',
          });
        });

      props.onRaceAllWinSummary?.(participants, Math.max(1, Math.round(p1.lapTimeSec)));
    };

    // Pre-compile shaders on hardware GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, cam1);
    }

    // Keyboard State Tracking
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const code = e.code;
      keys.add(code);
      soundEngine.init();

      // Mechanical Gear Keyboard Shortcuts for Player 1
      const p1 = p1PhysicsRef.current;
      if (code === 'KeyE') {
        const order: GearLabel[] = ['R', 'N', '1', '2', '3', '4', '5', '6'];
        const idx = order.indexOf(p1.gear);
        if (idx < order.length - 1) {
          p1.gear = order[idx + 1];
          soundEngine.playShiftClick(true);
        }
      } else if (code === 'KeyQ') {
        const order: GearLabel[] = ['R', 'N', '1', '2', '3', '4', '5', '6'];
        const idx = order.indexOf(p1.gear);
        if (idx > 0) {
          p1.gear = order[idx - 1];
          soundEngine.playShiftClick(false);
        }
      } else if (latestPropsRef.current.p1Transmission === 'MT') {
        if (code === 'Digit1') p1.gear = '1';
        if (code === 'Digit2') p1.gear = '2';
        if (code === 'Digit3') p1.gear = '3';
        if (code === 'Digit4') p1.gear = '4';
        if (code === 'Digit5') p1.gear = '5';
        if (code === 'Digit6') p1.gear = '6';
        if (code === 'KeyR') p1.gear = 'R';
        if (code === 'KeyN') p1.gear = 'N';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Nearest real street name lookup
    const findStreetName = (px: number, pz: number): string => {
      let bestDist = Infinity;
      let bestName = allRoads[0]?.name || map.name;
      for (const seg of allRoads) {
        for (let i = 0; i < seg.points.length - 1; i++) {
          const dSq = distToSegmentSq(
            px,
            pz,
            seg.points[i].x,
            seg.points[i].z,
            seg.points[i + 1].x,
            seg.points[i + 1].z,
          );
          if (dSq < bestDist) {
            bestDist = dSq;
            bestName = seg.name;
          }
        }
      }
      return bestName;
    };

    // Resolve vehicle physics step (shared for Player 1 & Player 2)
    const stepDriverPhysics = (
      state: {
        x: number;
        z: number;
        heading: number;
        speedMs: number;
        steerNorm: number;
        gear: GearLabel;
        rpm: number;
      },
      spec: ReturnType<typeof getCarById>,
      transmission: TransmissionType,
      throttleIn: number,
      brakeIn: number,
      steerTarget: number, // -1 right to +1 left
      nitroActive: boolean,
      dt: number,
    ) => {
      state.steerNorm = THREE.MathUtils.damp(state.steerNorm, steerTarget, 12.5, dt);

      const speedAbsKmh = Math.abs(state.speedMs) * 3.6;

      // Never leave driver stuck in Neutral when pressing Gas, and allow smooth reverse when holding Brake from stop
      if (state.gear === 'N' && throttleIn > 0.1) {
        state.gear = '1';
      }

      // Automatic transmission gear logic + smart MT redline/stall assist so car never stalls or hits a wall in 1st gear
      if (transmission === 'AT') {
        if (state.gear === 'R') {
          if (throttleIn > 0.1 && state.speedMs >= -0.25 && brakeIn < 0.1) {
            // Pressing Gas from standstill automatically engages Drive (D1) so Gas always moves forward!
            state.gear = '1';
          }
        }
        if (state.gear !== 'R' && state.gear !== 'N') {
          if (brakeIn > 0.5 && state.speedMs <= 0.25 && throttleIn === 0) {
            // Smooth reverse when holding Brake/S from standstill
            state.speedMs -= Math.max(14, spec.accelFactor * 0.55) * dt;
            state.speedMs = Math.max(-15, state.speedMs);
          } else {
            // Determine optimal gear 1..6 from current speed
            let autoGear = 1;
            for (let g = 1; g <= 6; g++) {
              const gMax = spec.topSpeedKmh * GEAR_SPEED_RATIOS[g];
              if (speedAbsKmh > gMax * 0.84 && g < 6) {
                autoGear = g + 1;
              }
            }
            state.gear = String(autoGear) as GearLabel;
          }
        }
      } else {
        // Mechanical (MT) friendly assist: auto-upshift at 98% gear speed so 1st gear never blocks acceleration,
        // and allow holding Brake from stop to reverse smoothly if needed
        if (state.gear !== 'R' && state.gear !== 'N') {
          if (brakeIn > 0.5 && state.speedMs <= 0.2 && throttleIn === 0) {
            state.speedMs -= Math.max(12, spec.accelFactor * 0.48) * dt;
            state.speedMs = Math.max(-14, state.speedMs);
          } else {
            const gNumCur = Number(state.gear) || 1;
            const curGearMaxKmh = spec.topSpeedKmh * (GEAR_SPEED_RATIOS[gNumCur] || 1);
            if (throttleIn > 0.1 && speedAbsKmh >= curGearMaxKmh * 0.97 && gNumCur < 6) {
              state.gear = String(gNumCur + 1) as GearLabel;
            } else if (speedAbsKmh < 8 && gNumCur > 2 && throttleIn > 0.1) {
              state.gear = '1';
            }
          }
        }
      }

      // Compute Engine RPM & Brisk Drive Force
      let driveAccel = 0;
      if (state.gear === 'N') {
        const targetRpm = spec.idleRpm + throttleIn * (spec.redlineRpm - spec.idleRpm) * 0.92;
        state.rpm = THREE.MathUtils.damp(state.rpm, targetRpm, 9, dt);
      } else if (state.gear === 'R') {
        const revMaxMs = 16; // ~58 km/h max in reverse
        const gearRatioFrac = Math.min(1.05, Math.abs(state.speedMs) / revMaxMs);
        const targetRpm = Math.max(
          spec.idleRpm,
          Math.min(spec.redlineRpm, spec.idleRpm + gearRatioFrac * (spec.redlineRpm - spec.idleRpm)),
        );
        state.rpm = THREE.MathUtils.damp(state.rpm, targetRpm + throttleIn * 450, 10, dt);
        if (throttleIn > 0 && Math.abs(state.speedMs) < revMaxMs) {
          driveAccel = -throttleIn * Math.max(16, spec.accelFactor * 0.78);
        }
        if (brakeIn > 0 && state.speedMs < 0) {
          state.speedMs = Math.min(0, state.speedMs + brakeIn * 36 * dt);
        }
      } else {
        // Forward gear 1..6 with responsive launch and smooth top-end pull
        const gNum = Number(state.gear) || 1;
        const effectiveTopKmh = Math.max(85, spec.topSpeedKmh);
        const gearMaxKmh = effectiveTopKmh * (GEAR_SPEED_RATIOS[gNum] || 1);
        const gearMaxMs = gearMaxKmh / 3.6;
        const speedFrac = Math.max(0, state.speedMs / Math.max(4, gearMaxMs));
        const coupledRpm = spec.idleRpm + Math.min(1, speedFrac) * (spec.redlineRpm - spec.idleRpm);
        state.rpm = THREE.MathUtils.damp(
          state.rpm,
          Math.min(spec.redlineRpm * 1.02, coupledRpm + throttleIn * 420),
          12,
          dt,
        );

        const bogFactor =
          transmission === 'MT' && gNum >= 4 && speedFrac < 0.18 ? 0.72 : 1.0;
        const topCapMs = (effectiveTopKmh * (nitroActive ? 1.18 : 1.0)) / 3.6;
        const limiterFactor = state.speedMs >= topCapMs ? 0.0 : speedFrac >= 1.03 ? 0.25 : 1.0;
        const nitroBoost = nitroActive ? 1.55 : 1.0;
        const baseAccel = Math.max(22, spec.accelFactor * 0.92);

        if (throttleIn > 0) {
          if (state.speedMs < 0) {
            // Quickly transition from rolling backward into forward acceleration
            state.speedMs = Math.min(0, state.speedMs + throttleIn * 38 * dt);
          }
          driveAccel =
            throttleIn *
            baseAccel *
            (GEAR_TORQUE_MULT[gNum] || 1) *
            bogFactor *
            limiterFactor *
            nitroBoost;
        }
      }

      // Apply drive acceleration, braking, and light natural rolling drag
      state.speedMs += driveAccel * dt;

      if (brakeIn > 0 && state.speedMs > 0) {
        state.speedMs = Math.max(0, state.speedMs - brakeIn * 38 * dt);
      } else if (brakeIn > 0 && transmission === 'MT' && state.speedMs < 0 && throttleIn > 0) {
        state.speedMs = Math.min(0, state.speedMs + brakeIn * 32 * dt);
      }

      // Low rolling & aerodynamic drag so vehicle glides and accelerates effortlessly
      const drag = 0.26 + Math.abs(state.speedMs) * 0.012;
      if (Math.abs(throttleIn) < 0.05) {
        if (state.speedMs > 0) state.speedMs = Math.max(0, state.speedMs - drag * 3.1 * dt);
        else if (state.speedMs < 0 && brakeIn < 0.05) {
          state.speedMs = Math.min(0, state.speedMs + drag * 3.1 * dt);
        }
      } else {
        state.speedMs -= state.speedMs * 0.045 * dt;
      }

      // Responsive Ackermann-inspired steering (allows crisp low-speed turning too)
      const speedFactor =
        Math.abs(state.speedMs) > 0.15
          ? Math.max(0.38, Math.min(1, Math.abs(state.speedMs) / 4.2))
          : 0;
      const highSpeedDampen = 1 / (1 + Math.abs(state.speedMs) * 0.018);
      const directionSign = state.speedMs >= -0.1 ? 1 : -1;
      state.heading +=
        state.steerNorm * 2.55 * spec.handlingGrip * speedFactor * highSpeedDampen * directionSign * dt;

      // Forward vector in Three.js (-sin(h), 0, -cos(h))
      const fx = -Math.sin(state.heading);
      const fz = -Math.cos(state.heading);
      let nextX = state.x + fx * state.speedMs * dt;
      let nextZ = state.z + fz * state.speedMs * dt;

      // Outer perimeter gentle boundary
      nextX = Math.max(-420, Math.min(420, nextX));
      nextZ = Math.max(-420, Math.min(420, nextZ));

      // Smooth bumper collision resolution against Real 3D Houses
      for (const col of colliders) {
        const dx = nextX - col.x;
        const dz = nextZ - col.z;
        if (Math.abs(dx) < col.halfW && Math.abs(dz) < col.halfD) {
          const overlapX = col.halfW - Math.abs(dx);
          const overlapZ = col.halfD - Math.abs(dz);
          if (overlapX < overlapZ) {
            nextX += dx >= 0 ? overlapX : -overlapX;
          } else {
            nextZ += dz >= 0 ? overlapZ : -overlapZ;
          }
          state.speedMs *= 0.55;
        }
      }

      state.x = nextX;
      state.z = nextZ;
    };

    // Paced Render Loop with Software-WebGL fenceSync guard
    let frameId = 0;
    let unmounted = false;
    let prevTime = performance.now();
    let hudTimer = 0;
    let netTimer = 0;
    let birdSongTimer = 2.8;
    let birdSongCount = 0;
    let prevTod = latestPropsRef.current.timeOfDay;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 32);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 4);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 28);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    function tick() {
      if (unmounted) return;
      const now = performance.now();
      // Preserve real elapsed frame time (up to 0.20s) with fixed physics sub-stepping so vehicles NEVER run in slow-motion
      const dt = Math.min(0.2, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      const props = latestPropsRef.current;
      if (props.timeOfDay !== prevTod) {
        prevTod = props.timeOfDay;
        applyAtmosphere(props.timeOfDay);
      }

      const p1 = p1PhysicsRef.current;
      const p2 = p2PhysicsRef.current;
      const vIn = virtualInputRef.current;

      if (props.gameState === 'PLAYING') {
        // Player 1 Input: WASD (and Arrow keys when NOT in 2-player split screen)
        const allowArrowsForP1 = props.sessionMode !== 'SPLIT_2P';
        const p1Throttle =
          vIn.throttle || keys.has('KeyW') || (allowArrowsForP1 && keys.has('ArrowUp')) ? 1 : 0;
        const p1Brake =
          vIn.brake || keys.has('KeyS') || (allowArrowsForP1 && keys.has('ArrowDown')) ? 1 : 0;

        let p1SteerTarget = 0;
        if (vIn.steer !== null) {
          p1SteerTarget = -vIn.steer; // Dragging wheel right (+1) turns heading right (-1)
        } else {
          if (keys.has('KeyA') || (allowArrowsForP1 && keys.has('ArrowLeft'))) p1SteerTarget += 1;
          if (keys.has('KeyD') || (allowArrowsForP1 && keys.has('ArrowRight'))) p1SteerTarget -= 1;
        }

        const nitroWanted = vIn.nitro || keys.has('ShiftLeft') || keys.has('Space');
        const nitroActive = nitroWanted && p1.nitroPct > 2 && p1Throttle > 0;
        if (nitroActive) {
          p1.nitroPct = Math.max(0, p1.nitroPct - 24 * dt);
        } else {
          p1.nitroPct = Math.min(100, p1.nitroPct + 11 * dt);
        }

        // Sub-step vehicle physics so handling & acceleration are 100% consistent at any framerate
        const subSteps = Math.max(1, Math.ceil(dt / 0.025));
        const subDt = dt / subSteps;
        for (let s = 0; s < subSteps; s++) {
          stepDriverPhysics(
            p1,
            p1Spec,
            props.p1Transmission,
            p1Throttle,
            p1Brake,
            p1SteerTarget,
            nitroActive,
            subDt,
          );
        }

        p1.lapTimeSec += dt;
        const speedKmh = Math.abs(p1.speedMs) * 3.6;
        if (speedKmh > p1.topSpeedKmh) p1.topSpeedKmh = speedKmh;

        // 4-Minute Add Time Race Countdown & Manual Celebration Trigger
        if (props.driveMode === 'RACE_4MIN' && !p1.allWinAwarded) {
          p1.raceRemainingSec = Math.max(0, p1.raceRemainingSec - dt);
          if (props.celebrateAllWinSeq !== prevCelebrateSeqRef.current) {
            prevCelebrateSeqRef.current = props.celebrateAllWinSeq;
            buildAndEmitAllWinSummary();
          } else if (p1.raceRemainingSec <= 0) {
            buildAndEmitAllWinSummary();
          }
        } else if (props.celebrateAllWinSeq !== prevCelebrateSeqRef.current) {
          prevCelebrateSeqRef.current = props.celebrateAllWinSeq;
        }

        // Update Web Audio Engine Tone
        soundEngine.updateEngine(p1.rpm, p1Throttle, p1Spec, true);

        // Checkpoint Ceremony Detection + Add Time (+15s) & Collective All-Win Medals in RACE_4MIN
        if (metaStages.length > 0 && !p1.finished) {
          syncMetaStageToCheckpoint(p1.checkpointIdx);
          const animTime = now * 0.001;
          for (let mIdx = 0; mIdx < metaStages.length; mIdx++) {
            metaStages[mIdx].stage.updateAnimation(animTime + mIdx * 0.7);
          }

          const activeEntry = metaStages[p1.checkpointIdx % metaStages.length];
          const cp = activeEntry.cp;
          const distSq = (p1.x - cp.x) * (p1.x - cp.x) + (p1.z - cp.z) * (p1.z - cp.z);
          if (distSq < 10.6 * 10.6) {
            const plan = activeEntry.plan;

            if (plan.isGrandFinale) {
              soundEngine.playGrandTrophyFanfare();
            } else {
              soundEngine.playCheckpointChime();
            }

            // In 4-Minute Add Time Race Mode, every checkpoint adds +15s bonus time!
            if (props.driveMode === 'RACE_4MIN') {
              p1.raceRemainingSec = Math.min(360, p1.raceRemainingSec + 15);
              p1.addTimeBonusSec += 15;
            }

            if (props.onAwardDelivered) {
              props.onAwardDelivered({
                id: `${map.id}_cp${plan.checkpointNumber}_${Date.now()}`,
                mapId: map.id,
                mapName: map.name,
                checkpointNumber: plan.checkpointNumber,
                totalCheckpoints: plan.totalCheckpoints,
                isGrandFinale: plan.isGrandFinale,
                presenterName: plan.presenterName,
                presenterRole: plan.presenterRole,
                awardTitle: plan.awardTitle,
                awardKind: plan.awardKind,
                photoUrl: plan.photoUrl,
                photoCropSlot: plan.photoCropSlot,
                timestamp: Date.now(),
              });
            }

            p1.checkpointsCollected += 1;
            p1.checkpointIdx = (p1.checkpointIdx + 1) % metaStages.length;
            syncMetaStageToCheckpoint(p1.checkpointIdx);

            // If P1 completes all checkpoints in 4-Minute Race Mode, automatically award medals to ALL participants!
            if (
              props.driveMode === 'RACE_4MIN' &&
              p1.checkpointsCollected >= metaStages.length &&
              !p1.allWinAwarded
            ) {
              buildAndEmitAllWinSummary();
            }
          }
        }

        // Player 2 Physics & Checkpoint Detection in Split-Screen 2P Mode (Arrow Keys + RightShift)
        if (props.sessionMode === 'SPLIT_2P') {
          p2Rig.group.visible = true;
          const p2Throttle = keys.has('ArrowUp') ? 1 : 0;
          const p2Brake = keys.has('ArrowDown') ? 1 : 0;
          let p2Steer = 0;
          if (keys.has('ArrowLeft')) p2Steer += 1;
          if (keys.has('ArrowRight')) p2Steer -= 1;
          const p2Nitro = keys.has('ShiftRight') || keys.has('Slash');

          stepDriverPhysics(p2, p2Spec, 'AT', p2Throttle, p2Brake, p2Steer, p2Nitro, dt);

          if (metaStages.length > 0) {
            const p2Target = metaStages[p2.checkpointIdx % metaStages.length].cp;
            const p2DistSq = (p2.x - p2Target.x) ** 2 + (p2.z - p2Target.z) ** 2;
            if (p2DistSq < 10.6 * 10.6) {
              soundEngine.playCheckpointChime();
              p2.checkpointsCollected += 1;
              p2.checkpointIdx = (p2.checkpointIdx + 1) % metaStages.length;
              if (props.driveMode === 'RACE_4MIN') {
                p1.raceRemainingSec = Math.min(360, p1.raceRemainingSec + 10);
                p1.addTimeBonusSec += 10;
              }
            }
          }
        } else {
          p2Rig.group.visible = false;
        }

        // Step Live Street Traffic & Companion Race Participants
        for (const agent of aiTraffic) {
          if (agent.path.length < 2) continue;
          const a = agent.path[agent.segIndex];
          const b = agent.path[(agent.segIndex + 1) % agent.path.length];
          const segDist = Math.max(1, Math.hypot(b.x - a.x, b.z - a.z));
          agent.t += (agent.speed * dt) / segDist;
          if (agent.t >= 1) {
            agent.t = 0;
            agent.segIndex = (agent.segIndex + 1) % (agent.path.length - 1);
            if (agent.isRaceParticipant) {
              agent.checkpointsPassed = (agent.checkpointsPassed || 1) + 1;
            }
          }
          const a2 = agent.path[agent.segIndex];
          const b2 = agent.path[agent.segIndex + 1];
          const ax = THREE.MathUtils.lerp(a2.x, b2.x, agent.t);
          const az = THREE.MathUtils.lerp(a2.z, b2.z, agent.t);
          const heading = Math.atan2(-(b2.x - a2.x), -(b2.z - a2.z));
          // Right-hand lane offset relative to travel direction
          const rightX = Math.cos(heading) * agent.laneOffset;
          const rightZ = -Math.sin(heading) * agent.laneOffset;
          agent.rig.group.position.set(ax + rightX, 0.05, az + rightZ);
          agent.rig.group.rotation.y = heading;
          agent.rig.wheelMeshes.forEach((w) => {
            w.rotation.x -= agent.speed * dt * 2.2;
          });
          if (agent.rig.cyclistLegs) {
            agent.pedalPhase += agent.speed * dt * 1.45;
            agent.rig.cyclistLegs.crank.rotation.x -= agent.speed * dt * 2.4;
            agent.rig.cyclistLegs.left.rotation.x = -0.35 + Math.sin(agent.pedalPhase) * 0.42;
            agent.rig.cyclistLegs.right.rotation.x = -0.35 - Math.sin(agent.pedalPhase) * 0.42;
          }
        }

        // Step 3D Walking Pedestrians with Real Human Photographs along sidewalks
        for (const ped of pedestrians) {
          const segLen = Math.max(1, Math.hypot(ped.bx - ped.ax, ped.bz - ped.az));
          ped.t += (ped.dir * ped.speed * dt) / segLen;
          if (ped.t >= 0.96) {
            ped.t = 0.96;
            ped.dir = -1;
          } else if (ped.t <= 0.04) {
            ped.t = 0.04;
            ped.dir = 1;
          }
          const px = THREE.MathUtils.lerp(ped.ax, ped.bx, ped.t);
          const pz = THREE.MathUtils.lerp(ped.az, ped.bz, ped.t);
          const vx = (ped.bx - ped.ax) * ped.dir;
          const vz = (ped.bz - ped.az) * ped.dir;
          const pedHeading = Math.atan2(-vx, -vz);
          ped.actor.group.position.x = px;
          ped.actor.group.position.z = pz;
          ped.actor.group.rotation.y = pedHeading;
          ped.walkPhase += ped.speed * dt * 4.8;
          ped.actor.updateWalk(ped.walkPhase);
        }
        // Animate Sky Pajaritos + Moving Water Waves & Volcano Plumes
        const animSec = now * 0.001;
        wildlifeHandle.update(animSec, dt);
        scenicWorld?.update(animSec, dt);

        // Gentle Ambient Songbird ("Pajaritos") Melodies
        birdSongTimer += dt;
        if (birdSongTimer >= 5.8) {
          birdSongTimer = 0;
          birdSongCount += 1;
          soundEngine.playBirdSongChirp(false);
        }
      } else {
        const animTime = now * 0.001;
        wildlifeHandle.update(animTime, dt);
        scenicWorld?.update(animTime, dt);
        for (let mIdx = 0; mIdx < metaStages.length; mIdx++) {
          metaStages[mIdx].stage.updateAnimation(animTime + mIdx * 0.7);
        }
        soundEngine.stopSilence();
      }

      // Sync Player 1 Visual Mesh, Wheels, Pedaling Cyclist, Brake Lights & 3D Cockpit Steering Wheel
      const cobbleVibration =
        map.houseStyle === 'colonial_gt' && Math.abs(p1.speedMs) > 2
          ? Math.sin(now * 0.045) * 0.012
          : 0;
      p1Rig.group.position.set(p1.x, 0.05 + cobbleVibration, p1.z);
      p1Rig.group.rotation.y = p1.heading;
      p1Rig.frontLeftPivot.rotation.y = p1.steerNorm * 0.52;
      p1Rig.frontRightPivot.rotation.y = p1.steerNorm * 0.52;
      p1Rig.cockpitWheel.rotation.z = p1.steerNorm * 3.2;
      if (p1LabelSprite) {
        p1LabelSprite.visible = props.cameraMode !== 'COCKPIT';
      }
      p1Rig.wheelMeshes.forEach((wm) => {
        wm.rotation.x -= p1.speedMs * dt * 2.8;
      });
      if (p1Rig.cyclistLegs) {
        const pPhase = now * 0.008 * Math.max(0.2, Math.abs(p1.speedMs));
        p1Rig.cyclistLegs.crank.rotation.x -= p1.speedMs * dt * 2.6;
        p1Rig.cyclistLegs.left.rotation.x =
          Math.abs(p1.speedMs) > 0.25 ? -0.35 + Math.sin(pPhase) * 0.44 : -0.25;
        p1Rig.cyclistLegs.right.rotation.x =
          Math.abs(p1.speedMs) > 0.25 ? -0.35 - Math.sin(pPhase) * 0.44 : -0.45;
      }
      p1Rig.brakeLights.emissiveIntensity =
        keys.has('KeyS') || virtualInputRef.current.brake ? 2.6 : 0.7;

      // Update 3D Overhead Route Guidance Arrows toward Active Meta ("todos puedan guiarse para llegar a la meta")
      const activeP1Cp =
        metaStages.length > 0 ? metaStages[p1.checkpointIdx % metaStages.length].cp : null;
      if (activeP1Cp && props.driveMode === 'RACE_4MIN' && props.cameraMode !== 'COCKPIT') {
        p1GuideArrow.update(p1.x, p1.z, activeP1Cp.x, activeP1Cp.z, now * 0.001, true);
      } else {
        p1GuideArrow.update(p1.x, p1.z, p1.x, p1.z, now * 0.001, false);
      }

      // Sync Player 2 Visual Mesh & 3D Route Guidance Arrow
      if (props.sessionMode === 'SPLIT_2P') {
        p2Rig.group.position.set(p2.x, 0.05, p2.z);
        p2Rig.group.rotation.y = p2.heading;
        p2Rig.frontLeftPivot.rotation.y = p2.steerNorm * 0.52;
        p2Rig.frontRightPivot.rotation.y = p2.steerNorm * 0.52;
        p2Rig.wheelMeshes.forEach((wm) => {
          wm.rotation.x -= p2.speedMs * dt * 2.8;
        });
        if (p2Rig.cyclistLegs) {
          const p2Phase = now * 0.008 * Math.max(0.2, Math.abs(p2.speedMs));
          p2Rig.cyclistLegs.crank.rotation.x -= p2.speedMs * dt * 2.6;
          p2Rig.cyclistLegs.left.rotation.x =
            Math.abs(p2.speedMs) > 0.25 ? -0.35 + Math.sin(p2Phase) * 0.44 : -0.25;
          p2Rig.cyclistLegs.right.rotation.x =
            Math.abs(p2.speedMs) > 0.25 ? -0.35 - Math.sin(p2Phase) * 0.44 : -0.45;
        }
        const activeP2Cp =
          metaStages.length > 0 ? metaStages[p2.checkpointIdx % metaStages.length].cp : null;
        if (activeP2Cp && props.driveMode === 'RACE_4MIN') {
          p2GuideArrow.update(p2.x, p2.z, activeP2Cp.x, activeP2Cp.z, now * 0.001 + 0.5, true);
        } else {
          p2GuideArrow.update(p2.x, p2.z, p2.x, p2.z, now * 0.001, false);
        }
      } else {
        p2GuideArrow.update(p2.x, p2.z, p2.x, p2.z, now * 0.001, false);
      }

      // Reconcile & Smoothly Interpolate Online Multiplayer Peers (Chosen Alias + Chosen Transport Overhead!)
      const activePeers = remotePlayersRef.current;
      for (const [peerId, peer] of activePeers.entries()) {
        let entry = remoteRigs.get(peerId);
        if (
          !entry ||
          entry.carId !== peer.carId ||
          entry.alias !== peer.alias ||
          entry.paintHex !== peer.paintHex ||
          entry.valueMessage !== peer.valueMessage
        ) {
          if (entry) {
            scene.remove(entry.rig.group);
            entry.rig.dispose();
          }
          const peerSpec = getCarById(peer.carId);
          const rig = createRealisticCarRig(
            peerSpec,
            peer.paintHex || peerSpec.defaultPaint,
            texPack.contactShadow,
            isSoftwareGl,
            peer.alias || 'Piloto en Línea',
            peer.valueMessage || peerSpec.valueMessage,
          );
          rig.group.position.set(peer.x, 0.05, peer.z);
          rig.group.rotation.y = peer.heading;
          scene.add(rig.group);
          entry = {
            rig,
            carId: peer.carId,
            alias: peer.alias,
            paintHex: peer.paintHex,
            valueMessage: peer.valueMessage,
          };
          remoteRigs.set(peerId, entry);
        }

        entry.rig.group.position.x = THREE.MathUtils.damp(entry.rig.group.position.x, peer.x, 10, dt);
        entry.rig.group.position.z = THREE.MathUtils.damp(entry.rig.group.position.z, peer.z, 10, dt);
        entry.rig.group.rotation.y = THREE.MathUtils.damp(
          entry.rig.group.rotation.y,
          peer.heading,
          10,
          dt,
        );
        entry.rig.frontLeftPivot.rotation.y = peer.steerAngle * 0.5;
        entry.rig.frontRightPivot.rotation.y = peer.steerAngle * 0.5;
        entry.rig.wheelMeshes.forEach((wm) => {
          wm.rotation.x -= (peer.speedKmh / 3.6) * dt * 2.5;
        });
        if (entry.rig.cyclistLegs) {
          const peerPhase = now * 0.006 * Math.max(0.2, peer.speedKmh / 3.6);
          entry.rig.cyclistLegs.left.rotation.x = -0.35 + Math.sin(peerPhase) * 0.4;
          entry.rig.cyclistLegs.right.rotation.x = -0.35 - Math.sin(peerPhase) * 0.4;
        }
      }
      for (const [peerId, entry] of remoteRigs.entries()) {
        if (!activePeers.has(peerId)) {
          scene.remove(entry.rig.group);
          entry.rig.dispose();
          remoteRigs.delete(peerId);
        }
      }

      // Camera 1 Choreography (Rock-Steady Follow Distance & Fixed FOV — Zero Zoom Oscillation!)
      const sinH = Math.sin(p1.heading);
      const cosH = Math.cos(p1.heading);
      const descentSec = (now - descentStartTimeRef.current) / 1000;
      const isDescendingFromSky = props.sessionMode !== 'SPLIT_2P' && descentSec < 1.35;

      let targetFov = 60;
      if (props.cameraMode === 'COCKPIT') {
        // Real 1st-person seat tailored to Car, Electric Quad/Trike, Pickup 4x4, Tuk Tuk, Bicicleta or Heavy Camión
        const isCenterRider =
          p1Spec.bodyStyle === 'tuk_tuk' ||
          p1Spec.bodyStyle === 'bicycle' ||
          p1Spec.bodyStyle === 'electric_quad_trike' ||
          p1Spec.bodyStyle === 'electric_tricycle';
        const lateralSeat = isCenterRider
          ? 0
          : p1Spec.bodyStyle === 'heavy_truck'
            ? -0.58
            : p1Spec.bodyStyle === 'pickup_truck'
              ? -0.38
              : -0.34;
        const eyeHeight =
          p1Spec.bodyStyle === 'heavy_truck'
            ? 2.24
            : p1Spec.bodyStyle === 'pickup_truck'
              ? 1.52
              : p1Spec.bodyStyle === 'bicycle'
                ? 1.54
                : p1Spec.bodyStyle === 'electric_quad_trike' ||
                    p1Spec.bodyStyle === 'electric_tricycle' ||
                    p1Spec.bodyStyle === 'tuk_tuk'
                  ? 1.4
                  : 1.16;
        const forwardEye =
          p1Spec.bodyStyle === 'heavy_truck'
            ? 1.85
            : p1Spec.bodyStyle === 'pickup_truck'
              ? 0.65
              : p1Spec.bodyStyle === 'tuk_tuk' || p1Spec.bodyStyle === 'electric_tricycle'
                ? 0.32
                : p1Spec.bodyStyle === 'electric_quad_trike'
                  ? 0.16
                  : 0.05;
        const rightX = cosH * lateralSeat;
        const rightZ = -sinH * lateralSeat;
        _camIdealPos.set(
          p1.x + rightX - sinH * forwardEye,
          eyeHeight + cobbleVibration * 0.4,
          p1.z + rightZ - cosH * forwardEye,
        );
        _camIdealLook.set(p1.x - sinH * 28, eyeHeight - 0.12, p1.z - cosH * 28);
        targetFov = 66;
      } else if (props.cameraMode === 'AERIAL') {
        if (realMapOverlayMode) {
          _camIdealPos.set(p1.x + sinH * 0.02, 32, p1.z + cosH * 0.02);
          _camIdealLook.set(p1.x, 0, p1.z);
          targetFov = 54;
        } else {
          _camIdealPos.set(p1.x + sinH * 14, 42, p1.z + cosH * 14);
          _camIdealLook.set(p1.x - sinH * 10, 0.5, p1.z - cosH * 10);
          targetFov = 58;
        }
      } else {
        if (realMapOverlayMode) {
          _camIdealPos.set(p1.x + sinH * 7.2, 8.8, p1.z + cosH * 7.2);
          _camIdealLook.set(p1.x - sinH * 7, 0.25, p1.z - cosH * 7);
          targetFov = 58;
        } else {
          // Fixed chase distance (7.6m) & fixed FOV (60°) so steering or accelerating NEVER zooms the screen in and out
          const chaseDist = 7.6;
          _camIdealPos.set(p1.x + sinH * chaseDist, 2.85, p1.z + cosH * chaseDist);
          _camIdealLook.set(p1.x - sinH * 6.5, 1.1, p1.z - cosH * 6.5);
          targetFov = 60;
        }
      }

      if (Math.abs(cam1.fov - targetFov) > 0.05) {
        cam1.fov = targetFov;
        cam1.updateProjectionMatrix();
      }

      if (isDescendingFromSky) {
        const t = Math.min(1, Math.max(0, descentSec / 1.35));
        const ease = 1 - Math.pow(1 - t, 3);
        const skyY = 68;
        const skyBack = 20;
        cam1.position.set(
          THREE.MathUtils.lerp(p1.x + sinH * skyBack, _camIdealPos.x, ease),
          THREE.MathUtils.lerp(skyY, _camIdealPos.y, ease),
          THREE.MathUtils.lerp(p1.z + cosH * skyBack, _camIdealPos.z, ease),
        );
        cam1.lookAt(
          THREE.MathUtils.lerp(p1.x, _camIdealLook.x, ease),
          THREE.MathUtils.lerp(0, _camIdealLook.y, ease),
          THREE.MathUtils.lerp(p1.z, _camIdealLook.z, ease),
        );
      } else if (props.cameraMode === 'COCKPIT' || (props.cameraMode === 'AERIAL' && realMapOverlayMode)) {
        cam1.position.copy(_camIdealPos);
        cam1.lookAt(_camIdealLook);
      } else if (props.cameraMode === 'AERIAL') {
        cam1.position.lerp(_camIdealPos, 1 - Math.exp(-9 * dt));
        cam1.lookAt(_camIdealLook);
      } else {
        // Lock camera rigidly at exact 7.6m distance behind vehicle so turning never shortens chord distance (zero zoom!)
        cam1.position.copy(_camIdealPos);
        cam1.lookAt(_camIdealLook);
      }

      // Render Full Viewport OR Dual Split-Screen Viewport (2 Usuarios Local)
      const cw = container?.clientWidth || window.innerWidth;
      const ch = container?.clientHeight || window.innerHeight;

      if (props.sessionMode === 'SPLIT_2P') {
        const halfW = Math.floor(cw / 2);
        renderer.setScissorTest(true);

        // Left Viewport: Player 1
        cam1.aspect = halfW / ch;
        cam1.updateProjectionMatrix();
        renderer.setViewport(0, 0, halfW - 1, ch);
        renderer.setScissor(0, 0, halfW - 1, ch);
        renderer.render(scene, cam1);

        // Right Viewport: Player 2
        const sinH2 = Math.sin(p2.heading);
        const cosH2 = Math.cos(p2.heading);
        _p2CamIdealPos.set(p2.x + sinH2 * 7.6, 2.9, p2.z + cosH2 * 7.6);
        cam2.position.lerp(_p2CamIdealPos, 1 - Math.exp(-9.5 * dt));
        _p2CamIdealLook.set(p2.x - sinH2 * 6.5, 1.1, p2.z - cosH2 * 6.5);
        cam2.lookAt(_p2CamIdealLook);
        cam2.aspect = (cw - halfW) / ch;
        cam2.updateProjectionMatrix();

        renderer.setViewport(halfW + 1, 0, cw - halfW - 1, ch);
        renderer.setScissor(halfW + 1, 0, cw - halfW - 1, ch);
        renderer.render(scene, cam2);

        renderer.setScissorTest(false);
      } else {
        renderer.setScissorTest(false);
        if (Math.abs(cam1.aspect - cw / ch) > 0.01) {
          cam1.aspect = cw / ch;
          cam1.updateProjectionMatrix();
        }
        renderer.setViewport(0, 0, cw, ch);
        renderer.render(scene, cam1);
      }

      // Emit multiplayer delta (~16 Hz)
      netTimer += dt;
      if (netTimer >= 0.06 && props.sessionMode === 'ONLINE_MULTI' && props.onLocalNetworkTick) {
        netTimer = 0;
        props.onLocalNetworkTick({
          x: p1.x,
          z: p1.z,
          heading: p1.heading,
          steerAngle: p1.steerNorm,
          speedKmh: Math.abs(p1.speedMs) * 3.6,
          gear: p1.gear,
          checkpoints: p1.checkpointsCollected,
        });
      }

      // Emit HUD Telemetry (~15 Hz so React stays silky smooth)
      hudTimer += dt;
      if (hudTimer >= 0.065) {
        hudTimer = 0;
        const activeCp =
          map.checkpoints.length > 0
            ? map.checkpoints[p1.checkpointIdx % map.checkpoints.length]
            : null;
        let cpDist = 0;
        let cpRelAngle = 0;
        if (activeCp) {
          cpDist = Math.hypot(activeCp.x - p1.x, activeCp.z - p1.z);
          const targetBearing = Math.atan2(-(activeCp.x - p1.x), -(activeCp.z - p1.z));
          let diff = targetBearing - p1.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          cpRelAngle = diff;
        }
        const companionCount = aiTraffic.filter((ag) => ag.isRaceParticipant).length;
        const onlineCount = props.sessionMode === 'ONLINE_MULTI' ? activePeers.size : 0;
        const localDriversCount = props.sessionMode === 'SPLIT_2P' ? 2 : 1;

        props.onTelemetry(
          {
            speedKmh: Math.abs(p1.speedMs) * 3.6,
            rpm: p1.rpm,
            redlineRpm: p1Spec.redlineRpm,
            gear: p1.gear,
            transmission: props.p1Transmission,
            steerDegrees: -p1.steerNorm * 380,
            throttle:
              vIn.throttle || keys.has('KeyW') || (props.sessionMode !== 'SPLIT_2P' && keys.has('ArrowUp'))
                ? 1
                : 0,
            brake:
              vIn.brake || keys.has('KeyS') || (props.sessionMode !== 'SPLIT_2P' && keys.has('ArrowDown'))
                ? 1
                : 0,
            streetName: findStreetName(p1.x, p1.z),
            lat: 0,
            lon: 0,
            x: p1.x,
            z: p1.z,
            heading: p1.heading,
            checkpointsCollected: p1.checkpointsCollected,
            totalCheckpoints: map.checkpoints.length,
            lapTimeSec: p1.lapTimeSec,
            nitroPct: p1.nitroPct,
            driveMode: props.driveMode,
            raceRemainingSec: props.driveMode === 'RACE_4MIN' ? p1.raceRemainingSec : 240,
            addTimeBonusSec: props.driveMode === 'RACE_4MIN' ? p1.addTimeBonusSec : 0,
            nextCheckpointDistMeters: Math.round(cpDist),
            nextCheckpointRelAngleRad: cpRelAngle,
            participantCount: localDriversCount + onlineCount + companionCount,
            currentPresenterName: activeAwardPlan?.presenterName,
            currentAwardTitle: activeAwardPlan?.awardTitle,
            p2SpeedKmh: props.sessionMode === 'SPLIT_2P' ? Math.abs(p2.speedMs) * 3.6 : undefined,
            p2Gear: props.sessionMode === 'SPLIT_2P' ? p2.gear : undefined,
            p2Rpm: props.sessionMode === 'SPLIT_2P' ? p2.rpm : undefined,
            p2StreetName:
              props.sessionMode === 'SPLIT_2P' ? findStreetName(p2.x, p2.z) : undefined,
            p2CheckpointsCollected:
              props.sessionMode === 'SPLIT_2P' ? p2.checkpointsCollected : undefined,
          },
          activeCp,
          props.sessionMode === 'SPLIT_2P' ? { x: p2.x, z: p2.z, heading: p2.heading } : null,
        );
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      soundEngine.stopSilence();

      p1Rig.dispose();
      p2Rig.dispose();
      p1GuideArrow.dispose();
      p2GuideArrow.dispose();
      metaStages.forEach((ms) => ms.stage.dispose());
      aiTraffic.forEach((a) => a.rig.dispose());
      pedestrians.forEach((p) => p.actor.dispose());
      remoteRigs.forEach((r) => r.rig.dispose());
      scenicWorld?.dispose();
      wildlifeHandle.dispose();
      circuitInfra.dispose();
      texPack.dispose();
      envTex.dispose();
      pedestriansTex.dispose();
      grandTrophyTex.dispose();
      welcomeBillboardTex?.dispose();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        } else if ((obj as THREE.Sprite).isSprite) {
          const sp = obj as THREE.Sprite;
          sp.material?.map?.dispose();
          sp.material?.dispose();
        }
      });
      renderer.dispose();
    };
  }, [
    map,
    extraRoads,
    realMapOverlayMode,
    driveMode,
    sessionMode,
    p1CarId,
    p1Paint,
    p1Alias,
    p2CarId,
    p2Paint,
    p2Alias,
  ]);

  return (
    <div
      className={`game-viewport-lock relative w-full h-full overflow-hidden ${
        realMapOverlayMode ? 'bg-transparent z-10' : 'bg-[#090d16]'
      }`}
    >
      <div ref={mountRef} className="w-full h-full touch-none" />
      {sessionMode === 'SPLIT_2P' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-amber-500/80 z-10"
        />
      )}
    </div>
  );
};
