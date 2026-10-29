import * as THREE from 'three';
import { HouseStyle, RoadSurface } from '../types/game';

export interface ProceduralTexturePack {
  roads: Record<RoadSurface, THREE.CanvasTexture>;
  roofTile: THREE.CanvasTexture;
  roofSlate: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  houseFacades: THREE.CanvasTexture[];
  dispose: () => void;
}

function finalizeColorTex(tex: THREE.CanvasTexture, maxAnisotropy: number, repeatX = 1, repeatY = 1) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function buildRoadTexture(surface: RoadSurface, maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  if (surface === 'cobblestone') {
    ctx.fillStyle = '#3d3934';
    ctx.fillRect(0, 0, 512, 512);
    // Colonial stone cobbles
    const rows = 16;
    const cols = 12;
    const cellW = 436 / cols;
    const cellH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const offset = (r % 2) * (cellW * 0.45);
        const sx = 38 + ((col * cellW + offset) % 436);
        const sy = r * cellH;
        const shade = 78 + ((r * 17 + col * 31) % 38);
        const warm = (r + col) % 3 === 0 ? 8 : 0;
        ctx.fillStyle = `rgb(${shade + warm}, ${shade + 2}, ${shade - 4})`;
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, cellW - 5, cellH - 5, 7);
        ctx.fill();
      }
    }
    // Stone sidewalks / banquetas coloniales
    ctx.fillStyle = '#8b7d6b';
    ctx.fillRect(0, 0, 36, 512);
    ctx.fillRect(476, 0, 36, 512);
    ctx.fillStyle = '#65594b';
    ctx.fillRect(34, 0, 4, 512);
    ctx.fillRect(474, 0, 4, 512);
    // Central rainwater gutter (cuneta central colonial)
    ctx.fillStyle = 'rgba(30,27,24,0.45)';
    ctx.fillRect(250, 0, 12, 512);
  } else if (surface === 'campus_paver') {
    // Smooth campus raceway asphalt with brick-lined shoulders
    ctx.fillStyle = '#252932';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1600; i++) {
      const gx = (i * 73) % 512;
      const gy = (i * 139) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(gx, gy, 2, 2);
    }
    // Brick & concrete campus curbs
    for (let y = 0; y < 512; y += 32) {
      ctx.fillStyle = (y / 32) % 2 === 0 ? '#9a3412' : '#cbd5e1';
      ctx.fillRect(0, y, 28, 32);
      ctx.fillRect(484, y, 28, 32);
    }
    // Crisp white edge lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(36, 0, 6, 512);
    ctx.fillRect(470, 0, 6, 512);
    // Dashed golden center line
    ctx.fillStyle = '#f59e0b';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(253, y, 6, 36);
    }
  } else {
    // Standard asphalt or wide boulevard
    ctx.fillStyle = surface === 'boulevard' ? '#1f242d' : '#282d36';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) {
      const gx = (i * 97) % 512;
      const gy = (i * 151) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(gx, gy, 2, 2);
    }
    // Concrete sidewalks
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 30, 512);
    ctx.fillRect(482, 0, 30, 512);
    // White edge lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(38, 0, 5, 512);
    ctx.fillRect(469, 0, 5, 512);

    if (surface === 'boulevard') {
      // Double yellow center divider + secondary lane dashes
      ctx.fillStyle = '#facc15';
      ctx.fillRect(249, 0, 4, 512);
      ctx.fillRect(259, 0, 4, 512);
      ctx.fillStyle = 'rgba(248,250,252,0.75)';
      for (let y = 16; y < 512; y += 64) {
        ctx.fillRect(142, y, 4, 32);
        ctx.fillRect(366, y, 4, 32);
      }
    } else {
      ctx.fillStyle = '#facc15';
      for (let y = 16; y < 512; y += 64) {
        ctx.fillRect(253, y, 6, 34);
      }
    }
  }

  return finalizeColorTex(c ? new THREE.CanvasTexture(c) : new THREE.CanvasTexture(c), maxAnisotropy);
}

function buildRoofTileTexture(isClay: boolean, maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = isClay ? '#8c3b23' : '#334155';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = isClay ? 'rgba(45,15,8,0.35)' : 'rgba(15,23,42,0.4)';
    ctx.fillRect(0, y, 256, 3);
    for (let x = 0; x < 256; x += 24) {
      ctx.fillStyle =
        (x + y) % 48 === 0
          ? isClay
            ? 'rgba(255,190,150,0.12)'
            : 'rgba(255,255,255,0.07)'
          : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 2, y + 3, 20, 12);
    }
  }
  return finalizeColorTex(new THREE.CanvasTexture(c), maxAnisotropy, 2, 2);
}

