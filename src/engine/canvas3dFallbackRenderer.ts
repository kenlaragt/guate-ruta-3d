import { getCarById } from '../data/carsCatalog';
import { drawSafeRoundRect } from './proceduralTextures';
import {
  CameraMode,
  CarModelId,
  CarSpec,
  LandmarkSpec,
  RoadNode2D,
  RoadSegmentSpec,
  TimeOfDay,
  WorldMapSpec,
} from '../types/game';

export interface FallbackCameraSpec {
  posX: number;
  posY: number;
  posZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fovDeg: number;
}

export interface FallbackVehicleActor {
  x: number;
  y: number;
  z: number;
  heading: number;
  steerNorm: number;
  speedMs: number;
  spec: CarSpec;
  paintHex: string;
  alias?: string;
  valueMessage?: string;
  braking?: boolean;
  hideMeshForCockpit?: boolean;
}

export interface FallbackHouseBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  wallColor: string;
  roofColor: string;
  rotY: number;
}

export interface FallbackTreeProp {
  x: number;
  z: number;
  scale: number;
  crownColor: string;
  isCone: boolean;
}

export interface FallbackPedestrianProp {
  x: number;
  z: number;
  heading: number;
  walkPhase: number;
  shirtColor: string;
}

export interface FallbackCheckpointStage {
  x: number;
  z: number;
  heading: number;
  isActive: boolean;
  label: string;
  isGrandFinale?: boolean;
}

export interface FallbackSceneData {
  map: WorldMapSpec;
  allRoads: RoadSegmentSpec[];
  houses: FallbackHouseBox[];
  trees: FallbackTreeProp[];
  checkpoints: FallbackCheckpointStage[];
  pedestrians: FallbackPedestrianProp[];
}

