import * as THREE from 'three';
import { WorldMapSpec } from '../types/game';

export interface AnimatedWorldWildlifeHandle {
  group: THREE.Group;
  update: (timeSec: number, dt: number) => void;
  dispose: () => void;
}

interface FlyingBirdRig {
  pivot: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  centerX: number;
  centerZ: number;
  altitude: number;
  radius: number;
  angularSpeed: number;
  phase: number;
  flapSpeed: number;
}

function createInfoSignSprite(title: string, subtitle: string): {
  sprite: THREE.Sprite;
  tex: THREE.CanvasTexture;
  mat: THREE.SpriteMaterial;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(11, 18, 30, 0.92)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 620, 124, 18);
  ctx.fill();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 30px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 38), 320, 62);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 22px Plus Jakarta Sans, sans-serif';
  ctx.fillText(subtitle.slice(0, 46), 320, 104);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.8, 1.55, 1);
  return { sprite, tex, mat };
}

/**
 * Builds soft white sky clouds and cheerful 3D songbirds ("pajaritos") flying in the sky.
 */
export function createWorldWildlifeAndZoo3D(
  map: WorldMapSpec,
  includeGroundScene = true,
): AnimatedWorldWildlifeHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const birds: FlyingBirdRig[] = [];

  // 1. Soft White Clouds in the Sky
  if (includeGroundScene) {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.0,
    });
    const puffGeo = new THREE.SphereGeometry(1, 12, 10);
    disposables.push(cloudMat, puffGeo);

    for (let c = 0; c < 14; c++) {
      const cg = new THREE.Group();
      const ang = (c / 14) * Math.PI * 2;
      const dist = 160 + (c % 4) * 85;
      cg.position.set(Math.cos(ang) * dist, 92 + (c % 3) * 16, Math.sin(ang) * dist);

      const offsets = [
        { x: 0, y: 0, z: 0, s: 14 },
        { x: 11, y: -2, z: 2, s: 10.5 },
        { x: -11, y: -1.5, z: -2, s: 11 },
        { x: 4, y: 5, z: -3, s: 9.5 },
      ];
      for (const off of offsets) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(off.x, off.y, off.z);
        puff.scale.set(off.s * 1.35, off.s * 0.72, off.s);
        cg.add(puff);
      }
      group.add(cg);
    }
  }

  // 2. Flying Songbirds ("Pajaritos") in the Sky
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 });
  const bluebirdMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.52 });
  const goldfinchMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.52 });
  const cardinalMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.52 });
  const swallowMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.52 });

  const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.46, 5, 8);
  bodyGeo.rotateX(Math.PI / 2);
  const headGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const beakGeo = new THREE.ConeGeometry(0.06, 0.18, 6);
  beakGeo.rotateX(-Math.PI / 2);
  const wingGeo = new THREE.BoxGeometry(0.68, 0.035, 0.28);
  const tailGeo = new THREE.BoxGeometry(0.14, 0.03, 0.42);

  disposables.push(
    beakMat,
    bluebirdMat,
    goldfinchMat,
    cardinalMat,
    swallowMat,
    bodyGeo,
    headGeo,
    beakGeo,
    wingGeo,
    tailGeo,
  );

  const birdPalette = [bluebirdMat, goldfinchMat, cardinalMat, swallowMat];
  const totalBirds = 20;

  for (let b = 0; b < totalBirds; b++) {
    const mainMat = birdPalette[b % birdPalette.length];
    const birdGroup = new THREE.Group();
    birdGroup.scale.setScalar(0.82);

    const body = new THREE.Mesh(bodyGeo, mainMat);
    const head = new THREE.Mesh(headGeo, mainMat);
    head.position.set(0, 0.07, -0.32);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, 0.04, -0.48);

    const tail = new THREE.Mesh(tailGeo, mainMat);
    tail.position.set(0, 0.02, 0.42);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.12, 0.05, -0.04);
    const lwMesh = new THREE.Mesh(wingGeo, mainMat);
    lwMesh.position.set(-0.34, 0, 0);
    leftWing.add(lwMesh);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.12, 0.05, -0.04);
    const rwMesh = new THREE.Mesh(wingGeo, mainMat);
    rwMesh.position.set(0.34, 0, 0);
    rightWing.add(rwMesh);

    birdGroup.add(body, head, beak, tail, leftWing, rightWing);
    group.add(birdGroup);

    const ringIdx = Math.floor(b / 5);
    const cx = map.spawn.x + Math.cos(b * 1.7) * (24 + ringIdx * 40);
    const cz = map.spawn.z + Math.sin(b * 1.7) * (24 + ringIdx * 40);
    birds.push({
      pivot: birdGroup,
      leftWing,
      rightWing,
      centerX: cx,
      centerZ: cz,
      altitude: 11.5 + (b % 5) * 3.2,
      radius: 15 + (b % 4) * 10,
      angularSpeed: (b % 2 === 0 ? 1 : -1) * (0.45 + (b % 3) * 0.14),
      phase: b * 0.85,
      flapSpeed: 12.5,
    });
  }

  return {
    group,
    update: (timeSec: number, dt: number) => {
      for (const b of birds) {
        b.phase += b.angularSpeed * dt;
        const nx = b.centerX + Math.cos(b.phase) * b.radius;
        const nz = b.centerZ + Math.sin(b.phase) * b.radius;
        const bobY = b.altitude + Math.sin(timeSec * 1.8 + b.phase) * 0.85;
        const vx = -Math.sin(b.phase) * b.angularSpeed;
        const vz = Math.cos(b.phase) * b.angularSpeed;
        b.pivot.position.set(nx, bobY, nz);
        b.pivot.rotation.y = Math.atan2(-vx, -vz);

        const flap = Math.sin(timeSec * b.flapSpeed + b.phase * 3) * 0.62;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/**
 * Builds FIA-style Red/White Racing Kerbs, Tire Safety Stacks, and Start/Finish Gantry
 * when driving on a Closed-Circuit Race Track.
 */
export function createClosedCircuitInfrastructure3D(map: WorldMapSpec): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  if (!map.isClosedCircuit) {
    return { group, dispose: () => {} };
  }

  const kerbRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 });
  const kerbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.3,
  });
  const greenRaceLed = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: new THREE.Color(0x16a34a),
    emissiveIntensity: 1.8,
  });
  const kerbGeo = new THREE.BoxGeometry(1.3, 0.12, 2.2);
  const tireStackGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.15, 12);

  disposables.push(
    kerbRedMat,
    kerbWhiteMat,
    steelMat,
    greenRaceLed,
    kerbGeo,
    tireStackGeo,
  );

  // Start / Finish Motorsport Gantry over Spawn Point
  const gantry = new THREE.Group();
  gantry.position.set(map.spawn.x, 0, map.spawn.z);
  gantry.rotation.y = map.spawn.heading;

  const pLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 7.6, 12), steelMat);
  pLeft.position.set(-8.8, 3.8, -6);
  const pRight = pLeft.clone();
  pRight.position.x = 8.8;

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(18.6, 1.15, 0.9), steelMat);
  bridge.position.set(0, 7.3, -6);

  for (const lx of [-3.6, -1.8, 0, 1.8, 3.6]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), greenRaceLed);
    light.position.set(lx, 6.55, -5.45);
    gantry.add(light);
  }

  const gantrySign = createInfoSignSprite(
    `PISTA 3D · ${map.name.toUpperCase()}`,
    'Circuito de Velocidad · Pianos Rojiblancos',
  );
  gantrySign.sprite.position.set(0, 9.1, -6);
  disposables.push(gantrySign.tex, gantrySign.mat);
  gantry.add(pLeft, pRight, bridge, gantrySign.sprite);
  group.add(gantry);

  // Place Red/White Racing Kerbs & Outer Tire Stacks at Circuit Corners
  const mainLoop = map.roads[0];
  if (mainLoop && mainLoop.points.length >= 3) {
    for (let i = 0; i < mainLoop.points.length - 1; i++) {
      const a = mainLoop.points[i];
      const b = mainLoop.points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 6) continue;
      const heading = Math.atan2(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const halfW = mainLoop.width * 0.5 + 0.55;

      for (let k = 0; k < 5; k++) {
        const dist = Math.min(len - 2, 3 + k * 2.3);
        const kx = a.x + (dx / len) * dist + nx * halfW;
        const kz = a.z + (dz / len) * dist + nz * halfW;
        const kerb = new THREE.Mesh(kerbGeo, k % 2 === 0 ? kerbRedMat : kerbWhiteMat);
        kerb.position.set(kx, 0.07, kz);
        kerb.rotation.y = heading;
        group.add(kerb);
      }

      const tx = a.x + nx * -(mainLoop.width * 0.5 + 3.8);
      const tz = a.z + nz * -(mainLoop.width * 0.5 + 3.8);
      const tireStack = new THREE.Mesh(tireStackGeo, i % 2 === 0 ? kerbRedMat : kerbWhiteMat);
      tireStack.position.set(tx, 0.58, tz);
      group.add(tireStack);
    }
  }

  return {
    group,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