function buildHouseFacadeVariants(style: HouseStyle, maxAnisotropy: number): THREE.CanvasTexture[] {
  const palettes: Record<HouseStyle, string[]> = {
    colonial_gt: ['#e8b96a', '#d97757', '#e6dfd3', '#6da394', '#c96453'],
    campus_gt: ['#9a3c26', '#cbd5e1', '#b45339', '#e2e8f0'],
    latin_residential: ['#f1efe7', '#eab676', '#a7c4bc', '#e59866', '#dbeafe'],
    caribbean_island: ['#2dd4bf', '#fb7185', '#fbbf24', '#60a5fa', '#a3e635'],
    modernist_brasilia: ['#f8fafc', '#e2e8f0', '#cbd5e1'],
    european_classic: ['#dfd3c3', '#d4a373', '#e9edc9', '#ced4da'],
    north_american: ['#e2e8f0', '#cbd5e1', '#991b1b', '#fef3c7'],
    coastal_southern: ['#f8fafc', '#93c5fd', '#fde68a', '#fda4af'],
  };

  const walls = palettes[style] || palettes.latin_residential;

  return walls.map((wallColor, idx) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    // Base stucco / clapboard / brick wall
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, 256, 256);

    if (style === 'north_american' || style === 'caribbean_island') {
      // Horizontal siding clapboards
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = 0; y < 256; y += 10) {
        ctx.fillRect(0, y, 256, 1.5);
      }
    } else if (style === 'campus_gt' && idx % 2 === 0) {
      // Brick courses
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let y = 0; y < 256; y += 12) {
        ctx.fillRect(0, y, 256, 1.5);
      }
    }

    // Lower stone plinth (zócalo)
    ctx.fillStyle = style === 'colonial_gt' ? '#5c5346' : '#475569';
    ctx.fillRect(0, 218, 256, 38);

    // Roofline cornice
    ctx.fillStyle = style === 'colonial_gt' ? '#7c2d12' : '#334155';
    ctx.fillRect(0, 0, 256, 12);

    const stories = style === 'colonial_gt' && idx % 2 === 0 ? 1 : 2;

    if (stories === 1) {
      // Single-story real colonial house: central carved wood door + flanked wrought-iron windows
      ctx.fillStyle = '#451a03';
      ctx.fillRect(104, 134, 48, 122);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.strokeRect(104, 134, 48, 122);

      // Door panels
      ctx.fillStyle = '#78350f';
      ctx.fillRect(111, 144, 14, 42);
      ctx.fillRect(131, 144, 14, 42);
      ctx.fillRect(111, 196, 14, 46);
      ctx.fillRect(131, 196, 14, 46);

      // Windows with warm interior light & iron bars
      for (const wx of [28, 180]) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(wx - 4, 126, 56, 76);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx, 130, 48, 68);
        ctx.fillStyle = 'rgba(251,191,36,0.45)';
        ctx.fillRect(wx + 4, 134, 40, 60);
        // Iron grille bars
        ctx.fillStyle = '#0f172a';
        for (let bx = wx + 8; bx < wx + 48; bx += 8) {
          ctx.fillRect(bx, 128, 2, 72);
        }
      }
    } else {
      // Two-story residential / urban house with garage/door + upper balcony windows
      // Upper floor windows
      for (const wx of [26, 104, 182]) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(wx - 3, 36, 54, 68);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx, 39, 48, 62);
        ctx.fillStyle = 'rgba(253,224,71,0.38)';
        ctx.fillRect(wx + 4, 43, 18, 54);
        ctx.fillRect(wx + 26, 43, 18, 54);
        // Balcony rail
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(wx - 5, 92, 58, 14);
      }

      // Mid floor trim band
      ctx.fillStyle = 'rgba(15,23,42,0.18)';
      ctx.fillRect(0, 118, 256, 6);

      // Ground floor: Garage portón on left + Pedestrian entrance + window
      ctx.fillStyle = '#334155';
      ctx.fillRect(22, 146, 86, 110);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      for (let gy = 154; gy < 252; gy += 12) {
        ctx.fillRect(26, gy, 78, 3);
      }

      // Main front door
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(128, 152, 40, 104);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(160, 202, 4, 8);

      // Ground window
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(184, 152, 48, 62);
      ctx.fillStyle = 'rgba(251,191,36,0.42)';
      ctx.fillRect(188, 156, 40, 54);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  });
}

function buildContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTexturePack(
  renderer: THREE.WebGLRenderer,
  houseStyle: HouseStyle,
): ProceduralTexturePack {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const roads: Record<RoadSurface, THREE.CanvasTexture> = {
    cobblestone: buildRoadTexture('cobblestone', maxAniso),
    asphalt: buildRoadTexture('asphalt', maxAniso),
    campus_paver: buildRoadTexture('campus_paver', maxAniso),
    boulevard: buildRoadTexture('boulevard', maxAniso),
  };
  const roofTile = buildRoofTileTexture(true, maxAniso);
  const roofSlate = buildRoofTileTexture(false, maxAniso);
  const contactShadow = buildContactShadowTexture();
  const houseFacades = buildHouseFacadeVariants(houseStyle, maxAniso);

  return {
    roads,
    roofTile,
    roofSlate,
    contactShadow,
    houseFacades,
    dispose: () => {
      Object.values(roads).forEach((t) => t.dispose());
      roofTile.dispose();
      roofSlate.dispose();
      contactShadow.dispose();
      houseFacades.forEach((t) => t.dispose());
    },
  };
}

export function createDriverLabelSprite(alias: string, carBrand: string, accentHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
  ctx.beginPath();
  ctx.roundRect(16, 18, 480, 92, 18);
  ctx.fill();

  ctx.strokeStyle = accentHex || '#f59e0b';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 38px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(alias.slice(0, 18), 256, 64);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px Plus Jakarta Sans, sans-serif';
  ctx.fillText(carBrand.slice(0, 26), 256, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}

export function createNumberDoorTexture(numText: string, bgHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(68, 14, 120, 100);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 68px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numText, 128, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