export interface FallbackRenderFrameInput {
  ctx: CanvasRenderingContext2D;
  vpX: number;
  vpY: number;
  vpW: number;
  vpH: number;
  camera: FallbackCameraSpec;
  cameraMode: CameraMode;
  timeOfDay: TimeOfDay;
  realMapOverlayMode: boolean;
  nowSec: number;
  sceneData: FallbackSceneData;
  vehicles: FallbackVehicleActor[];
  cockpitDriver?: {
    spec: CarSpec;
    paintHex: string;
    steerNorm: number;
    speedKmh: number;
    rpm: number;
    gear: string;
  };
  guideArrow?: {
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    colorHex: string;
    visible: boolean;
  };
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPt {
  sx: number;
  sy: number;
  zCam: number;
}

interface CameraBasis {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
  fx: number;
  fy: number;
  fz: number;
  focal: number;
  vpX: number;
  vpY: number;
  vpW: number;
  vpH: number;
}

const NEAR_Z = 0.35;

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

function buildCameraBasis(
  cam: FallbackCameraSpec,
  vpX: number,
  vpY: number,
  vpW: number,
  vpH: number,
): CameraBasis {
  let fx = cam.lookX - cam.posX;
  let fy = cam.lookY - cam.posY;
  let fz = cam.lookZ - cam.posZ;
  const fLen = Math.hypot(fx, fy, fz) || 1;
  fx /= fLen;
  fy /= fLen;
  fz /= fLen;

  // World up = (0, 1, 0), fallback if looking straight down
  let upRefX = 0;
  let upRefY = 1;
  let upRefZ = 0;
  if (Math.abs(fy) > 0.985) {
    upRefX = 0;
    upRefY = 0;
    upRefZ = -1;
  }

  // right = normalize(cross(fwd, upRef))
  let rx = fy * upRefZ - fz * upRefY;
  let ry = fz * upRefX - fx * upRefZ;
  let rz = fx * upRefY - fy * upRefX;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // up = cross(right, fwd)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  const fovRad = (cam.fovDeg * Math.PI) / 180;
  const focal = (vpH * 0.5) / Math.tan(fovRad * 0.5);

  return {
    cx: cam.posX,
    cy: cam.posY,
    cz: cam.posZ,
    rx,
    ry,
    rz,
    ux,
    uy,
    uz,
    fx,
    fy,
    fz,
    focal,
    vpX,
    vpY,
    vpW,
    vpH,
  };
}

function worldToCam(b: CameraBasis, wx: number, wy: number, wz: number): Vec3 {
  const dx = wx - b.cx;
  const dy = wy - b.cy;
  const dz = wz - b.cz;
  return {
    x: dx * b.rx + dy * b.ry + dz * b.rz,
    y: dx * b.ux + dy * b.uy + dz * b.uz,
    z: dx * b.fx + dy * b.fy + dz * b.fz,
  };
}

function projectPoint(b: CameraBasis, wx: number, wy: number, wz: number): ProjectedPt | null {
  const c = worldToCam(b, wx, wy, wz);
  if (c.z < NEAR_Z) return null;
  const invZ = b.focal / c.z;
  return {
    sx: b.vpX + b.vpW * 0.5 + c.x * invZ,
    sy: b.vpY + b.vpH * 0.5 - c.y * invZ,
    zCam: c.z,
  };
}

function clipAndProjectPolygon(b: CameraBasis, worldPts: Vec3[]): ProjectedPt[] | null {
  if (worldPts.length < 3) return null;
  const camPts = worldPts.map((p) => worldToCam(b, p.x, p.y, p.z));
  const clipped: Vec3[] = [];

  for (let i = 0; i < camPts.length; i++) {
    const cur = camPts[i];
    const prev = camPts[(i + camPts.length - 1) % camPts.length];
    const curIn = cur.z >= NEAR_Z;
    const prevIn = prev.z >= NEAR_Z;

    if (curIn !== prevIn) {
      const t = (NEAR_Z - prev.z) / (cur.z - prev.z);
      clipped.push({
        x: prev.x + (cur.x - prev.x) * t,
        y: prev.y + (cur.y - prev.y) * t,
        z: NEAR_Z,
      });
    }
    if (curIn) {
      clipped.push(cur);
    }
  }

  if (clipped.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const out: ProjectedPt[] = new Array(clipped.length);
  for (let i = 0; i < clipped.length; i++) {
    const c = clipped[i];
    const invZ = b.focal / c.z;
    const sx = b.vpX + b.vpW * 0.5 + c.x * invZ;
    const sy = b.vpY + b.vpH * 0.5 - c.y * invZ;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
    out[i] = { sx, sy, zCam: c.z };
  }

  // Frustum screen bounds rejection
  if (
    maxX < b.vpX - 80 ||
    minX > b.vpX + b.vpW + 80 ||
    maxY < b.vpY - 80 ||
    minY > b.vpY + b.vpH + 80
  ) {
    return null;
  }

  return out;
}

function fillProjectedPoly(
  ctx: CanvasRenderingContext2D,
  pts: ProjectedPt[] | null,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 1,
) {
  if (!pts || pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].sx, pts[i].sy);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawExtrudedBox3D(
  ctx: CanvasRenderingContext2D,
  b: CameraBasis,
  cx: number,
  baseY: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  rotY: number,
  topColor: string,
  frontBackColor: string,
  sideColor: string,
  strokeColor?: string,
) {
  const sinR = Math.sin(rotY);
  const cosR = Math.cos(rotY);
  const hw = w * 0.5;
  const hd = d * 0.5;

  const toWorld = (lx: number, ly: number, lz: number): Vec3 => ({
    x: cx + lx * cosR + lz * sinR,
    y: baseY + ly,
    z: cz - lx * sinR + lz * cosR,
  });

  // 8 corners
  const b0 = toWorld(-hw, 0, -hd);
  const b1 = toWorld(hw, 0, -hd);
  const b2 = toWorld(hw, 0, hd);
  const b3 = toWorld(-hw, 0, hd);
  const t0 = toWorld(-hw, h, -hd);
  const t1 = toWorld(hw, h, -hd);
  const t2 = toWorld(hw, h, hd);
  const t3 = toWorld(-hw, h, hd);

  const faces: Array<{ pts: Vec3[]; color: string; depth: number }> = [
    { pts: [b0, b1, t1, t0], color: frontBackColor, depth: 0 }, // front (-Z)
    { pts: [b2, b3, t3, t2], color: frontBackColor, depth: 0 }, // back (+Z)
    { pts: [b1, b2, t2, t1], color: sideColor, depth: 0 }, // right (+X)
    { pts: [b3, b0, t0, t3], color: sideColor, depth: 0 }, // left (-X)
    { pts: [t0, t1, t2, t3], color: topColor, depth: 0 }, // top (+Y)
  ];

  for (const f of faces) {
    const mx = (f.pts[0].x + f.pts[2].x) * 0.5;
    const my = (f.pts[0].y + f.pts[2].y) * 0.5;
    const mz = (f.pts[0].z + f.pts[2].z) * 0.5;
    f.depth = Math.hypot(mx - b.cx, my - b.cy, mz - b.cz);
  }

  faces.sort((a, c) => c.depth - a.depth);
  for (const f of faces) {
    const proj = clipAndProjectPolygon(b, f.pts);
    fillProjectedPoly(ctx, proj, f.color, strokeColor, 0.8);
  }
}

export function buildFallbackSceneData(
  map: WorldMapSpec,
  allRoads: RoadSegmentSpec[],
  collidersOut: Array<{ x: number; z: number; halfW: number; halfD: number }>,
): FallbackSceneData {
  const houses: FallbackHouseBox[] = [];
  const trees: FallbackTreeProp[] = [];
  const pedestrians: FallbackPedestrianProp[] = [];

  const isClear = (cx: number, cz: number, minPad: number): boolean => {
    for (const seg of allRoads) {
      const req = seg.width * 0.5 + minPad;
      const reqSq = req * req;
      for (let i = 0; i < seg.points.length - 1; i++) {
        const a = seg.points[i];
        const bPt = seg.points[i + 1];
        const vx = bPt.x - a.x;
        const vz = bPt.z - a.z;
        const wx = cx - a.x;
        const wz = cz - a.z;
        const lenSq = vx * vx + vz * vz;
        const t = lenSq < 0.001 ? 0 : Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
        const dx = cx - (a.x + t * vx);
        const dz = cz - (a.z + t * vz);
        if (dx * dx + dz * dz < reqSq) return false;
      }
    }
    for (const lm of map.landmarks) {
      if ((cx - lm.x) ** 2 + (cz - lm.z) ** 2 < 24 * 24) return false;
    }
    return true;
  };

  const colonialPalette = ['#fef3c7', '#fde68a', '#ffedd5', '#fee2e2', '#e0f2fe', '#f3e8ff'];
  const modernPalette = ['#f8fafc', '#e2e8f0', '#dbeafe', '#fef9c3', '#f1f5f9'];
  const palette = map.houseStyle === 'colonial_gt' ? colonialPalette : modernPalette;
  const roofPalette =
    map.houseStyle === 'colonial_gt' || map.houseStyle === 'latin_residential'
      ? ['#9a3412', '#b45309', '#7c2d12']
      : ['#334155', '#475569', '#1e293b'];

  let seed = 1;
  for (const seg of map.isClosedCircuit || map.isZooSafari ? [] : map.roads) {
    for (let i = 0; i < seg.points.length - 1; i++) {
      const a = seg.points[i];
      const bPt = seg.points[i + 1];
      const dx = bPt.x - a.x;
      const dz = bPt.z - a.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 28) continue;
      const ux = dx / segLen;
      const uz = dz / segLen;
      const nx = -uz;
      const nz = ux;

      for (let dist = 20; dist < segLen - 20; dist += 28) {
        for (const side of [-1, 1]) {
          seed++;
          const hw = 10 + (seed % 3) * 1.8;
          const hd = 9 + ((seed * 3) % 3) * 1.5;
          const hh = map.houseStyle === 'colonial_gt' && seed % 2 === 0 ? 4.5 : 6.8 + (seed % 3) * 1.6;
          const setback = seg.width * 0.5 + hd * 0.5 + 3.2;
          const hx = a.x + ux * dist + nx * side * setback;
          const hz = a.z + uz * dist + nz * side * setback;

          const hitsExisting = collidersOut.some(
            (c) =>
              Math.abs(c.x - hx) < c.halfW + hw * 0.5 + 1.5 &&
              Math.abs(c.z - hz) < c.halfD + hd * 0.5 + 1.5,
          );
          if (hitsExisting || !isClear(hx, hz, Math.max(hw, hd) * 0.52)) continue;

          houses.push({
            x: hx,
            z: hz,
            w: hw,
            d: hd,
            h: hh,
            wallColor: palette[seed % palette.length],
            roofColor: roofPalette[seed % roofPalette.length],
            rotY: Math.atan2(-nx * side, -nz * side),
          });
          collidersOut.push({
            x: hx,
            z: hz,
            halfW: hw * 0.5 + 0.7,
            halfD: hd * 0.5 + 0.7,
          });
          if (houses.length >= 90) break;
        }
        if (houses.length >= 90) break;
      }
      if (houses.length >= 90) break;
    }
  }

  for (let t = 0; t < 200 && trees.length < 95; t++) {
    const angle = t * 2.39996;
    const rad = 22 + ((t * 19) % 320);
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    if (!isClear(tx, tz, 3.2)) continue;
    const hitsHouse = collidersOut.some(
      (c) => Math.abs(c.x - tx) < c.halfW + 1.6 && Math.abs(c.z - tz) < c.halfD + 1.6,
    );
    if (hitsHouse) continue;
    const crownColor =
      map.foliageType === 'jacaranda' && t % 3 === 0
        ? '#8b5cf6'
        : map.foliageType === 'palm'
          ? '#16a34a'
          : t % 2 === 0
            ? '#15803d'
            : '#166534';
    trees.push({
      x: tx,
      z: tz,
      scale: 0.85 + (t % 5) * 0.08,
      crownColor,
      isCone: map.foliageType === 'pine' || map.foliageType === 'cypress',
    });
  }

  const shirtColors = ['#ef4444', '#0284c7', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
  for (let s = 0; s < 12; s++) {
    const seg = map.roads[s % Math.max(1, map.roads.length)];
    if (!seg || seg.points.length < 2) continue;
    const a = seg.points[0];
    const bPt = seg.points[1];
    const dx = bPt.x - a.x;
    const dz = bPt.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const side = s % 2 === 0 ? 1 : -1;
    const frac = 0.2 + ((s * 0.17) % 0.65);
    pedestrians.push({
      x: a.x + dx * frac + nx * side * (seg.width * 0.5 + 1.4),
      z: a.z + dz * frac + nz * side * (seg.width * 0.5 + 1.4),
      heading: Math.atan2(-dx, -dz),
      walkPhase: s * 1.1,
      shirtColor: shirtColors[s % shirtColors.length],
    });
  }

  const checkpoints: FallbackCheckpointStage[] = map.checkpoints.map((cp, idx) => {
    let bestHeading = map.spawn.heading;
    let bestSq = Infinity;
    for (const seg of allRoads) {
      for (let i = 0; i < seg.points.length - 1; i++) {
        const a = seg.points[i];
        const bPt = seg.points[i + 1];
        const dSq = (cp.x - a.x) ** 2 + (cp.z - a.z) ** 2;
        if (dSq < bestSq) {
          bestSq = dSq;
          bestHeading = Math.atan2(-(bPt.x - a.x), -(bPt.z - a.z));
        }
      }
    }
    return {
      x: cp.x,
      z: cp.z,
      heading: bestHeading,
      isActive: idx === 0,
      label: idx === map.checkpoints.length - 1 ? 'GRAN META' : `META ${idx + 1}`,
      isGrandFinale: idx === map.checkpoints.length - 1,
    };
  });

  return {
    map,
    allRoads,
    houses,
    trees,
    checkpoints,
    pedestrians,
  };
}

function drawLandmark3D(ctx: CanvasRenderingContext2D, b: CameraBasis, lm: LandmarkSpec) {
  const rot = lm.rotationY || 0;
  if (lm.kind === 'maya_pyramid') {
    drawExtrudedBox3D(ctx, b, lm.x, 0, lm.z, 22, 4.5, 22, rot, '#d6d3d1', '#a8a29e', '#78716c');
    drawExtrudedBox3D(ctx, b, lm.x, 4.5, lm.z, 16, 4.2, 16, rot, '#d6d3d1', '#a8a29e', '#78716c');
    drawExtrudedBox3D(ctx, b, lm.x, 8.7, lm.z, 10, 3.8, 10, rot, '#e7e5e4', '#a8a29e', '#78716c');
    drawExtrudedBox3D(ctx, b, lm.x, 12.5, lm.z, 5.2, 5.2, 5.2, rot, '#f5f5f4', '#d6d3d1', '#a8a29e');
  } else if (lm.kind === 'arch_catalina') {
    drawExtrudedBox3D(ctx, b, lm.x - 4.5, 0, lm.z, 3.2, 8.5, 3.6, rot, '#fde047', '#facc15', '#eab308');
    drawExtrudedBox3D(ctx, b, lm.x + 4.5, 0, lm.z, 3.2, 8.5, 3.6, rot, '#fde047', '#facc15', '#eab308');
    drawExtrudedBox3D(ctx, b, lm.x, 5.8, lm.z, 12.4, 3.8, 3.8, rot, '#fef08a', '#facc15', '#ca8a04');
  } else if (lm.kind === 'cristo_redentor') {
    drawExtrudedBox3D(ctx, b, lm.x, 0, lm.z, 8, 7, 8, rot, '#cbd5e1', '#94a3b8', '#64748b');
    drawExtrudedBox3D(ctx, b, lm.x, 7, lm.z, 3.2, 14, 2.8, rot, '#f8fafc', '#e2e8f0', '#cbd5e1');
    drawExtrudedBox3D(ctx, b, lm.x, 16.5, lm.z, 13.5, 2.0, 2.0, rot, '#f8fafc', '#e2e8f0', '#cbd5e1');
  } else {
    drawExtrudedBox3D(ctx, b, lm.x, 0, lm.z, 14, 9.5, 12, rot, '#fef3c7', '#fde68a', '#f59e0b');
    drawExtrudedBox3D(ctx, b, lm.x, 9.5, lm.z, 6, 5.5, 6, rot, '#fffbeb', '#fef3c7', '#d97706');
  }

  const labelPt = projectPoint(b, lm.x, 16.5, lm.z);
  if (labelPt && labelPt.zCam < 240) {
    ctx.save();
    ctx.font = '700 11px "Chakra Petch", sans-serif';
    const textW = ctx.measureText(lm.name).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    drawSafeRoundRect(ctx, labelPt.sx - textW * 0.5 - 6, labelPt.sy - 10, textW + 12, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lm.name, labelPt.sx, labelPt.sy - 1);
    ctx.restore();
  }
}

function drawCheckpointStage3D(
  ctx: CanvasRenderingContext2D,
  b: CameraBasis,
  cp: FallbackCheckpointStage,
  nowSec: number,
) {
  const sinH = Math.sin(cp.heading);
  const cosH = Math.cos(cp.heading);
  const rightX = cosH;
  const rightZ = -sinH;
  const halfSpan = 5.8;

  const pillarColor = cp.isActive ? '#facc15' : '#94a3b8';
  const pillarSide = cp.isActive ? '#ca8a04' : '#64748b';

  // Left & Right Pillars
  drawExtrudedBox3D(
    ctx,
    b,
    cp.x - rightX * halfSpan,
    0,
    cp.z - rightZ * halfSpan,
    0.85,
    7.2,
    0.85,
    cp.heading,
    '#fef9c3',
    pillarColor,
    pillarSide,
  );
  drawExtrudedBox3D(
    ctx,
    b,
    cp.x + rightX * halfSpan,
    0,
    cp.z + rightZ * halfSpan,
    0.85,
    7.2,
    0.85,
    cp.heading,
    '#fef9c3',
    pillarColor,
    pillarSide,
  );

  // Top Gantry Banner
  const bannerFront = cp.isGrandFinale ? '#dc2626' : cp.isActive ? '#0284c7' : '#334155';
  drawExtrudedBox3D(
    ctx,
    b,
    cp.x,
    6.1,
    cp.z,
    halfSpan * 2 + 1.2,
    1.55,
    0.9,
    cp.heading,
    '#f8fafc',
    bannerFront,
    '#0f172a',
  );

  // Pulsing ground target pad when active
  if (cp.isActive) {
    const pulse = 3.8 + Math.sin(nowSec * 5) * 0.45;
    const ringPts: Vec3[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ringPts.push({
        x: cp.x + Math.cos(a) * pulse,
        y: 0.09,
        z: cp.z + Math.sin(a) * pulse,
      });
    }
    const projRing = clipAndProjectPolygon(b, ringPts);
    fillProjectedPoly(ctx, projRing, 'rgba(250, 204, 21, 0.34)', '#facc15', 2);
  }

  const topPt = projectPoint(b, cp.x, 8.3, cp.z);
  if (topPt && topPt.zCam < 260) {
    ctx.save();
    ctx.font = 'italic 700 12px "Chakra Petch", sans-serif';
    const txt = cp.isActive ? `★ ${cp.label} ★` : cp.label;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = cp.isActive ? 'rgba(220, 38, 38, 0.92)' : 'rgba(15, 23, 42, 0.78)';
    drawSafeRoundRect(ctx, topPt.sx - tw * 0.5 - 7, topPt.sy - 10, tw + 14, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, topPt.sx, topPt.sy);
    ctx.restore();
  }
}

export function drawVehicleActor3D(
  ctx: CanvasRenderingContext2D,
  b: CameraBasis,
  v: FallbackVehicleActor,
) {
  if (v.hideMeshForCockpit) return;

  const sinH = Math.sin(v.heading);
  const cosH = Math.cos(v.heading);

  const toW = (lx: number, ly: number, lz: number): Vec3 => ({
    x: v.x + lx * cosH + lz * sinH,
    y: v.y + ly,
    z: v.z - lx * sinH + lz * cosH,
  });

  const style = v.spec.bodyStyle;
  const isBike = style === 'bicycle';
  const isQuadOrTrike =
    style === 'electric_quad_trike' || style === 'electric_tricycle' || style === 'tuk_tuk';
  const isTruck = style === 'heavy_truck';
  const isPickup = style === 'pickup_truck';

  const bodyW = isBike ? 0.52 : isQuadOrTrike ? 1.28 : isTruck ? 2.45 : 1.88;
  const bodyL = isBike ? 1.85 : isQuadOrTrike ? 2.55 : isTruck ? 6.8 : isPickup ? 4.8 : 4.35;
  const chassisH = isBike ? 0.45 : isTruck ? 1.15 : 0.62;
  const cabinH = isBike ? 0.0 : style === 'tuk_tuk' ? 0.95 : isTruck ? 1.55 : 0.56;

  // Ground Contact Shadow
  const shW = bodyW * 0.62;
  const shL = bodyL * 0.56;
  const shadowPoly = clipAndProjectPolygon(b, [
    toW(-shW, 0.02, -shL),
    toW(shW, 0.02, -shL),
    toW(shW, 0.02, shL),
    toW(-shW, 0.02, shL),
  ]);
  fillProjectedPoly(ctx, shadowPoly, 'rgba(15, 23, 42, 0.38)');

  // Wheels (4 corners or 2 for bike)
  const wheelY = 0.28;
  const wheelPositions: Array<[number, number]> = isBike
    ? [
        [0, -0.68],
        [0, 0.68],
      ]
    : style === 'electric_tricycle' || style === 'tuk_tuk'
      ? [
          [0, -bodyL * 0.36],
          [-bodyW * 0.48, bodyL * 0.34],
          [bodyW * 0.48, bodyL * 0.34],
        ]
      : [
          [-bodyW * 0.48, -bodyL * 0.33],
          [bodyW * 0.48, -bodyL * 0.33],
          [-bodyW * 0.48, bodyL * 0.33],
          [bodyW * 0.48, bodyL * 0.33],
        ];

  for (const [wxOff, wzOff] of wheelPositions) {
    const wc = toW(wxOff, wheelY, wzOff);
    drawExtrudedBox3D(
      ctx,
      b,
      wc.x,
      0.03,
      wc.z,
      isBike ? 0.14 : 0.32,
      0.52,
      0.58,
      v.heading + (wzOff < 0 ? v.steerNorm * 0.42 : 0),
      '#334155',
      '#0f172a',
      '#1e293b',
    );
  }

  const topPaint = shadeHex(v.paintHex, 1.12);
  const mainPaint = v.paintHex;
  const sidePaint = shadeHex(v.paintHex, 0.78);

  // Lower Body Hull
  drawExtrudedBox3D(
    ctx,
    b,
    v.x,
    0.26,
    v.z,
    bodyW,
    chassisH,
    bodyL,
    v.heading,
    topPaint,
    mainPaint,
    sidePaint,
    'rgba(15,23,42,0.35)',
  );

  // Cabin / Canopy / Cargo Box / Rider Avatar
  if (isTruck) {
    const cabPos = toW(0, 0.26 + chassisH, -bodyL * 0.3);
    drawExtrudedBox3D(
      ctx,
      b,
      cabPos.x,
      cabPos.y,
      cabPos.z,
      bodyW * 0.94,
      cabinH,
      bodyL * 0.32,
      v.heading,
      topPaint,
      '#1e293b',
      sidePaint,
    );
    const cargoPos = toW(0, 0.26 + chassisH, bodyL * 0.16);
    drawExtrudedBox3D(
      ctx,
      b,
      cargoPos.x,
      cargoPos.y,
      cargoPos.z,
      bodyW * 0.98,
      cabinH * 1.18,
      bodyL * 0.58,
      v.heading,
      '#f8fafc',
      '#e2e8f0',
      '#cbd5e1',
    );
  } else if (isBike || style === 'electric_quad_trike' || style === 'electric_tricycle') {
    // Open-air Rider Torso + Helmet/Head Avatar
    const riderPos = toW(0, 0.26 + chassisH, 0.08);
    drawExtrudedBox3D(
      ctx,
      b,
      riderPos.x,
      riderPos.y,
      riderPos.z,
      0.48,
      0.58,
      0.38,
      v.heading,
      '#0284c7',
      '#0369a1',
      '#075985',
    );
    const headPt = projectPoint(b, riderPos.x, riderPos.y + 0.72, riderPos.z);
    if (headPt) {
      const r = Math.max(2.5, Math.min(18, (0.22 * b.focal) / headPt.zCam));
      ctx.beginPath();
      ctx.arc(headPt.sx, headPt.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fde68a';
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    const cabOffsetZ = isPickup ? -bodyL * 0.12 : 0.08;
    const cabLen = isPickup ? bodyL * 0.42 : bodyL * 0.52;
    const cabPos = toW(0, 0.26 + chassisH, cabOffsetZ);
    drawExtrudedBox3D(
      ctx,
      b,
      cabPos.x,
      cabPos.y,
      cabPos.z,
      bodyW * 0.84,
      cabinH,
      cabLen,
      v.heading,
      topPaint,
      '#0f172a',
      '#1e293b',
    );

    // Rear GT Wing for race/sport cars
    if (
      style === 'gtr_race' ||
      style === 'supercar_wedge' ||
      style === 'sport_coupe' ||
      style === 'gt_boxer'
    ) {
      const wingPos = toW(0, 0.26 + chassisH + 0.26, bodyL * 0.44);
      drawExtrudedBox3D(
        ctx,
        b,
        wingPos.x,
        wingPos.y,
        wingPos.z,
        bodyW * 0.96,
        0.1,
        0.34,
        v.heading,
        '#dc2626',
        '#991b1b',
        '#0f172a',
      );
    }
  }

  // Taillights (Rear = +Z in local vehicle coords) & Headlights (Front = -Z)
  if (!isBike) {
    const brakeColor = v.braking ? '#ff1e1e' : '#dc2626';
    for (const side of [-1, 1]) {
      const tl = toW(side * bodyW * 0.34, 0.48, bodyL * 0.5 + 0.02);
      const tlProj = projectPoint(b, tl.x, tl.y, tl.z);
      if (tlProj && tlProj.zCam < 140) {
        const rw = Math.max(2, Math.min(14, (0.26 * b.focal) / tlProj.zCam));
        const rh = Math.max(1.5, rw * 0.48);
        ctx.fillStyle = brakeColor;
        ctx.fillRect(tlProj.sx - rw * 0.5, tlProj.sy - rh * 0.5, rw, rh);
      }

      const hl = toW(side * bodyW * 0.34, 0.48, -bodyL * 0.5 - 0.02);
      const hlProj = projectPoint(b, hl.x, hl.y, hl.z);
      if (hlProj && hlProj.zCam < 140) {
        const rw = Math.max(2, Math.min(12, (0.24 * b.focal) / hlProj.zCam));
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(hlProj.sx - rw * 0.5, hlProj.sy - rw * 0.25, rw, rw * 0.5);
      }
    }
  }

  // Overhead Pilot Alias & Values Motto Label
  if (v.alias) {
    const tagPt = projectPoint(b, v.x, v.y + (isTruck ? 3.3 : 2.15), v.z);
    if (tagPt && tagPt.zCam > 1.2 && tagPt.zCam < 150) {
      ctx.save();
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      const titleTxt = v.alias;
      const subTxt = v.valueMessage ? `★ ${v.valueMessage}` : '';
      const w1 = ctx.measureText(titleTxt).width;
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      const w2 = subTxt ? ctx.measureText(subTxt).width : 0;
      const boxW = Math.max(w1, w2) + 14;
      const boxH = subTxt ? 30 : 18;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      drawSafeRoundRect(ctx, tagPt.sx - boxW * 0.5, tagPt.sy - boxH, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(titleTxt, tagPt.sx, tagPt.sy - boxH + 3);

      if (subTxt) {
        ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText(subTxt, tagPt.sx, tagPt.sy - boxH + 16);
      }
      ctx.restore();
    }
  }
}

function drawGuidanceArrow3D(
  ctx: CanvasRenderingContext2D,
  b: CameraBasis,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  colorHex: string,
  nowSec: number,
) {
  const yaw = Math.atan2(-(toX - fromX), -(toZ - fromZ));
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const hoverY = 2.85 + Math.sin(nowSec * 4.2) * 0.16;

  const toArrowW = (lx: number, lz: number): Vec3 => ({
    x: fromX + lx * cosY + lz * sinY,
    y: hoverY,
    z: fromZ - lx * sinY + lz * cosY,
  });

  const arrowPts = [
    toArrowW(0, -1.55), // tip pointing forward (-Z)
    toArrowW(0.95, -0.15),
    toArrowW(0.38, -0.15),
    toArrowW(0.38, 1.15),
    toArrowW(-0.38, 1.15),
    toArrowW(-0.38, -0.15),
    toArrowW(-0.95, -0.15),
  ];

  const proj = clipAndProjectPolygon(b, arrowPts);
  fillProjectedPoly(ctx, proj, colorHex, '#0f172a', 1.8);
}

function drawCockpitOverlay(
  ctx: CanvasRenderingContext2D,
  vpX: number,
  vpY: number,
  vpW: number,
  vpH: number,
  driver: NonNullable<FallbackRenderFrameInput['cockpitDriver']>,
) {
  const cx = vpX + vpW * 0.5;
  const bottomY = vpY + vpH;

  // Hood silhouette
  ctx.beginPath();
  ctx.moveTo(vpX + vpW * 0.12, bottomY - vpH * 0.22);
  ctx.quadraticCurveTo(cx, bottomY - vpH * 0.29, vpX + vpW * 0.88, bottomY - vpH * 0.22);
  ctx.lineTo(vpX + vpW, bottomY);
  ctx.lineTo(vpX, bottomY);
  ctx.closePath();
  ctx.fillStyle = driver.paintHex;
  ctx.fill();

  // Dashboard cowl
  ctx.beginPath();
  ctx.moveTo(vpX, bottomY - vpH * 0.2);
  ctx.quadraticCurveTo(cx, bottomY - vpH * 0.26, vpX + vpW, bottomY - vpH * 0.2);
  ctx.lineTo(vpX + vpW, bottomY);
  ctx.lineTo(vpX, bottomY);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  // Rotating GT Steering Wheel
  const wheelCx = cx - vpW * 0.14;
  const wheelCy = bottomY - vpH * 0.06;
  const wheelR = Math.min(vpW, vpH) * 0.19;

  ctx.save();
  ctx.translate(wheelCx, wheelCy);
  ctx.rotate(-driver.steerNorm * 1.45);

  ctx.beginPath();
  ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(10, wheelR * 0.16);
  ctx.strokeStyle = '#1e293b';
  ctx.stroke();

  // Red top-center motorsport stripe ("esquina/marca roja GT")
  ctx.beginPath();
  ctx.arc(0, 0, wheelR, -Math.PI * 0.56, -Math.PI * 0.44);
  ctx.lineWidth = Math.max(10, wheelR * 0.17);
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();

  // Spokes
  ctx.fillStyle = '#475569';
  ctx.fillRect(-wheelR * 0.88, -wheelR * 0.08, wheelR * 1.76, wheelR * 0.16);
  ctx.fillRect(-wheelR * 0.1, 0, wheelR * 0.2, wheelR * 0.88);

  // Center hub
  ctx.beginPath();
  ctx.arc(0, 0, wheelR * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

export function renderFallback3DViewport(input: FallbackRenderFrameInput): void {
  const {
    ctx,
    vpX,
    vpY,
    vpW,
    vpH,
    camera,
    cameraMode,
    timeOfDay,
    realMapOverlayMode,
    nowSec,
    sceneData,
    vehicles,
    cockpitDriver,
    guideArrow,
  } = input;

  if (vpW <= 2 || vpH <= 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(vpX, vpY, vpW, vpH);
  ctx.clip();

  const b = buildCameraBasis(camera, vpX, vpY, vpW, vpH);

  // Compute Horizon Screen Y from camera forward pitch
  const pitchTan = b.fy / Math.max(0.12, Math.hypot(b.fx, b.fz));
  const horizonY = Math.max(
    vpY,
    Math.min(vpY + vpH, vpY + vpH * 0.5 + pitchTan * b.focal),
  );

  // 1. Natural Sky & Ground Base (or transparent for Satellite/Google Maps Overlay)
  if (realMapOverlayMode) {
    ctx.clearRect(vpX, vpY, vpW, vpH);
  } else {
    const skyGrad = ctx.createLinearGradient(vpX, vpY, vpX, Math.max(vpY + 20, horizonY));
    if (timeOfDay === 'NIGHT') {
      skyGrad.addColorStop(0, '#060d1f');
      skyGrad.addColorStop(0.65, '#0f1f3d');
      skyGrad.addColorStop(1, '#1e3a5f');
    } else if (timeOfDay === 'GOLDEN') {
      skyGrad.addColorStop(0, '#1d4ed8');
      skyGrad.addColorStop(0.55, '#f97316');
      skyGrad.addColorStop(1, '#fde047');
    } else {
      // Natural Gran Turismo 3 Daytime Sky ("color cielo natural")
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.52, '#38bdf8');
      skyGrad.addColorStop(1, '#dff2fe');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(vpX, vpY, vpW, Math.max(2, horizonY - vpY + 2));

    // Ground Terrain Gradient below horizon
    const groundGrad = ctx.createLinearGradient(
      vpX,
      Math.min(vpY + vpH - 2, horizonY),
      vpX,
      vpY + vpH,
    );
    const baseGrass =
      timeOfDay === 'NIGHT'
        ? '#12261a'
        : sceneData.map.groundTint || '#3f7d3a';
    groundGrad.addColorStop(0, shadeHex(baseGrass, 1.12));
    groundGrad.addColorStop(1, shadeHex(baseGrass, 0.82));
    ctx.fillStyle = groundGrad;
    ctx.fillRect(vpX, horizonY, vpW, Math.max(2, vpY + vpH - horizonY));

    // Sun / Moon + Drifting Natural Clouds + Flying Songbirds ("Pajaritos")
    const sunPt = projectPoint(
      b,
      camera.posX + 260,
      timeOfDay === 'GOLDEN' ? 95 : 230,
      camera.posZ - 380,
    );
    if (sunPt) {
      const sunR = timeOfDay === 'GOLDEN' ? 28 : 20;
      ctx.beginPath();
      ctx.arc(sunPt.sx, sunPt.sy, sunR, 0, Math.PI * 2);
      ctx.fillStyle = timeOfDay === 'NIGHT' ? '#f8fafc' : '#fef08a';
      ctx.fill();
    }

    // Soft clouds & flying birds in sky band
    if (horizonY > vpY + 24) {
      ctx.fillStyle =
        timeOfDay === 'NIGHT' ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.72)';
      for (let c = 0; c < 6; c++) {
        const cloudWorldAng = c * 1.05 + nowSec * 0.012;
        const clPt = projectPoint(
          b,
          camera.posX + Math.cos(cloudWorldAng) * 420,
          125 + (c % 3) * 24,
          camera.posZ + Math.sin(cloudWorldAng) * 420,
        );
        if (clPt && clPt.sy < horizonY - 8) {
          ctx.beginPath();
          ctx.ellipse(clPt.sx, clPt.sy, 46, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Animated flying birds ("Pajaritos")
      ctx.strokeStyle = timeOfDay === 'NIGHT' ? '#cbd5e1' : '#1e293b';
      ctx.lineWidth = 1.6;
      for (let bi = 0; bi < 5; bi++) {
        const bAng = nowSec * 0.18 + bi * 0.42;
        const birdPt = projectPoint(
          b,
          camera.posX + Math.cos(bAng) * 140,
          44 + (bi % 3) * 7,
          camera.posZ + Math.sin(bAng) * 140,
        );
        if (birdPt && birdPt.sy < horizonY - 4) {
          const flap = Math.sin(nowSec * 9 + bi * 1.7) * 4.5;
          ctx.beginPath();
          ctx.moveTo(birdPt.sx - 7, birdPt.sy - flap);
          ctx.quadraticCurveTo(birdPt.sx - 3, birdPt.sy - 3, birdPt.sx, birdPt.sy);
          ctx.quadraticCurveTo(birdPt.sx + 3, birdPt.sy - 3, birdPt.sx + 7, birdPt.sy - flap);
          ctx.stroke();
        }
      }
    }

    // 2. 3D Mountains & Volcanoes along Horizon
    for (const peak of sceneData.map.peaks) {
      const apex = { x: peak.x, y: peak.height, z: peak.z };
      const r = peak.radius;
      const basePts: Vec3[] = [
        { x: peak.x - r, y: 0, z: peak.z - r * 0.5 },
        { x: peak.x + r, y: 0, z: peak.z - r * 0.5 },
        { x: peak.x + r * 0.5, y: 0, z: peak.z + r },
        { x: peak.x - r * 0.5, y: 0, z: peak.z + r },
      ];
      const mtnColor = timeOfDay === 'NIGHT' ? '#1e293b' : '#3b5978';
      for (let s = 0; s < basePts.length; s++) {
        const tri = clipAndProjectPolygon(b, [
          basePts[s],
          basePts[(s + 1) % basePts.length],
          apex,
        ]);
        fillProjectedPoly(ctx, tri, s % 2 === 0 ? mtnColor : shadeHex('#3b5978', 0.86));
      }
      if (peak.hasPlume) {
        const plumePt = projectPoint(b, peak.x, peak.height + 14, peak.z);
        if (plumePt) {
          ctx.beginPath();
          ctx.arc(plumePt.sx, plumePt.sy, 11, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
          ctx.fill();
        }
      }
    }

    // Shimmering Coastal / Lake Water
    if (sceneData.map.hasCoastalWater) {
      const side = sceneData.map.waterSide || 'south';
      const wx = side === 'east' ? 380 : side === 'west' ? -380 : 0;
      const wz = side === 'south' ? 380 : side === 'north' ? -380 : 0;
      const waterPoly = clipAndProjectPolygon(b, [
        { x: wx - 320, y: 0.02, z: wz - 180 },
        { x: wx + 320, y: 0.02, z: wz - 180 },
        { x: wx + 320, y: 0.02, z: wz + 180 },
        { x: wx - 320, y: 0.02, z: wz + 180 },
      ]);
      fillProjectedPoly(
        ctx,
        waterPoly,
        timeOfDay === 'NIGHT' ? '#0c4a6e' : '#0284c7',
      );
    }
  }

  // 3. 3D Projected Road Network (Subdivided into 18m Perspective Quads with Curbs & Center Stripes)
  const roadQuads: Array<{
    quad: Vec3[];
    stripe?: Vec3[];
    curbL?: Vec3[];
    curbR?: Vec3[];
    color: string;
    curbColor?: string;
    depth: number;
  }> = [];

  for (const seg of sceneData.allRoads) {
    const baseRoadColor = realMapOverlayMode
      ? 'rgba(30, 41, 59, 0.56)'
      : seg.surface === 'cobblestone'
        ? '#57534e'
        : seg.surface === 'campus_paver'
          ? '#64748b'
          : '#27303f';

    const halfW = seg.width * 0.5;
    for (let i = 0; i < seg.points.length - 1; i++) {
      const a: RoadNode2D = seg.points[i];
      const bPt: RoadNode2D = seg.points[i + 1];
      const dx = bPt.x - a.x;
      const dz = bPt.z - a.z;
      const totalLen = Math.hypot(dx, dz);
      if (totalLen < 0.8) continue;

      // Quick distance cull from camera
      const midSegX = (a.x + bPt.x) * 0.5;
      const midSegZ = (a.z + bPt.z) * 0.5;
      if (Math.hypot(midSegX - camera.posX, midSegZ - camera.posZ) > totalLen * 0.5 + 310) {
        continue;
      }

      const ux = dx / totalLen;
      const uz = dz / totalLen;
      const nx = -uz;
      const nz = ux;

      const chunkLen = 18;
      const chunks = Math.max(1, Math.ceil(totalLen / chunkLen));
      for (let c = 0; c < chunks; c++) {
        const d0 = (c / chunks) * totalLen;
        const d1 = ((c + 1) / chunks) * totalLen;
        const x0 = a.x + ux * d0;
        const z0 = a.z + uz * d0;
        const x1 = a.x + ux * d1;
        const z1 = a.z + uz * d1;
        const mx = (x0 + x1) * 0.5;
        const mz = (z0 + z1) * 0.5;
        const distCam = Math.hypot(mx - camera.posX, mz - camera.posZ);
        if (distCam > 290) continue;

        const quad: Vec3[] = [
          { x: x0 - nx * halfW, y: 0.04, z: z0 - nz * halfW },
          { x: x0 + nx * halfW, y: 0.04, z: z0 + nz * halfW },
          { x: x1 + nx * halfW, y: 0.04, z: z1 + nz * halfW },
          { x: x1 - nx * halfW, y: 0.04, z: z1 - nz * halfW },
        ];

        // Dashed center yellow/white line on every chunk middle
        const sm0 = d0 + (d1 - d0) * 0.22;
        const sm1 = d0 + (d1 - d0) * 0.72;
        const sx0 = a.x + ux * sm0;
        const sz0 = a.z + uz * sm0;
        const sx1 = a.x + ux * sm1;
        const sz1 = a.z + uz * sm1;
        const sw = 0.16;
        const stripe: Vec3[] = [
          { x: sx0 - nx * sw, y: 0.055, z: sz0 - nz * sw },
          { x: sx0 + nx * sw, y: 0.055, z: sz0 + nz * sw },
          { x: sx1 + nx * sw, y: 0.055, z: sz1 + nz * sw },
          { x: sx1 - nx * sw, y: 0.055, z: sz1 - nz * sw },
        ];

        // Red & White FIA Motorsport Kerbs (or stone sidewalks)
        const kw = 0.65;
        const curbL: Vec3[] = [
          { x: x0 - nx * (halfW + kw), y: 0.045, z: z0 - nz * (halfW + kw) },
          { x: x0 - nx * halfW, y: 0.045, z: z0 - nz * halfW },
          { x: x1 - nx * halfW, y: 0.045, z: z1 - nz * halfW },
          { x: x1 - nx * (halfW + kw), y: 0.045, z: z1 - nz * (halfW + kw) },
        ];
        const curbR: Vec3[] = [
          { x: x0 + nx * halfW, y: 0.045, z: z0 + nz * halfW },
          { x: x0 + nx * (halfW + kw), y: 0.045, z: z0 + nz * (halfW + kw) },
          { x: x1 + nx * (halfW + kw), y: 0.045, z: z1 + nz * (halfW + kw) },
          { x: x1 + nx * halfW, y: 0.045, z: z1 + nz * halfW },
        ];
        const curbColor = sceneData.map.isClosedCircuit
          ? c % 2 === 0
            ? '#dc2626'
            : '#f8fafc'
          : '#94a3b8';

        roadQuads.push({
          quad,
          stripe,
          curbL: realMapOverlayMode ? undefined : curbL,
          curbR: realMapOverlayMode ? undefined : curbR,
          color: baseRoadColor,
          curbColor,
          depth: distCam,
        });
      }
    }
  }

  roadQuads.sort((a, c) => c.depth - a.depth);
  for (const rq of roadQuads) {
    if (rq.curbL && rq.curbColor) {
      fillProjectedPoly(ctx, clipAndProjectPolygon(b, rq.curbL), rq.curbColor);
    }
    if (rq.curbR && rq.curbColor) {
      fillProjectedPoly(ctx, clipAndProjectPolygon(b, rq.curbR), rq.curbColor);
    }
    fillProjectedPoly(ctx, clipAndProjectPolygon(b, rq.quad), rq.color);
    if (rq.stripe) {
      fillProjectedPoly(
        ctx,
        clipAndProjectPolygon(b, rq.stripe),
        sceneData.map.isClosedCircuit ? '#f8fafc' : '#facc15',
      );
    }
  }

  // 4. Depth-Sorted 3D Objects (Houses, Trees, Landmarks, Checkpoints, Pedestrians, Vehicles)
  type DrawItem = { depth: number; draw: () => void };
  const drawQueue: DrawItem[] = [];

  if (!realMapOverlayMode) {
    for (const h of sceneData.houses) {
      const dist = Math.hypot(h.x - camera.posX, h.z - camera.posZ);
      if (dist > 250) continue;
      drawQueue.push({
        depth: dist,
        draw: () => {
          drawExtrudedBox3D(
            ctx,
            b,
            h.x,
            0,
            h.z,
            h.w,
            h.h,
            h.d,
            h.rotY,
            h.roofColor,
            h.wallColor,
            shadeHex(h.wallColor, 0.82),
            'rgba(15,23,42,0.22)',
          );
        },
      });
    }

    for (const tr of sceneData.trees) {
      const dist = Math.hypot(tr.x - camera.posX, tr.z - camera.posZ);
      if (dist > 240) continue;
      drawQueue.push({
        depth: dist,
        draw: () => {
          const trunkTop = projectPoint(b, tr.x, 2.5 * tr.scale, tr.z);
          const trunkBase = projectPoint(b, tr.x, 0, tr.z);
          if (!trunkTop || !trunkBase) return;
          const trunkW = Math.max(1.5, (0.45 * tr.scale * b.focal) / trunkBase.zCam);
          ctx.strokeStyle = '#5c3a21';
          ctx.lineWidth = trunkW;
          ctx.beginPath();
          ctx.moveTo(trunkBase.sx, trunkBase.sy);
          ctx.lineTo(trunkTop.sx, trunkTop.sy);
          ctx.stroke();

          const crownPt = projectPoint(b, tr.x, 4.3 * tr.scale, tr.z);
          if (crownPt) {
            const rad = Math.max(3, (2.25 * tr.scale * b.focal) / crownPt.zCam);
            ctx.fillStyle = tr.crownColor;
            if (tr.isCone) {
              ctx.beginPath();
              ctx.moveTo(crownPt.sx, crownPt.sy - rad * 1.25);
              ctx.lineTo(crownPt.sx - rad * 0.95, trunkTop.sy + rad * 0.2);
              ctx.lineTo(crownPt.sx + rad * 0.95, trunkTop.sy + rad * 0.2);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(crownPt.sx, crownPt.sy, rad, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        },
      });
    }
  }

  for (const lm of sceneData.map.landmarks) {
    const dist = Math.hypot(lm.x - camera.posX, lm.z - camera.posZ);
    if (dist > 340) continue;
    drawQueue.push({
      depth: dist,
      draw: () => drawLandmark3D(ctx, b, lm),
    });
  }

  for (const cp of sceneData.checkpoints) {
    const dist = Math.hypot(cp.x - camera.posX, cp.z - camera.posZ);
    if (dist > 320) continue;
    drawQueue.push({
      depth: dist,
      draw: () => drawCheckpointStage3D(ctx, b, cp, nowSec),
    });
  }

  for (const ped of sceneData.pedestrians) {
    const dist = Math.hypot(ped.x - camera.posX, ped.z - camera.posZ);
    if (dist > 140) continue;
    drawQueue.push({
      depth: dist,
      draw: () => {
        const feet = projectPoint(b, ped.x, 0.05, ped.z);
        const head = projectPoint(b, ped.x, 1.68, ped.z);
        if (!feet || !head) return;
        const pw = Math.max(2, (0.42 * b.focal) / feet.zCam);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(1.5, pw * 0.4);
        const stride = Math.sin(ped.walkPhase) * pw * 0.45;
        ctx.beginPath();
        ctx.moveTo(feet.sx - stride, feet.sy);
        ctx.lineTo(head.sx, (feet.sy + head.sy) * 0.52);
        ctx.lineTo(feet.sx + stride, feet.sy);
        ctx.stroke();

        ctx.fillStyle = ped.shirtColor;
        ctx.fillRect(
          head.sx - pw * 0.5,
          head.sy + pw * 0.45,
          pw,
          Math.max(3, (feet.sy - head.sy) * 0.42),
        );

        ctx.beginPath();
        ctx.arc(head.sx, head.sy + pw * 0.2, Math.max(2, pw * 0.36), 0, Math.PI * 2);
        ctx.fillStyle = '#fde68a';
        ctx.fill();
      },
    });
  }

  for (const v of vehicles) {
    if (v.hideMeshForCockpit) continue;
    const dist = Math.hypot(v.x - camera.posX, v.z - camera.posZ);
    if (dist > 280) continue;
    drawQueue.push({
      depth: dist,
      draw: () => drawVehicleActor3D(ctx, b, v),
    });
  }

  drawQueue.sort((a, c) => c.depth - a.depth);
  for (const item of drawQueue) {
    item.draw();
  }

  // 5. Floating 3D Overhead Guidance Arrow
  if (guideArrow && guideArrow.visible) {
    drawGuidanceArrow3D(
      ctx,
      b,
      guideArrow.fromX,
      guideArrow.fromZ,
      guideArrow.toX,
      guideArrow.toZ,
      guideArrow.colorHex,
      nowSec,
    );
  }

  // 6. Cockpit 1st-Person Dashboard & Rotating GT Wheel
  if (cameraMode === 'COCKPIT' && cockpitDriver) {
    drawCockpitOverlay(ctx, vpX, vpY, vpW, vpH, cockpitDriver);
  }

  ctx.restore();
}

export function renderFallbackShowroomTurntable(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  carId: CarModelId,
  paintHex: string,
  yaw: number,
): void {
  const spec = getCarById(carId);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#bae6fd');
  bg.addColorStop(0.58, '#e0f2fe');
  bg.addColorStop(1, '#f8fafc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Diagonal GT3-inspired crimson corner accent ("esquina roja")
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w - 66, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, 66);
  ctx.closePath();
  ctx.fillStyle = '#dc2626';
  ctx.fill();
  ctx.restore();

  const camDist =
    spec.bodyStyle === 'heavy_truck'
      ? 9.2
      : spec.bodyStyle === 'bicycle'
        ? 3.9
        : spec.bodyStyle === 'tuk_tuk' ||
            spec.bodyStyle === 'electric_quad_trike' ||
            spec.bodyStyle === 'electric_tricycle'
          ? 4.7
          : 6.1;
  const camY = spec.bodyStyle === 'heavy_truck' ? 2.9 : 1.95;

  const b = buildCameraBasis(
    {
      posX: 0,
      posY: camY,
      posZ: camDist,
      lookX: 0,
      lookY: 0.72,
      lookZ: 0,
      fovDeg: 44,
    },
    0,
    0,
    w,
    h,
  );

  // Turntable circular plinth
  const plinthPts: Vec3[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + yaw;
    plinthPts.push({ x: Math.cos(a) * 4.2, y: 0, z: Math.sin(a) * 4.2 });
  }
  fillProjectedPoly(
    ctx,
    clipAndProjectPolygon(b, plinthPts),
    '#ffffff',
    '#0284c7',
    2.2,
  );

  drawVehicleActor3D(ctx, b, {
    x: 0,
    y: 0.02,
    z: 0,
    heading: yaw,
    steerNorm: 0.18,
    speedMs: 0,
    spec,
    paintHex,
  });
}
