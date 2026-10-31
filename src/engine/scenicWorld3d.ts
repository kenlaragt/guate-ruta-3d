import * as THREE from 'three';
import { RoadSegmentSpec, TimeOfDay, WorldMapSpec } from '../types/game';
import { ProceduralTexturePack } from './proceduralTextures';

export interface ScenicWorldHandle3D {
  group: THREE.Group;
  setTimeOfDay: (tod: TimeOfDay) => void;
  update: (timeSec: number, dt: number) => void;
  dispose: () => void;
}

export interface GuidanceArrowHandle3D {
  group: THREE.Group;
  update: (
    carX: number,
    carZ: number,
    targetX: number,
    targetZ: number,
    timeSec: number,
    visible: boolean,
  ) => void;
  dispose: () => void;
}

interface ColliderBox {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

// Subtle cosmopolitan urban/route boards calling for interculturality & breaking racism naturally (zero preachy labels)
const SUBTLE_INTERCULTURAL_BOARDS: Array<{
  badge: string;
  headline: string;
  subline: string;
  bgA: string;
  bgB: string;
  accent: string;
}> = [
  {
    badge: 'GRAN TOUR HORIZONTE',
    headline: 'Todas las Raíces · Un Mismo Camino',
    subline: 'Cada cultura acelera mejor cuando corremos juntos',
    bgA: '#0f172a',
    bgB: '#0369a1',
    accent: '#38bdf8',
  },
  {
    badge: 'CAFÉ & MÚSICA DEL MUNDO',
    headline: 'Distintos Tonos, Una Sola Melodía',
    subline: 'Aquí cada voz y cada origen tienen su lugar en primera fila',
    bgA: '#1e1b4b',
    bgB: '#4338ca',
    accent: '#fbbf24',
  },
  {
    badge: 'RUTA ABIERTA INTERNACIONAL',
    headline: 'El Talento No Tiene Fronteras Ni Color',
    subline: 'Respeto en cada curva · Pueblos hermanos al volante',
    bgA: '#064e3b',
    bgB: '#0f766e',
    accent: '#34d399',
  },
  {
    badge: 'ENCUENTRO DE CIUDADES',
    headline: 'Miradas Diversas · Mismo Cielo Soleado',
    subline: 'Convivir sin prejuicios hace grande cada avenida',
    bgA: '#3b0764',
    bgB: '#be185d',
    accent: '#fde047',
  },
];

// Small friendly urban sidewalk signs inviting respect & support for people with disabilities and cognitive spectrums
const SMALL_INCLUSION_SIGNS: Array<{
  top: string;
  main: string;
  sub: string;
  borderHex: string;
}> = [
  {
    top: 'PASO AMABLE · CIUDAD PARA TODOS',
    main: 'Apoyemos la movilidad y rampas libres',
    sub: 'Respeto y empatía con personas con discapacidad',
    borderHex: '#0284c7',
  },
  {
    top: 'CONVIVENCIA EN LA VÍA',
    main: 'Cada mente percibe y brilla a su ritmo',
    sub: 'Comprensión y apoyo a todo espectro cognitivo',
    borderHex: '#0d9488',
  },
  {
    top: 'ZONA DE RESPETO MUTUO',
    main: 'Un gesto paciente transforma el día',
    sub: 'Inclusión plena física, sensorial y neurodiversa',
    borderHex: '#f59e0b',
  },
  {
    top: 'RUTA ACCESIBLE Y HUMANA',
    main: 'Escuchar, acompañar y abrir camino',
    sub: 'Nadie queda atrás cuando avanzamos con respeto',
    borderHex: '#6366f1',
  },
];

// 19th & 20th Century Traditional Ludic Games of Spain & Guatemala (displayed across ALL tracks!)
const HISTORIC_LUDIC_GAMES_SIGNS: Array<{
  era: string;
  gameTitle: string;
  detail: string;
  colorHex: string;
}> = [
  {
    era: 'MEMORIA LÚDICA · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'El Trompo de Madera y Cuerda',
    detail: 'Giro maestro sobre la palma en plazas y patios soleados',
    colorHex: '#d97706',
  },
  {
    era: 'JUEGOS DE ANTAÑO · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'El Capirucho / El Boliche',
    detail: 'Pulso, paciencia y alegría encestando madera torneada',
    colorHex: '#0284c7',
  },
  {
    era: 'TRADICIÓN DE BARRIO · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'La Rayuela / El Avión',
    detail: 'Tiza blanca de la Tierra al Cielo saltando en un pie',
    colorHex: '#16a34a',
  },
  {
    era: 'RECUERDO LÚDICO · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'Las Canicas / Los Cincos',
    detail: 'Esferas de vidrio irisado rodando entre amigos de infancia',
    colorHex: '#7c3aed',
  },
  {
    era: 'VIENTO Y PAPEL · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'El Barrilete / La Cometa',
    detail: 'Caña y papel de colores remontando el cielo despejado',
    colorHex: '#e11d48',
  },
  {
    era: 'PLAZA Y AMISTAD · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'La Gallinita Ciega y El Escondite',
    detail: 'Risas compartidas al aire libre en tardes sin pantallas',
    colorHex: '#0891b2',
  },
  {
    era: 'JUEGOS CLÁSICOS · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'Salto de Cuerda, La Comba y El Aro',
    detail: 'Canto rítmico y destreza rodando el aro por las aceras',
    colorHex: '#ea580c',
  },
  {
    era: 'HERENCIA POPULAR · ESPAÑA Y GUATEMALA (S. XIX–XX)',
    gameTitle: 'Las Tabas, El Ronrón y La Lotería',
    detail: 'Ingenio artesanal que unió generaciones en el siglo XIX y XX',
    colorHex: '#15803d',
  },
];

function distToSegSq(
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

function buildSkyPanoramaTexture(tod: TimeOfDay): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (tod === 'NIGHT') {
    grad.addColorStop(0, '#04091a');
    grad.addColorStop(0.5, '#0f1f3d');
    grad.addColorStop(0.76, '#1e3a5f');
    grad.addColorStop(1, '#0f172a');
  } else if (tod === 'GOLDEN') {
    grad.addColorStop(0, '#1d4ed8');
    grad.addColorStop(0.38, '#60a5fa');
    grad.addColorStop(0.66, '#fb923c');
    grad.addColorStop(0.84, '#fde047');
    grad.addColorStop(1, '#fed7aa');
  } else {
    // Cover-art vivid daytime azure sky!
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.34, '#38bdf8');
    grad.addColorStop(0.68, '#bae6fd');
    grad.addColorStop(0.86, '#e0f2fe');
    grad.addColorStop(1, '#dcfce7');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  if (tod === 'NIGHT') {
    // Twinkling stars
    for (let s = 0; s < 260; s++) {
      const sx = (s * 139) % 1024;
      const sy = (s * 71) % 310;
      ctx.fillStyle = s % 3 === 0 ? 'rgba(254,240,138,0.9)' : 'rgba(255,255,255,0.75)';
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else {
    // Warm sunlit halo & painted cover-art clouds along upper horizon
    const sunGrad = ctx.createRadialGradient(240, 148, 8, 240, 148, 120);
    sunGrad.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
    sunGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.45)');
    sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(100, 20, 280, 260);

    // Fluffy sunlit cumulus cloud banks
    for (let cl = 0; cl < 18; cl++) {
      const cx = (cl * 64 + 28) % 1024;
      const cy = 155 + (cl % 4) * 34;
      ctx.fillStyle =
        tod === 'GOLDEN' ? 'rgba(255, 237, 213, 0.72)' : 'rgba(255, 255, 255, 0.82)';
      for (let p = -2; p <= 2; p++) {
        ctx.beginPath();
        ctx.ellipse(
          cx + p * 22,
          cy + Math.abs(p) * 5,
          28 - Math.abs(p) * 4,
          16 - Math.abs(p) * 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // Painted distant mountain range silhouette around horizon band (y ~ 335..430) like the 3D cover art!
  ctx.fillStyle =
    tod === 'NIGHT'
      ? 'rgba(15, 23, 42, 0.85)'
      : tod === 'GOLDEN'
        ? 'rgba(67, 56, 202, 0.35)'
        : 'rgba(30, 104, 148, 0.36)';
  ctx.beginPath();
  ctx.moveTo(0, 440);
  for (let x = 0; x <= 1024; x += 16) {
    const h =
      362 -
      Math.abs(Math.sin((x / 1024) * Math.PI * 6)) * 46 -
      Math.cos((x / 1024) * Math.PI * 14) * 14;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // Closer lush green foothill silhouette
  ctx.fillStyle =
    tod === 'NIGHT'
      ? 'rgba(6, 46, 34, 0.9)'
      : tod === 'GOLDEN'
        ? 'rgba(21, 94, 63, 0.55)'
        : 'rgba(22, 128, 61, 0.52)';
  ctx.beginPath();
  ctx.moveTo(0, 450);
  for (let x = 0; x <= 1024; x += 16) {
    const h = 392 - Math.abs(Math.sin((x / 1024) * Math.PI * 9 + 0.8)) * 26;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(1024, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createInterculturalBoardTexture(idx: number): THREE.CanvasTexture {
  const item = SUBTLE_INTERCULTURAL_BOARDS[idx % SUBTLE_INTERCULTURAL_BOARDS.length];
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 640, 256);
  grad.addColorStop(0, item.bgA);
  grad.addColorStop(1, item.bgB);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(8, 8, 624, 240, 24);
  ctx.fill();

  ctx.strokeStyle = item.accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Subtle multicolor harmony dots in top-right corner
  const harmonyDots = ['#f59e0b', '#38bdf8', '#34d399', '#f472b6', '#fde047'];
  harmonyDots.forEach((hex, dIdx) => {
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(520 + dIdx * 20, 44, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = item.accent;
  ctx.font = 'bold 20px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(item.badge, 36, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Outfit, sans-serif';
  ctx.fillText(item.headline, 36, 122);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 22px Plus Jakarta Sans, sans-serif';
  ctx.fillText(item.subline, 36, 178);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSmallInclusionSignTexture(idx: number): THREE.CanvasTexture {
  const item = SMALL_INCLUSION_SIGNS[idx % SMALL_INCLUSION_SIGNS.length];
  const c = document.createElement('canvas');
  c.width = 448;
  c.height = 224;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(8, 8, 432, 208, 20);
  ctx.fill();

  ctx.strokeStyle = item.borderHex;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.fillStyle = item.borderHex;
  ctx.fillRect(16, 16, 416, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.top, 224, 43);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 25px Outfit, sans-serif';
  ctx.fillText(item.main, 224, 114);

  ctx.fillStyle = '#334155';
  ctx.font = '600 19px Plus Jakarta Sans, sans-serif';
  ctx.fillText(item.sub, 224, 164);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHistoricLudicGameSignTexture(idx: number): THREE.CanvasTexture {
  const item = HISTORIC_LUDIC_GAMES_SIGNS[idx % HISTORIC_LUDIC_GAMES_SIGNS.length];
  const c = document.createElement('canvas');
  c.width = 576;
  c.height = 240;
  const ctx = c.getContext('2d')!;

  // Warm vintage enamel / parchment heritage plaque aesthetic
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.roundRect(8, 8, 560, 224, 22);
  ctx.fill();

  ctx.strokeStyle = item.colorHex;
  ctx.lineWidth = 8;
  ctx.stroke();

  // Inner heritage hairline frame
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 536, 200);

  ctx.fillStyle = item.colorHex;
  ctx.font = 'bold 16px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.era, 288, 54);

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 34px Outfit, sans-serif';
  ctx.fillText(item.gameTitle, 288, 118);

  ctx.fillStyle = '#44403c';
  ctx.font = '600 20px Plus Jakarta Sans, sans-serif';
  ctx.fillText(item.detail, 288, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a PBR animated water material with vertex waves (`onBeforeCompile`) and UV flow.
 */
function createAnimatedWaterMaterial(
  rippleTex: THREE.CanvasTexture,
  tintHex: number,
  waveAmp: number,
  timeUniform: { value: number },
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: rippleTex,
    color: new THREE.Color(tintHex),
    roughness: 0.14,
    metalness: 0.38,
    transparent: true,
    opacity: 0.92,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = timeUniform;
    shader.uniforms.uWaveAmp = { value: waveAmp };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWaterTime;
         uniform float uWaveAmp;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float w1 = sin(transformed.x * 0.085 + uWaterTime * 2.2) * cos(transformed.y * 0.075 + uWaterTime * 1.7);
         float w2 = sin((transformed.x + transformed.y) * 0.14 - uWaterTime * 2.8) * 0.5;
         transformed.z += (w1 + w2) * uWaveAmp;`,
      );
  };
  mat.customProgramCacheKey = () => `scenic_water_${waveAmp.toFixed(2)}`;
  return mat;
}

export function createScenicWorldEnvironment3D(
  map: WorldMapSpec,
  allRoads: RoadSegmentSpec[],
  colliders: ColliderBox[],
  texPack: ProceduralTexturePack,
  isSoftwareGl: boolean,
): ScenicWorldHandle3D {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const isClear = (cx: number, cz: number, minPad: number): boolean => {
    for (const seg of allRoads) {
      const req = seg.width * 0.5 + minPad;
      const reqSq = req * req;
      for (let i = 0; i < seg.points.length - 1; i++) {
        if (distToSegSq(cx, cz, seg.points[i].x, seg.points[i].z, seg.points[i + 1].x, seg.points[i + 1].z) < reqSq) {
          return false;
        }
      }
    }
    for (const lm of map.landmarks) {
      if ((cx - lm.x) * (cx - lm.x) + (cz - lm.z) * (cz - lm.z) < 20 * 20) return false;
    }
    for (const col of colliders) {
      if (Math.abs(cx - col.x) < col.halfW + minPad * 0.5 && Math.abs(cz - col.z) < col.halfD + minPad * 0.5) {
        return false;
      }
    }
    return true;
  };

  // =========================================================================
  // 1. COVER-ART 3D SKY & PAINTED MOUNTAIN HORIZON DOME
  // =========================================================================
  const skyDomeGeo = new THREE.SphereGeometry(1180, 36, 24);
  let skyTex = buildSkyPanoramaTexture('DAY');
  const skyDomeMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  skyDome.position.y = -28;
  group.add(skyDome);
  disposables.push(skyDomeGeo, skyDomeMat);

  const setTimeOfDay = (tod: TimeOfDay) => {
    const nextTex = buildSkyPanoramaTexture(tod);
    skyDomeMat.map = nextTex;
    skyDomeMat.needsUpdate = true;
    skyTex.dispose();
    skyTex = nextTex;
  };

  // =========================================================================
  // 2. LUSH SUNLIT MEADOW GROUND PLANE (LIKE THE 3D COVER ART)
  // =========================================================================
  const groundGeo = new THREE.PlaneGeometry(2600, 2600);
  groundGeo.rotateX(-Math.PI / 2);
  const groundTint = new THREE.Color(map.groundTint).lerp(new THREE.Color('#74b859'), 0.48);
  const groundMat = new THREE.MeshStandardMaterial({
    map: texPack.grassMeadow,
    color: groundTint,
    roughness: 0.9,
    metalness: 0.02,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.02;
  groundMesh.receiveShadow = !isSoftwareGl;
  group.add(groundMesh);
  disposables.push(groundGeo, groundMat);

  // =========================================================================
  // 3. REALISTIC LAYERED MOUNTAINS & VOLCANOES + DRIFTING STEAM PLUMES
  // =========================================================================
  const plumePuffs: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; phase: number }> = [];
  const foothillMat = new THREE.MeshStandardMaterial({ color: 0x1e6b38, roughness: 0.88 });
  const mountainSlopeMat = new THREE.MeshStandardMaterial({ color: 0x2d4a43, roughness: 0.86 });
  const volcanoCapMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 });
  const snowRidgeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55 });
  const plumeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.95,
    transparent: true,
    opacity: 0.62,
  });
  disposables.push(foothillMat, mountainSlopeMat, volcanoCapMat, snowRidgeMat, plumeMat);

  // Background cordillera ring so EVERY horizon angle has lush 3D mountains
  const cordilleraGeo = new THREE.ConeGeometry(165, 118, 9);
  disposables.push(cordilleraGeo);
  for (let c = 0; c < 14; c++) {
    const ang = (c / 14) * Math.PI * 2 + 0.18;
    const dist = 760 + (c % 3) * 75;
    const mx = Math.cos(ang) * dist;
    const mz = Math.sin(ang) * dist;
    // Leave open sea corridor if coastal water is on that side
    if (map.hasCoastalWater) {
      if (map.waterSide === 'east' && mx > 380) continue;
      if (map.waterSide === 'west' && mx < -380) continue;
      if (map.waterSide === 'north' && mz < -380) continue;
      if ((!map.waterSide || map.waterSide === 'south') && mz > 380) continue;
    }
    const hill = new THREE.Mesh(cordilleraGeo, c % 2 === 0 ? foothillMat : mountainSlopeMat);
    const hScale = 0.85 + (c % 4) * 0.24;
    hill.scale.set(1.25, hScale, 1.15);
    hill.position.set(mx, (118 * hScale) / 2 - 8, mz);
    hill.rotation.y = c * 0.7;
    group.add(hill);
  }

  // Named Monumental Peaks & Volcanoes for the Track
  for (let pIdx = 0; pIdx < map.peaks.length; pIdx++) {
    const peak = map.peaks[pIdx];
    const peakGroup = new THREE.Group();
    peakGroup.position.set(peak.x, 0, peak.z);

    // Lush emerald forested base skirt
    const baseGeo = new THREE.ConeGeometry(peak.radius * 1.24, peak.height * 0.52, 16);
    const baseMesh = new THREE.Mesh(baseGeo, foothillMat);
    baseMesh.position.y = peak.height * 0.26 - 4;

    // Main volcanic / mountain body
    const mainGeo = new THREE.ConeGeometry(peak.radius * 0.88, peak.height, 18);
    const mainMesh = new THREE.Mesh(mainGeo, mountainSlopeMat);
    mainMesh.position.y = peak.height * 0.5 - 3;

    // Upper summit crown / crater cone
    const crownH = peak.height * 0.28;
    const crownGeo = new THREE.CylinderGeometry(
      peak.hasPlume ? peak.radius * 0.12 : peak.radius * 0.04,
      peak.radius * 0.3,
      crownH,
      16,
    );
    const crownMesh = new THREE.Mesh(
      crownGeo,
      peak.height >= 200 && !peak.hasPlume ? snowRidgeMat : volcanoCapMat,
    );
    crownMesh.position.y = peak.height - crownH * 0.45 - 2;

    peakGroup.add(baseMesh, mainMesh, crownMesh);
    disposables.push(baseGeo, mainGeo, crownGeo);

    if (peak.hasPlume) {
      for (let p = 0; p < 4; p++) {
        const puffGeo = new THREE.SphereGeometry(15 + p * 8, 12, 10);
        const puff = new THREE.Mesh(puffGeo, plumeMat);
        const bx = peak.x - p * 12;
        const by = peak.height + 10 + p * 20;
        puff.position.set(bx, by, peak.z);
        group.add(puff);
        plumePuffs.push({ mesh: puff, baseX: bx, baseY: by, phase: pIdx * 1.7 + p * 1.1 });
        disposables.push(puffGeo);
      }
    }

    group.add(peakGroup);
  }

  // =========================================================================
  // 4. ANIMATED WATER SYSTEM: SEAS, LAKES, LAGOONS & FLOWING RIVERS
  // =========================================================================
  const waterTimeUniform = { value: 0 };
  const riverRippleTex = texPack.waterRipple.clone();
  riverRippleTex.colorSpace = THREE.SRGBColorSpace;
  riverRippleTex.wrapS = THREE.RepeatWrapping;
  riverRippleTex.wrapT = THREE.RepeatWrapping;
  riverRippleTex.repeat.set(3, 26);
  riverRippleTex.needsUpdate = true;

  const lagoonRippleTex = texPack.waterRipple.clone();
  lagoonRippleTex.colorSpace = THREE.SRGBColorSpace;
  lagoonRippleTex.wrapS = THREE.RepeatWrapping;
  lagoonRippleTex.wrapT = THREE.RepeatWrapping;
  lagoonRippleTex.repeat.set(6, 6);
  lagoonRippleTex.needsUpdate = true;

  disposables.push(riverRippleTex, lagoonRippleTex);

  const seaTint =
    map.id === 'caribe_islas' || map.id === 'gt_peten_flores' || map.id === 'br_salvador'
      ? 0x06b6d4
      : 0x0284c7;
  const seaMat = createAnimatedWaterMaterial(texPack.waterRipple, seaTint, 0.72, waterTimeUniform);
  const lagoonMat = createAnimatedWaterMaterial(lagoonRippleTex, 0x0ea5e9, 0.24, waterTimeUniform);
  const riverMat = createAnimatedWaterMaterial(riverRippleTex, 0x38bdf8, 0.18, waterTimeUniform);
  const sandShoreMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.88 });
  const foamRingMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.68,
  });
  const boulderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  disposables.push(seaMat, lagoonMat, riverMat, sandShoreMat, foamRingMat, boulderMat);

  let surfFoamMesh: THREE.Mesh | null = null;
  let surfBaseCoord = 0;
  let surfAxis: 'x' | 'z' = 'z';

  // 4A. Rolling Sea / Coastal Ocean ("Mar con Olas en Movimiento")
  if (map.hasCoastalWater) {
    const seaGeo = new THREE.PlaneGeometry(2600, 920, 64, 32);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMesh = new THREE.Mesh(seaGeo, seaMat);

    const beachGeo = new THREE.PlaneGeometry(2600, 44);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMesh = new THREE.Mesh(beachGeo, sandShoreMat);

    const foamGeo = new THREE.PlaneGeometry(2600, 7);
    foamGeo.rotateX(-Math.PI / 2);
    surfFoamMesh = new THREE.Mesh(foamGeo, foamRingMat);

    if (map.waterSide === 'east') {
      seaMesh.rotation.y = Math.PI / 2;
      seaMesh.position.set(660, 0.08, 0);
      beachMesh.rotation.y = Math.PI / 2;
      beachMesh.position.set(205, 0.015, 0);
      surfFoamMesh.rotation.y = Math.PI / 2;
      surfBaseCoord = 216;
      surfAxis = 'x';
      surfFoamMesh.position.set(surfBaseCoord, 0.12, 0);
    } else if (map.waterSide === 'west') {
      seaMesh.rotation.y = Math.PI / 2;
      seaMesh.position.set(-660, 0.08, 0);
      beachMesh.rotation.y = Math.PI / 2;
      beachMesh.position.set(-205, 0.015, 0);
      surfFoamMesh.rotation.y = Math.PI / 2;
      surfBaseCoord = -216;
      surfAxis = 'x';
      surfFoamMesh.position.set(surfBaseCoord, 0.12, 0);
    } else if (map.waterSide === 'north') {
      seaMesh.position.set(0, 0.08, -640);
      beachMesh.position.set(0, 0.015, -192);
      surfBaseCoord = -202;
      surfAxis = 'z';
      surfFoamMesh.position.set(0, 0.12, surfBaseCoord);
    } else {
      seaMesh.position.set(0, 0.08, 640);
      beachMesh.position.set(0, 0.015, 192);
      surfBaseCoord = 202;
      surfAxis = 'z';
      surfFoamMesh.position.set(0, 0.12, surfBaseCoord);
    }

    group.add(beachMesh, seaMesh, surfFoamMesh);
    disposables.push(seaGeo, beachGeo, foamGeo);
  }

  // 4B. Scenic Crystal Lagoon & Lake ("Laguna y Lago con Movimiento") on EVERY track!
  const lagoonCandidates = [
    { x: -195, z: -155, rx: 42, rz: 30 },
    { x: 198, z: -150, rx: 40, rz: 28 },
    { x: -205, z: 155, rx: 44, rz: 32 },
    { x: 205, z: 155, rx: 40, rz: 30 },
    { x: 0, z: -205, rx: 46, rz: 28 },
    { x: -245, z: 10, rx: 42, rz: 34 },
    { x: 245, z: -10, rx: 42, rz: 34 },
  ];

  const placedLagoons: Array<{ x: number; z: number; rx: number; rz: number }> = [];
  for (const cand of lagoonCandidates) {
    if (isClear(cand.x, cand.z, Math.max(cand.rx, cand.rz) + 8)) {
      placedLagoons.push(cand);
      if (placedLagoons.length >= 2) break;
    }
  }
  if (placedLagoons.length === 0) {
    placedLagoons.push({ x: -255, z: -185, rx: 42, rz: 30 });
  }

  const lagoonDiscGeo = new THREE.CircleGeometry(1, 36, 0, Math.PI * 2);
  lagoonDiscGeo.rotateX(-Math.PI / 2);
  const shoreDiscGeo = new THREE.CircleGeometry(1.12, 32);
  shoreDiscGeo.rotateX(-Math.PI / 2);
  const rockGeo = new THREE.DodecahedronGeometry(1.15, 0);
  disposables.push(lagoonDiscGeo, shoreDiscGeo, rockGeo);

  placedLagoons.forEach((lg) => {
    const shore = new THREE.Mesh(shoreDiscGeo, sandShoreMat);
    shore.scale.set(lg.rx, 1, lg.rz);
    shore.position.set(lg.x, 0.012, lg.z);

    const waterDisc = new THREE.Mesh(lagoonDiscGeo, lagoonMat);
    waterDisc.scale.set(lg.rx, 1, lg.rz);
    waterDisc.position.set(lg.x, 0.065, lg.z);

    group.add(shore, waterDisc);

    // Natural shoreline boulders around lagoon
    for (let r = 0; r < 10; r++) {
      const ang = (r / 10) * Math.PI * 2 + 0.3;
      const rk = new THREE.Mesh(rockGeo, boulderMat);
      rk.position.set(
        lg.x + Math.cos(ang) * lg.rx * 1.03,
        0.35,
        lg.z + Math.sin(ang) * lg.rz * 1.03,
      );
      rk.scale.set(1.2 + (r % 3) * 0.4, 0.65, 1.0 + (r % 2) * 0.35);
      rk.rotation.y = r * 0.8;
      group.add(rk);
    }
  });

  // 4C. Meandering Flowing River ("Río con Corriente en Movimiento") on EVERY track!
  const bridgeLm = map.landmarks.find((l) => l.kind === 'stone_bridge');
  const riverCurvePoints: THREE.Vector3[] = bridgeLm
    ? [
        new THREE.Vector3(bridgeLm.x - 280, 0.032, bridgeLm.z - 85),
        new THREE.Vector3(bridgeLm.x - 135, 0.032, bridgeLm.z - 28),
        new THREE.Vector3(bridgeLm.x, 0.032, bridgeLm.z),
        new THREE.Vector3(bridgeLm.x + 145, 0.032, bridgeLm.z + 34),
        new THREE.Vector3(bridgeLm.x + 295, 0.032, bridgeLm.z + 92),
      ]
    : [
        new THREE.Vector3(-340, 0.032, -235),
        new THREE.Vector3(-165, 0.032, -212),
        new THREE.Vector3(10, 0.032, -242),
        new THREE.Vector3(185, 0.032, -218),
        new THREE.Vector3(350, 0.032, -248),
      ];

  const riverCurve = new THREE.CatmullRomCurve3(riverCurvePoints);
  const riverSegs = 44;
  const riverHalfW = 7.5;
  const riverPositions: number[] = [];
  const riverUvs: number[] = [];
  const riverIndices: number[] = [];
  const bankPositions: number[] = [];

  for (let i = 0; i <= riverSegs; i++) {
    const t = i / riverSegs;
    const pt = riverCurve.getPoint(t);
    const tan = riverCurve.getTangent(t);
    const nx = -tan.z;
    const nz = tan.x;
    const nLen = Math.hypot(nx, nz) || 1;
    const px = nx / nLen;
    const pz = nz / nLen;

    riverPositions.push(
      pt.x - px * riverHalfW,
      pt.y,
      pt.z - pz * riverHalfW,
      pt.x + px * riverHalfW,
      pt.y,
      pt.z + pz * riverHalfW,
    );
    bankPositions.push(
      pt.x - px * (riverHalfW + 3.2),
      0.01,
      pt.z - pz * (riverHalfW + 3.2),
      pt.x + px * (riverHalfW + 3.2),
      0.01,
      pt.z + pz * (riverHalfW + 3.2),
    );
    riverUvs.push(0, t, 1, t);

    if (i < riverSegs) {
      const base = i * 2;
      riverIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const riverBankGeo = new THREE.BufferGeometry();
  riverBankGeo.setAttribute('position', new THREE.Float32BufferAttribute(bankPositions, 3));
  riverBankGeo.setIndex(riverIndices);
  riverBankGeo.computeVertexNormals();
  const riverBankMesh = new THREE.Mesh(riverBankGeo, sandShoreMat);

  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPositions, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(riverUvs, 2));
  riverGeo.setIndex(riverIndices);
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);

  group.add(riverBankMesh, riverMesh);
  disposables.push(riverBankGeo, riverGeo);

  // =========================================================================
  // 5. BOTANICAL FLORA: INSTANCED 3D PALM TREES ("PALMERAS") & FLOWER BEDS ("FLORES")
  // =========================================================================
  const palmSpots: Array<{ x: number; z: number; scale: number; rot: number }> = [];
  // Place palms near lagoons, along avenues, and near beaches
  placedLagoons.forEach((lg, lIdx) => {
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2 + lIdx;
      const px = lg.x + Math.cos(ang) * (lg.rx + 4.8);
      const pz = lg.z + Math.sin(ang) * (lg.rz + 4.8);
      if (isClear(px, pz, 2.5)) {
        palmSpots.push({ x: px, z: pz, scale: 0.92 + (k % 3) * 0.14, rot: k * 1.1 });
      }
    }
  });

  for (let p = 0; p < 160 && palmSpots.length < 68; p++) {
    const seg = allRoads[p % Math.max(1, allRoads.length)];
    if (!seg || seg.points.length < 2) continue;
    const ptA = seg.points[p % (seg.points.length - 1)];
    const ptB = seg.points[(p % (seg.points.length - 1)) + 1];
    const t = ((p * 0.29) % 0.8) + 0.1;
    const dx = ptB.x - ptA.x;
    const dz = ptB.z - ptA.z;
    const len = Math.hypot(dx, dz);
    if (len < 16) continue;
    const nx = -dz / len;
    const nz = dx / len;
    const side = p % 2 === 0 ? 1 : -1;
    const offset = seg.width * 0.5 + 3.4;
    const px = ptA.x + dx * t + nx * side * offset;
    const pz = ptA.z + dz * t + nz * side * offset;
    if (isClear(px, pz, 2.2)) {
      palmSpots.push({ x: px, z: pz, scale: 0.88 + (p % 4) * 0.12, rot: p * 0.85 });
    }
  }

  if (palmSpots.length > 0) {
    const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.32, 6.2, 8);
    palmTrunkGeo.translate(0, 3.1, 0);
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x785333, roughness: 0.88 });
    const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmSpots.length);

    // Build a 6-frond arched tropical palm crown merged geometry (1 draw call for all palm crowns!)
    const frondLeafMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.68,
      side: THREE.DoubleSide,
    });
    const frondBladeGeo = new THREE.ConeGeometry(0.58, 3.1, 5);
    frondBladeGeo.scale(1, 1, 0.18);
    frondBladeGeo.rotateX(Math.PI * 0.42);
    frondBladeGeo.translate(0, 6.15, 1.35);

    const frondCountPerPalm = 6;
    const totalFronds = palmSpots.length * frondCountPerPalm;
    const palmFrondInst = new THREE.InstancedMesh(frondBladeGeo, frondLeafMat, totalFronds);

    const dummy = new THREE.Object3D();
    let fIdx = 0;
    palmSpots.forEach((ps, idx) => {
      dummy.position.set(ps.x, 0, ps.z);
      dummy.rotation.set(0.05, ps.rot, 0.04);
      dummy.scale.setScalar(ps.scale);
      dummy.updateMatrix();
      palmTrunkInst.setMatrixAt(idx, dummy.matrix);

      for (let f = 0; f < frondCountPerPalm; f++) {
        dummy.position.set(ps.x, 0, ps.z);
        dummy.rotation.set(0, ps.rot + (f * Math.PI * 2) / frondCountPerPalm, 0);
        dummy.scale.setScalar(ps.scale);
        dummy.updateMatrix();
        palmFrondInst.setMatrixAt(fIdx++, dummy.matrix);
      }
    });

    palmTrunkInst.instanceMatrix.needsUpdate = true;
    palmFrondInst.instanceMatrix.needsUpdate = true;
    palmTrunkInst.computeBoundingSphere();
    palmFrondInst.computeBoundingSphere();
    group.add(palmTrunkInst, palmFrondInst);
    disposables.push(palmTrunkGeo, palmTrunkMat, frondBladeGeo, frondLeafMat);
  }

  // Colorful 3D Flower Clusters ("Flores") along streets, plazas, and lagoon banks!
  const flowerSpots: Array<{ x: number; z: number; scale: number; colorHex: number }> = [];
  const flowerPalette = [0xec4899, 0xfacc15, 0xf97316, 0xa855f7, 0xef4444, 0x38bdf8, 0xffffff];

  for (let f = 0; f < 260 && flowerSpots.length < 180; f++) {
    const seg = allRoads[f % Math.max(1, allRoads.length)];
    if (!seg || seg.points.length < 2) continue;
    const ptA = seg.points[f % (seg.points.length - 1)];
    const ptB = seg.points[(f % (seg.points.length - 1)) + 1];
    const t = ((f * 0.17) % 0.88) + 0.06;
    const dx = ptB.x - ptA.x;
    const dz = ptB.z - ptA.z;
    const len = Math.hypot(dx, dz);
    if (len < 12) continue;
    const nx = -dz / len;
    const nz = dx / len;
    const side = f % 2 === 0 ? 1 : -1;
    const offset = seg.width * 0.5 + 1.85 + (f % 3) * 0.65;
    const fx = ptA.x + dx * t + nx * side * offset;
    const fz = ptA.z + dz * t + nz * side * offset;
    if (isClear(fx, fz, 1.1)) {
      flowerSpots.push({
        x: fx,
        z: fz,
        scale: 0.75 + (f % 4) * 0.18,
        colorHex: flowerPalette[f % flowerPalette.length],
      });
    }
  }

  if (flowerSpots.length > 0) {
    const bushLeafGeo = new THREE.SphereGeometry(0.55, 8, 6);
    bushLeafGeo.scale(1.25, 0.52, 1.25);
    bushLeafGeo.translate(0, 0.22, 0);
    const bushLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const bushInst = new THREE.InstancedMesh(bushLeafGeo, bushLeafMat, flowerSpots.length);

    const blossomGeo = new THREE.DodecahedronGeometry(0.36, 0);
    blossomGeo.scale(1.2, 0.72, 1.2);
    blossomGeo.translate(0, 0.48, 0);
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const blossomInst = new THREE.InstancedMesh(blossomGeo, blossomMat, flowerSpots.length);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    flowerSpots.forEach((fs, idx) => {
      dummy.position.set(fs.x, 0, fs.z);
      dummy.rotation.set(0, idx * 1.3, 0);
      dummy.scale.setScalar(fs.scale);
      dummy.updateMatrix();
      bushInst.setMatrixAt(idx, dummy.matrix);
      blossomInst.setMatrixAt(idx, dummy.matrix);
      col.setHex(fs.colorHex);
      blossomInst.setColorAt(idx, col);
    });

    bushInst.instanceMatrix.needsUpdate = true;
    blossomInst.instanceMatrix.needsUpdate = true;
    if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true;
    bushInst.computeBoundingSphere();
    blossomInst.computeBoundingSphere();
    group.add(bushInst, blossomInst);
    disposables.push(bushLeafGeo, bushLeafMat, blossomGeo, blossomMat);
  }

  // =========================================================================
  // 6. ROADSIDE SIGNS ACROSS ALL TRACKS:
  //    - Subtle Intercultural & Anti-Racism Urban Boards (4 per track)
  //    - Small Disability & Cognitive Spectrum Support Signs (4 per track)
  //    - 19th & 20th Century Spain & Guatemala Ludic Games Signs (6 per track)
  // =========================================================================
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.4,
  });
  const woodPostMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.82,
  });
  disposables.push(postMat, woodPostMat);

  const validRoadSegments: Array<{
    ax: number;
    az: number;
    bx: number;
    bz: number;
    width: number;
    len: number;
  }> = [];
  for (const r of map.roads) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i];
      const b = r.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len >= 24) {
        validRoadSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, width: r.width, len });
      }
    }
  }

  const placeRoadsideSign = (
    slotIdx: number,
    boardW: number,
    boardH: number,
    poleH: number,
    tex: THREE.CanvasTexture,
    wooden: boolean,
  ) => {
    if (validRoadSegments.length === 0) return;
    const seg = validRoadSegments[slotIdx % validRoadSegments.length];
    const frac = 0.22 + ((slotIdx * 0.27) % 0.58);
    const dx = seg.bx - seg.ax;
    const dz = seg.bz - seg.az;
    const ux = dx / seg.len;
    const uz = dz / seg.len;
    const nx = -uz;
    const nz = ux;
    const side = slotIdx % 2 === 0 ? 1 : -1;
    const lateral = seg.width * 0.5 + 2.35;

    const sx = seg.ax + dx * frac + nx * side * lateral;
    const sz = seg.az + dz * frac + nz * side * lateral;

    const signRig = new THREE.Group();
    signRig.position.set(sx, 0, sz);
    // Angle slightly toward oncoming drivers on the street
    const roadHeading = Math.atan2(-ux, -uz);
    signRig.rotation.y = roadHeading + (side > 0 ? 0.32 : -0.32);

    const pGeo = new THREE.CylinderGeometry(0.08, 0.1, poleH, 8);
    const pMat = wooden ? woodPostMat : postMat;
    if (boardW > 3.2) {
      const pL = new THREE.Mesh(pGeo, pMat);
      pL.position.set(-boardW * 0.36, poleH * 0.5, 0);
      const pR = new THREE.Mesh(pGeo, pMat);
      pR.position.set(boardW * 0.36, poleH * 0.5, 0);
      signRig.add(pL, pR);
    } else {
      const pC = new THREE.Mesh(pGeo, pMat);
      pC.position.set(0, poleH * 0.5, 0);
      signRig.add(pC);
    }

    const frameGeo = new THREE.BoxGeometry(boardW + 0.16, boardH + 0.16, 0.12);
    const frameMesh = new THREE.Mesh(frameGeo, pMat);
    frameMesh.position.set(0, poleH + boardH * 0.38, 0);

    const faceGeo = new THREE.PlaneGeometry(boardW, boardH);
    const faceMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.38,
      metalness: 0.04,
    });
    const frontFace = new THREE.Mesh(faceGeo, faceMat);
    frontFace.position.set(0, poleH + boardH * 0.38, 0.075);
    const backFace = new THREE.Mesh(faceGeo, faceMat);
    backFace.position.set(0, poleH + boardH * 0.38, -0.075);
    backFace.rotation.y = Math.PI;

    signRig.add(frameMesh, frontFace, backFace);
    group.add(signRig);
    disposables.push(pGeo, frameGeo, faceGeo, faceMat, tex);
  };

  const mapSeed = map.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  // Place 4 subtle interculturality / anti-racism urban route boards
  for (let i = 0; i < 4; i++) {
    const tex = createInterculturalBoardTexture(mapSeed + i);
    placeRoadsideSign(i * 3 + 1, 4.4, 1.76, 2.5, tex, false);
  }

  // Place 4 small sidewalk signs ("rótulos pequeños anuncios") for disability & cognitive spectrum respect
  for (let i = 0; i < 4; i++) {
    const tex = createSmallInclusionSignTexture(mapSeed + i);
    placeRoadsideSign(i * 3 + 2, 2.25, 1.14, 1.55, tex, false);
  }

  // Place 6 heritage signs of 19th & 20th century Spain & Guatemala ludic games on EVERY track
  for (let i = 0; i < 6; i++) {
    const tex = createHistoricLudicGameSignTexture(mapSeed + i);
    placeRoadsideSign(i * 2, 3.6, 1.52, 2.15, tex, true);
  }

  return {
    group,
    setTimeOfDay,
    update: (timeSec: number, dt: number) => {
      waterTimeUniform.value = timeSec;
      // Animate water surface currents & waves
      texPack.waterRipple.offset.x = (texPack.waterRipple.offset.x + dt * 0.14) % 1;
      texPack.waterRipple.offset.y = (texPack.waterRipple.offset.y + dt * 0.09) % 1;
      lagoonRippleTex.offset.x = (lagoonRippleTex.offset.x - dt * 0.08) % 1;
      lagoonRippleTex.offset.y = (lagoonRippleTex.offset.y + dt * 0.06) % 1;
      // River flows steadily along its channel!
      riverRippleTex.offset.y = (riverRippleTex.offset.y - dt * 0.42) % 1;

      if (surfFoamMesh) {
        const waveShift = Math.sin(timeSec * 1.9) * 2.8;
        if (surfAxis === 'x') {
          surfFoamMesh.position.x = surfBaseCoord + (surfBaseCoord > 0 ? -waveShift : waveShift);
        } else {
          surfFoamMesh.position.z = surfBaseCoord + (surfBaseCoord > 0 ? -waveShift : waveShift);
        }
      }

      // Gentle volcanic steam plume drift
      for (const pf of plumePuffs) {
        pf.mesh.position.x = pf.baseX + Math.sin(timeSec * 0.7 + pf.phase) * 5.5;
        pf.mesh.position.y = pf.baseY + Math.cos(timeSec * 0.9 + pf.phase) * 2.5;
      }
    },
    dispose: () => {
      skyTex.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}

/**
 * Floating 3D golden-emerald guidance arrow above a player's vehicle pointing directly toward
 * the active checkpoint meta so all players easily find the finish line in Add-Time Race mode.
 */
export function createGuidanceArrowRig3D(accentHex = 0x10b981): GuidanceArrowHandle3D {
  const group = new THREE.Group();
  const arrowPivot = new THREE.Group();

  const arrowMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: new THREE.Color(accentHex),
    emissiveIntensity: 0.95,
    metalness: 0.4,
    roughness: 0.22,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.7,
    metalness: 0.7,
    roughness: 0.2,
  });

  // Shaft pointing toward -Z in local space
  const shaftGeo = new THREE.BoxGeometry(0.28, 0.14, 0.95);
  const shaft = new THREE.Mesh(shaftGeo, arrowMat);
  shaft.position.set(0, 0, 0.22);

  // Cone tip pointing toward -Z
  const tipGeo = new THREE.ConeGeometry(0.46, 0.72, 12);
  tipGeo.rotateX(-Math.PI / 2);
  const tip = new THREE.Mesh(tipGeo, goldTrimMat);
  tip.position.set(0, 0, -0.52);

  arrowPivot.add(shaft, tip);
  group.add(arrowPivot);

  return {
    group,
    update: (carX, carZ, targetX, targetZ, timeSec, visible) => {
      group.visible = visible;
      if (!visible) return;
      group.position.set(carX, 3.35 + Math.sin(timeSec * 4.2) * 0.14, carZ);
      const dx = targetX - carX;
      const dz = targetZ - carZ;
      arrowPivot.rotation.y = Math.atan2(-dx, -dz);
    },
    dispose: () => {
      shaftGeo.dispose();
      tipGeo.dispose();
      arrowMat.dispose();
      goldTrimMat.dispose();
    },
  };
}
