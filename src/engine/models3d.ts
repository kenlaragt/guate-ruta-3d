import * as THREE from 'three';
import {
  CheckpointPresenterPlan,
  PEDESTRIAN_UV_SLICES,
} from '../data/awardsCatalog';
import { CarSpec, HouseStyle, LandmarkSpec } from '../types/game';
import {
  createAvatarFaceTexture,
  createDriverLabelSprite,
  createNumberDoorTexture,
  createValueMessageDecalTexture,
  ProceduralTexturePack,
} from './proceduralTextures';

export interface CarRig3D {
  group: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  cockpitWheel: THREE.Group;
  brakeLights: THREE.MeshStandardMaterial;
  cyclistLegs?: { left: THREE.Group; right: THREE.Group; crank: THREE.Group };
  dispose: () => void;
}

export interface WalkingPedestrian3D {
  group: THREE.Group;
  updateWalk: (phase: number) => void;
  dispose: () => void;
}

export interface CheckpointMetaStage3D {
  group: THREE.Group;
  configureForPlan: (plan: CheckpointPresenterPlan) => void;
  setActiveTarget: (isActive: boolean) => void;
  updateAnimation: (timeSec: number) => void;
  dispose: () => void;
}

function createLicensePlateTexture(plateCode: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AMÉRICA · EUROPA 3D', 128, 17);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 44px JetBrains Mono, monospace';
  ctx.fillText(plateCode, 128, 72);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, 252, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMetaBannerSprite(
  topLine: string,
  bottomLine: string,
  isGrandFinale: boolean,
): { sprite: THREE.Sprite; tex: THREE.CanvasTexture; mat: THREE.SpriteMaterial } {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isGrandFinale ? 'rgba(30, 17, 6, 0.94)' : 'rgba(9, 13, 22, 0.92)';
  ctx.beginPath();
  ctx.roundRect(14, 14, 740, 148, 22);
  ctx.fill();

  ctx.strokeStyle = isGrandFinale ? '#facc15' : '#f59e0b';
  ctx.lineWidth = isGrandFinale ? 7 : 5;
  ctx.stroke();

  ctx.fillStyle = isGrandFinale ? '#fde047' : '#fbbf24';
  ctx.font = 'bold 34px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(topLine.slice(0, 42), 384, 72);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 28px Plus Jakarta Sans, sans-serif';
  ctx.fillText(bottomLine.slice(0, 48), 384, 124);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(isGrandFinale ? 9.5 : 8.2, isGrandFinale ? 2.2 : 1.9, 1);
  return { sprite, tex, mat };
}

function applyHorizontalUvSlice(geo: THREE.PlaneGeometry, uMin: number, uMax: number, vMin = 0.04, vMax = 0.98) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  uv.setXY(0, uMin, vMax);
  uv.setXY(1, uMax, vMax);
  uv.setXY(2, uMin, vMin);
  uv.setXY(3, uMax, vMin);
  uv.needsUpdate = true;
}

const AVATAR_SKIN_TONES = ['#f4c7ab', '#d6956a', '#9c6137', '#e8b48f', '#c68652', '#f9dfd0'];
const AVATAR_HAIR_COLORS = [0x1e293b, 0x451a03, 0x78350f, 0x0f172a, 0x92400e];

/**
 * Cover-Art-Style 3D Driver Avatar seated at the controls (-Z forward),
 * with expressive smiling face, diverse skin tone, cap/helmet/hair, jacket, and arms reaching the wheel/bar.
 */
function createCoverArtDriverAvatar3D(
  seed: number,
  jacketHex: string,
  accentHex: string,
  headgear: 'cap' | 'helmet' | 'visor',
  scaleFactor: number,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const avatar = new THREE.Group();
  const skinHex = AVATAR_SKIN_TONES[Math.abs(seed) % AVATAR_SKIN_TONES.length];
  const faceTex = createAvatarFaceTexture(skinHex, seed % 3 === 1);
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex), roughness: 0.58 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.55 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(jacketHex), roughness: 0.52 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accentHex), roughness: 0.42 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: AVATAR_HAIR_COLORS[Math.abs(seed) % AVATAR_HAIR_COLORS.length],
    roughness: 0.78,
  });

  // Torso + sporty chest stripe
  const torsoGeo = new THREE.CapsuleGeometry(0.155, 0.28, 6, 12);
  const torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.position.set(0, 0.24, 0);

  const collarGeo = new THREE.CylinderGeometry(0.12, 0.145, 0.07, 12);
  const collar = new THREE.Mesh(collarGeo, accentMat);
  collar.position.set(0, 0.42, 0);

  // Expressive 3D Head facing -Z (Sphere UV seam is at +Z, center u=0.5 faces +X by default, so rotateY(+PI/2) faces -Z)
  const headGeo = new THREE.SphereGeometry(0.135, 16, 14);
  const head = new THREE.Mesh(headGeo, faceMat);
  head.position.set(0, 0.57, -0.01);
  head.rotation.y = Math.PI / 2;

  avatar.add(torso, collar, head);

  // Hair + Cap / Helmet / Visor
  const hairBackGeo = new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hairBack = new THREE.Mesh(hairBackGeo, headgear === 'helmet' ? accentMat : hairMat);
  hairBack.position.set(0, 0.585, 0.008);
  hairBack.rotation.x = -0.18;
  avatar.add(hairBack);

  const brimGeo = new THREE.CylinderGeometry(0.145, 0.155, 0.025, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.9);
  const brim = new THREE.Mesh(brimGeo, accentMat);
  brim.position.set(0, 0.625, -0.055);
  brim.rotation.y = Math.PI;
  brim.rotation.x = -0.15;
  avatar.add(brim);

  // Arms reaching forward toward wheel / handlebars (-Z)
  const armGeo = new THREE.CapsuleGeometry(0.046, 0.26, 5, 8);
  const handGeo = new THREE.SphereGeometry(0.048, 8, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, jacketMat);
    arm.position.set(side * 0.175, 0.33, -0.14);
    arm.rotation.x = Math.PI * 0.38;
    arm.rotation.z = side * -0.16;

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(side * 0.145, 0.27, -0.29);
    avatar.add(arm, hand);
  }

  avatar.scale.setScalar(scaleFactor);

  disposables.push(
    faceTex,
    skinMat,
    faceMat,
    jacketMat,
    accentMat,
    hairMat,
    torsoGeo,
    collarGeo,
    headGeo,
    hairBackGeo,
    brimGeo,
    armGeo,
    handGeo,
  );

  return avatar;
}

// ============================================================================
// REALISTIC MULTI-PART VEHICLES WITH 3D AVATARS & VALUE MESSAGES:
// BICYCLE, ELECTRIC QUAD-TRIKE, ELECTRIC TRICYCLE, TUK-TUK, PICKUP, TRUCK & CARS
// ============================================================================
export function createRealisticCarRig(
  spec: CarSpec,
  paintHex: string,
  contactShadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
  driverAlias?: string,
  customValueMessage?: string,
): CarRig3D {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const activeValueMessage = customValueMessage || spec.valueMessage || 'Respeto y Unión';
  const avatarSeed =
    (driverAlias || spec.id)
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + spec.horsepower;

  const bodyColor = new THREE.Color(paintHex || spec.defaultPaint);
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: spec.bodyStyle === 'tuk_tuk' ? 0.42 : 0.68,
    roughness: spec.bodyStyle === 'tuk_tuk' ? 0.3 : 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentHex || '#1e293b'),
    metalness: 0.45,
    roughness: 0.5,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x151921,
    metalness: 0.35,
    roughness: 0.56,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.14,
  });
  // Crystal sky-tinted transparent cabin glass so 3D driver avatars inside every vehicle are clearly visible!
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    metalness: 0.08,
    roughness: 0.06,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.38,
    depthWrite: false,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xe0f2fe),
    emissiveIntensity: 2.0,
    roughness: 0.12,
  });
  const evCyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x0ea5e9),
    emissiveIntensity: 1.65,
    roughness: 0.2,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xdc2626),
    emissiveIntensity: 0.95,
    roughness: 0.22,
  });
  const amberBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.88,
    metalness: 0.06,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.55,
    roughness: 0.32,
  });

  // Value Message Livery Badge Texture shared on vehicle sides / rear
  const valueDecalTex = createValueMessageDecalTexture(
    activeValueMessage,
    spec.accentHex || paintHex || '#38bdf8',
  );
  const valueDecalMat = new THREE.MeshStandardMaterial({
    map: valueDecalTex,
    roughness: 0.28,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  disposables.push(
    paintMat,
    trimMat,
    carbonMat,
    chromeMat,
    glassMat,
    headlightMat,
    evCyanGlowMat,
    brakeLightMat,
    amberBlinkerMat,
    tireMat,
    caliperMat,
    valueDecalTex,
    valueDecalMat,
  );

  const attachSideAndRearValueBadges = (
    sideX: number,
    sideY: number,
    sideZ: number,
    badgeW: number,
    badgeH: number,
    rearPos?: { y: number; z: number; w: number; h: number },
  ) => {
    const sideGeo = new THREE.PlaneGeometry(badgeW, badgeH);
    const leftBadge = new THREE.Mesh(sideGeo, valueDecalMat);
    leftBadge.position.set(-sideX, sideY, sideZ);
    leftBadge.rotation.y = -Math.PI / 2;

    const rightBadge = new THREE.Mesh(sideGeo, valueDecalMat);
    rightBadge.position.set(sideX, sideY, sideZ);
    rightBadge.rotation.y = Math.PI / 2;

    group.add(leftBadge, rightBadge);
    disposables.push(sideGeo);

    if (rearPos) {
      const rearGeo = new THREE.PlaneGeometry(rearPos.w, rearPos.h);
      const rearBadge = new THREE.Mesh(rearGeo, valueDecalMat);
      rearBadge.position.set(0, rearPos.y, rearPos.z);
      group.add(rearBadge);
      disposables.push(rearGeo);
    }
  };

  const attachDriverTag = (topY: number) => {
    if (!driverAlias) return;
    const labelSprite = createDriverLabelSprite(
      driverAlias,
      spec.name,
      paintHex || spec.defaultPaint,
      activeValueMessage,
    );
    labelSprite.name = 'driverLabelSprite';
    labelSprite.position.set(0, topY, 0);
    group.add(labelSprite);
    disposables.push({
      dispose: () => {
        (labelSprite.material as THREE.SpriteMaterial).map?.dispose();
        labelSprite.material.dispose();
      },
    });
  };

  // ==========================================================================
  // SPECIAL VEHICLE A: BICYCLE WITH 3D AVATAR CYCLIST ("Bicicleta")
  // ==========================================================================
  if (spec.bodyStyle === 'bicycle') {
    const shadowGeo = new THREE.PlaneGeometry(0.85, 2.1);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);
    disposables.push(shadowGeo, shadowMat);

    const wheelR = 0.34;
    const tireTorusGeo = new THREE.TorusGeometry(wheelR, 0.028, 10, 28);
    tireTorusGeo.rotateY(Math.PI / 2);
    const rimTorusGeo = new THREE.TorusGeometry(wheelR - 0.024, 0.014, 8, 24);
    rimTorusGeo.rotateY(Math.PI / 2);
    const spokeGeo = new THREE.CylinderGeometry(0.004, 0.004, wheelR * 1.9, 6);
    disposables.push(tireTorusGeo, rimTorusGeo, spokeGeo);

    const buildBikeWheel = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(tireTorusGeo, tireMat));
      wg.add(new THREE.Mesh(rimTorusGeo, chromeMat));
      for (let s = 0; s < 6; s++) {
        const sp = new THREE.Mesh(spokeGeo, chromeMat);
        sp.rotation.x = (s * Math.PI) / 6;
        wg.add(sp);
      }
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(0, wheelR, -0.56);
    const frontWheel = buildBikeWheel();
    frontLeftPivot.add(frontWheel);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(0, wheelR, -0.56);

    const rearWheel = buildBikeWheel();
    rearWheel.position.set(0, wheelR, 0.56);
    group.add(frontLeftPivot, frontRightPivot, rearWheel);

    const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
    const addTube = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, mat: THREE.Material) => {
      const vA = new THREE.Vector3(ax, ay, az);
      const vB = new THREE.Vector3(bx, by, bz);
      const dist = vA.distanceTo(vB);
      const m = new THREE.Mesh(tubeGeo, mat);
      m.scale.set(1, dist, 1);
      m.position.copy(vA).add(vB).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vB.clone().sub(vA).normalize());
      group.add(m);
    };
    addTube(0, 0.34, 0.08, 0, 0.88, 0.22, paintMat);
    addTube(0, 0.84, 0.2, 0, 0.86, -0.42, paintMat);
    addTube(0, 0.34, 0.08, 0, 0.78, -0.44, paintMat);
    addTube(-0.05, 0.34, 0.56, 0, 0.34, 0.08, paintMat);
    addTube(0.05, 0.34, 0.56, 0, 0.34, 0.08, paintMat);
    addTube(-0.05, 0.34, 0.56, 0, 0.84, 0.2, paintMat);
    addTube(0.05, 0.34, 0.56, 0, 0.84, 0.2, paintMat);
    addTube(-0.05, 0.34, -0.56, 0, 0.86, -0.42, chromeMat);
    addTube(0.05, 0.34, -0.56, 0, 0.86, -0.42, chromeMat);
    disposables.push(tubeGeo);

    const saddleGeo = new THREE.BoxGeometry(0.16, 0.05, 0.28);
    const saddle = new THREE.Mesh(saddleGeo, carbonMat);
    saddle.position.set(0, 0.92, 0.24);
    const tailLedGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
    const tailLed = new THREE.Mesh(tailLedGeo, brakeLightMat);
    tailLed.position.set(0, 0.86, 0.38);
    group.add(saddle, tailLed);
    disposables.push(saddleGeo, tailLedGeo);

    // Value banner pennant on rear rack of bicycle
    attachSideAndRearValueBadges(0.09, 0.72, 0.42, 0.52, 0.14, {
      y: 0.74,
      z: 0.72,
      w: 0.48,
      h: 0.13,
    });

    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(0, 0.98, -0.45);
    const barGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.56, 10);
    barGeo.rotateZ(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeo, chromeMat);
    const lampGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12);
    lampGeo.rotateX(Math.PI / 2);
    const lampMesh = new THREE.Mesh(lampGeo, headlightMat);
    lampMesh.position.set(0, 0.02, -0.05);
    cockpitWheel.add(barMesh, lampMesh);
    group.add(cockpitWheel);
    disposables.push(barGeo, lampGeo);

    const crankGroup = new THREE.Group();
    crankGroup.position.set(0, 0.34, 0.08);
    const chainRingGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16);
    chainRingGeo.rotateZ(Math.PI / 2);
    crankGroup.add(new THREE.Mesh(chainRingGeo, chromeMat));
    group.add(crankGroup);

    const cyclistAvatar = createCoverArtDriverAvatar3D(
      avatarSeed,
      paintHex || spec.defaultPaint,
      spec.accentHex || '#facc15',
      'helmet',
      1.04,
      disposables,
    );
    cyclistAvatar.position.set(0, 0.98, 0.12);
    cyclistAvatar.rotation.x = -0.36;

    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const legGeo = new THREE.CapsuleGeometry(0.065, 0.42, 5, 8);
    legGeo.translate(0, -0.22, 0);
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.11, 0.92, 0.2);
    leftLeg.add(new THREE.Mesh(legGeo, shortsMat));

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.11, 0.92, 0.2);
    rightLeg.add(new THREE.Mesh(legGeo, shortsMat));

    group.add(cyclistAvatar, leftLeg, rightLeg);
    disposables.push(chainRingGeo, shortsMat, legGeo);

    attachDriverTag(2.08);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [frontWheel, rearWheel],
      cockpitWheel,
      brakeLights: brakeLightMat,
      cyclistLegs: { left: leftLeg, right: rightLeg, crank: crankGroup },
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // SPECIAL VEHICLE B1: ELECTRIC QUAD-TRIKE ("Cuatrimoto Eléctrica EcoQuad")
  // ==========================================================================
  if (spec.bodyStyle === 'electric_quad_trike') {
    const width = 1.48;
    const length = 2.42;
    const shadowGeo = new THREE.PlaneGeometry(width * 1.45, length * 1.32);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.64,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);

    // Lower EV battery skateboard deck + glowing cyan EV side strips
    const deckGeo = new THREE.BoxGeometry(width * 0.72, 0.22, length * 0.78);
    const deck = new THREE.Mesh(deckGeo, carbonMat);
    deck.position.set(0, 0.34, 0.04);

    const evStripGeo = new THREE.BoxGeometry(width * 0.76, 0.045, length * 0.66);
    const evStrip = new THREE.Mesh(evStripGeo, evCyanGlowMat);
    evStrip.position.set(0, 0.36, 0.04);

    // Sculpted Front Nose Hood + Sport Straddle Seat + Rear Cargo Rack
    const noseGeo = new THREE.BoxGeometry(width * 0.68, 0.36, 0.86);
    const nose = new THREE.Mesh(noseGeo, paintMat);
    nose.position.set(0, 0.62, -0.68);
    nose.rotation.x = 0.14;

    const rearCowlingGeo = new THREE.BoxGeometry(width * 0.76, 0.34, 0.88);
    const rearCowling = new THREE.Mesh(rearCowlingGeo, paintMat);
    rearCowling.position.set(0, 0.62, 0.62);

    const saddleGeo = new THREE.BoxGeometry(0.46, 0.22, 0.82);
    const saddle = new THREE.Mesh(saddleGeo, carbonMat);
    saddle.position.set(0, 0.78, 0.14);

    // Sporty Open-Air Roll-Cage Halo Bar (Triciclo/Cuatrimoto Eléctrica Urbana)
    const archGeo = new THREE.TorusGeometry(width * 0.36, 0.032, 10, 20, Math.PI);
    const rearHalo = new THREE.Mesh(archGeo, trimMat);
    rearHalo.position.set(0, 1.15, 0.56);

    const pillarGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.62, 8);
    const pilL = new THREE.Mesh(pillarGeo, carbonMat);
    pilL.position.set(-width * 0.36, 0.86, 0.56);
    const pilR = new THREE.Mesh(pillarGeo, carbonMat);
    pilR.position.set(width * 0.36, 0.86, 0.56);

    // Front LED Halo Lightbar + Rear Taillights
    const ledBarGeo = new THREE.BoxGeometry(0.76, 0.09, 0.08);
    const ledBar = new THREE.Mesh(ledBarGeo, headlightMat);
    ledBar.position.set(0, 0.68, -1.11);

    const tlGeo = new THREE.BoxGeometry(0.28, 0.09, 0.06);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-0.34, 0.66, 1.07);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(0.34, 0.66, 1.07);

    // 4 Rugged Electric Quad Wheels + Sculpted Fenders
    const wR = 0.31;
    const tGeo = new THREE.CylinderGeometry(wR, wR, 0.22, 18);
    tGeo.rotateZ(Math.PI / 2);
    const rGeo = new THREE.CylinderGeometry(wR * 0.58, wR * 0.58, 0.24, 12);
    rGeo.rotateZ(Math.PI / 2);
    const fenderGeo = new THREE.BoxGeometry(0.3, 0.06, 0.58);

    const buildQuadWheel = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(tGeo, tireMat));
      wg.add(new THREE.Mesh(rGeo, chromeMat));
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(-width * 0.46, wR, -0.78);
    const flW = buildQuadWheel();
    frontLeftPivot.add(flW);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(width * 0.46, wR, -0.78);
    const frW = buildQuadWheel();
    frontRightPivot.add(frW);

    const rlW = buildQuadWheel();
    rlW.position.set(-width * 0.46, wR, 0.78);
    const rrW = buildQuadWheel();
    rrW.position.set(width * 0.46, wR, 0.78);

    for (const fx of [-width * 0.46, width * 0.46]) {
      for (const fz of [-0.78, 0.78]) {
        const fnd = new THREE.Mesh(fenderGeo, paintMat);
        fnd.position.set(fx, wR * 2 + 0.06, fz);
        group.add(fnd);
      }
    }

    // Digital EV Handlebar + Open-Air 3D Driver Avatar
    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(0, 1.02, -0.44);
    const hBarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.66, 10);
    hBarGeo.rotateZ(Math.PI / 2);
    const screenGeo = new THREE.BoxGeometry(0.18, 0.1, 0.03);
    const screenMesh = new THREE.Mesh(screenGeo, evCyanGlowMat);
    screenMesh.position.set(0, 0.06, 0);
    cockpitWheel.add(new THREE.Mesh(hBarGeo, chromeMat), screenMesh);

    const quadAvatar = createCoverArtDriverAvatar3D(
      avatarSeed,
      spec.accentHex || '#0284c7',
      paintHex || spec.defaultPaint,
      'helmet',
      1.08,
      disposables,
    );
    quadAvatar.position.set(0, 0.82, -0.06);

    group.add(
      deck,
      evStrip,
      nose,
      rearCowling,
      saddle,
      rearHalo,
      pilL,
      pilR,
      ledBar,
      tlL,
      tlR,
      frontLeftPivot,
      frontRightPivot,
      rlW,
      rrW,
      cockpitWheel,
      quadAvatar,
    );

    attachSideAndRearValueBadges(width * 0.39, 0.62, 0.62, 0.78, 0.18, {
      y: 0.86,
      z: 1.08,
      w: 0.86,
      h: 0.2,
    });

    disposables.push(
      shadowGeo,
      shadowMat,
      deckGeo,
      evStripGeo,
      noseGeo,
      rearCowlingGeo,
      saddleGeo,
      archGeo,
      pillarGeo,
      ledBarGeo,
      tlGeo,
      tGeo,
      rGeo,
      fenderGeo,
      hBarGeo,
      screenGeo,
    );

    attachDriverTag(2.12);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [flW, frW, rlW, rrW],
      cockpitWheel,
      brakeLights: brakeLightMat,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // SPECIAL VEHICLE B2: ELECTRIC SOLAR TRICYCLE ("Triciclo Eléctrico Cabina Solar")
  // ==========================================================================
  if (spec.bodyStyle === 'electric_tricycle') {
    const width = 1.38;
    const length = 2.62;
    const shadowGeo = new THREE.PlaneGeometry(width * 1.44, length * 1.28);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.64,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);

    const floorGeo = new THREE.BoxGeometry(width * 0.9, 0.18, length * 0.76);
    const floor = new THREE.Mesh(floorGeo, carbonMat);
    floor.position.set(0, 0.28, 0.12);

    const rearPodGeo = new THREE.BoxGeometry(width, 0.66, 1.18);
    const rearPod = new THREE.Mesh(rearPodGeo, paintMat);
    rearPod.position.set(0, 0.62, 0.56);

    const frontNoseGeo = new THREE.CylinderGeometry(0.42, 0.56, 0.82, 16, 1, false, -Math.PI * 0.55, Math.PI * 1.1);
    frontNoseGeo.rotateY(Math.PI);
    const frontNose = new THREE.Mesh(frontNoseGeo, paintMat);
    frontNose.position.set(0, 0.64, -0.68);

    // Panoramic Transparent Windshield + Curved Solar Panel Canopy (Open Sides so 3D Avatar Shines!)
    const wsGeo = new THREE.PlaneGeometry(0.98, 0.66);
    const ws = new THREE.Mesh(wsGeo, glassMat);
    ws.position.set(0, 1.22, -0.78);
    ws.rotation.x = -0.24;

    const solarRoofGeo = new THREE.BoxGeometry(width * 0.94, 0.09, 1.88);
    const solarRoof = new THREE.Mesh(solarRoofGeo, paintMat);
    solarRoof.position.set(0, 1.66, 0.08);

    const solarPanelGeo = new THREE.PlaneGeometry(width * 0.82, 1.66);
    solarPanelGeo.rotateX(-Math.PI / 2);
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.78,
      roughness: 0.18,
    });
    const solarPanel = new THREE.Mesh(solarPanelGeo, solarPanelMat);
    solarPanel.position.set(0, 1.71, 0.08);

    const archPostGeo = new THREE.CylinderGeometry(0.028, 0.028, 1.02, 8);
    for (const px of [-width * 0.42, width * 0.42]) {
      for (const pz of [-0.68, 0.88]) {
        const post = new THREE.Mesh(archPostGeo, chromeMat);
        post.position.set(px, 1.15, pz);
        group.add(post);
      }
    }

    // Futuristic Cyan EV Halo & Headlight + Taillights
    const hlHaloGeo = new THREE.TorusGeometry(0.14, 0.028, 10, 20);
    const hlHalo = new THREE.Mesh(hlHaloGeo, evCyanGlowMat);
    hlHalo.position.set(0, 0.68, -1.14);

    const tlGeo = new THREE.BoxGeometry(0.32, 0.1, 0.06);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-0.42, 0.64, 1.16);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(0.42, 0.64, 1.16);

    // 3 EV Wheels (1 Steered Front Wheel + 2 Rear Wheels)
    const wR = 0.26;
    const tGeo = new THREE.CylinderGeometry(wR, wR, 0.17, 18);
    tGeo.rotateZ(Math.PI / 2);
    const rGeo = new THREE.CylinderGeometry(wR * 0.62, wR * 0.62, 0.19, 12);
    rGeo.rotateZ(Math.PI / 2);

    const buildTrikeWheel = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(tGeo, tireMat));
      wg.add(new THREE.Mesh(rGeo, chromeMat));
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(0, wR, -1.0);
    const fw = buildTrikeWheel();
    const fenderGeo = new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const fender = new THREE.Mesh(fenderGeo, trimMat);
    fender.position.set(0, 0.05, 0);
    frontLeftPivot.add(fw, fender);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(0, wR, -1.0);

    const rlW = buildTrikeWheel();
    rlW.position.set(-width * 0.48, wR, 0.78);
    const rrW = buildTrikeWheel();
    rrW.position.set(width * 0.48, wR, 0.78);

    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(0, 0.98, -0.54);
    const hBarGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.54, 10);
    hBarGeo.rotateZ(Math.PI / 2);
    cockpitWheel.add(new THREE.Mesh(hBarGeo, chromeMat));

    const trikeAvatar = createCoverArtDriverAvatar3D(
      avatarSeed + 3,
      '#f59e0b',
      paintHex || spec.defaultPaint,
      'visor',
      1.05,
      disposables,
    );
    trikeAvatar.position.set(0, 0.78, -0.18);

    group.add(
      floor,
      rearPod,
      frontNose,
      ws,
      solarRoof,
      solarPanel,
      hlHalo,
      tlL,
      tlR,
      frontLeftPivot,
      frontRightPivot,
      rlW,
      rrW,
      cockpitWheel,
      trikeAvatar,
    );

    attachSideAndRearValueBadges(width * 0.51, 0.64, 0.56, 0.86, 0.2, {
      y: 0.82,
      z: 1.16,
      w: 0.92,
      h: 0.22,
    });

    disposables.push(
      shadowGeo,
      shadowMat,
      floorGeo,
      rearPodGeo,
      frontNoseGeo,
      wsGeo,
      solarRoofGeo,
      solarPanelGeo,
      solarPanelMat,
      archPostGeo,
      hlHaloGeo,
      tlGeo,
      tGeo,
      rGeo,
      fenderGeo,
      hBarGeo,
    );

    attachDriverTag(2.16);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [fw, rlW, rrW],
      cockpitWheel,
      brakeLights: brakeLightMat,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // SPECIAL VEHICLE C: AUTHENTIC 3-WHEEL TUK-TUK ("Tuk Tuk") WITH 3D AVATAR
  // ==========================================================================
  if (spec.bodyStyle === 'tuk_tuk') {
    const width = 1.36;
    const length = 2.68;
    const shadowGeo = new THREE.PlaneGeometry(width * 1.45, length * 1.3);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);

    const floorGeo = new THREE.BoxGeometry(width, 0.16, length * 0.78);
    const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
    floorMesh.position.set(0, 0.26, 0.14);

    const rearTubGeo = new THREE.BoxGeometry(width, 0.72, 1.24);
    const rearTub = new THREE.Mesh(rearTubGeo, paintMat);
    rearTub.position.set(0, 0.62, 0.56);

    const frontCowlGeo = new THREE.CylinderGeometry(0.46, 0.58, 0.88, 16, 1, false, -Math.PI * 0.55, Math.PI * 1.1);
    frontCowlGeo.rotateY(Math.PI);
    const frontCowl = new THREE.Mesh(frontCowlGeo, paintMat);
    frontCowl.position.set(0, 0.66, -0.68);

    const wsGeo = new THREE.PlaneGeometry(0.96, 0.58);
    const ws = new THREE.Mesh(wsGeo, glassMat);
    ws.position.set(0, 1.26, -0.78);
    ws.rotation.x = -0.22;

    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.78 });
    const roofGeo = new THREE.BoxGeometry(width + 0.04, 0.14, 2.05);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.position.set(0, 1.66, 0.12);

    const yellowBandGeo = new THREE.BoxGeometry(width + 0.06, 0.06, 2.07);
    const yellowBand = new THREE.Mesh(yellowBandGeo, trimMat);
    yellowBand.position.set(0, 1.58, 0.12);

    const rearFlapGeo = new THREE.BoxGeometry(width + 0.02, 0.72, 0.08);
    const rearFlap = new THREE.Mesh(rearFlapGeo, canopyMat);
    rearFlap.position.set(0, 1.28, 1.12);

    const pillarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8);
    for (const px of [-width * 0.45, width * 0.45]) {
      for (const pz of [-0.72, 0.98]) {
        const pil = new THREE.Mesh(pillarGeo, carbonMat);
        pil.position.set(px, 1.15, pz);
        group.add(pil);
      }
    }
    const seatGeo = new THREE.BoxGeometry(width * 0.84, 0.36, 0.52);
    const seat = new THREE.Mesh(seatGeo, carbonMat);
    seat.position.set(0, 0.68, 0.54);

    const roundHlGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18);
    roundHlGeo.rotateX(Math.PI / 2);
    const mainHl = new THREE.Mesh(roundHlGeo, headlightMat);
    mainHl.position.set(0, 0.68, -1.16);

    const blkGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const blkL = new THREE.Mesh(blkGeo, amberBlinkerMat);
    blkL.position.set(-0.38, 0.74, -1.04);
    const blkR = new THREE.Mesh(blkGeo, amberBlinkerMat);
    blkR.position.set(0.38, 0.74, -1.04);

    const tlGeo = new THREE.BoxGeometry(0.24, 0.11, 0.06);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-0.44, 0.58, 1.19);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(0.44, 0.58, 1.19);

    const plateTex = createLicensePlateTexture('M-409TUK');
    const plateGeo = new THREE.PlaneGeometry(0.38, 0.15);
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
    const rearPlate = new THREE.Mesh(plateGeo, plateMat);
    rearPlate.position.set(0, 0.44, 1.195);

    group.add(
      shadowPlane,
      floorMesh,
      rearTub,
      frontCowl,
      ws,
      roof,
      yellowBand,
      rearFlap,
      seat,
      mainHl,
      blkL,
      blkR,
      tlL,
      tlR,
      rearPlate,
    );

    const wR = 0.24;
    const tGeo = new THREE.CylinderGeometry(wR, wR, 0.16, 18);
    tGeo.rotateZ(Math.PI / 2);
    const rGeo = new THREE.CylinderGeometry(wR * 0.62, wR * 0.62, 0.17, 12);
    rGeo.rotateZ(Math.PI / 2);

    const buildTukWheel = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(tGeo, tireMat));
      wg.add(new THREE.Mesh(rGeo, chromeMat));
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(0, wR, -1.02);
    const fw = buildTukWheel();
    const fenderGeo = new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const fender = new THREE.Mesh(fenderGeo, paintMat);
    fender.position.set(0, 0.05, 0);
    frontLeftPivot.add(fw, fender);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(0, wR, -1.02);

    const rlW = buildTukWheel();
    rlW.position.set(-width * 0.48, wR, 0.78);
    const rrW = buildTukWheel();
    rrW.position.set(width * 0.48, wR, 0.78);
    group.add(frontLeftPivot, frontRightPivot, rlW, rrW);

    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(0, 0.96, -0.58);
    const hBarGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.54, 10);
    hBarGeo.rotateZ(Math.PI / 2);
    cockpitWheel.add(new THREE.Mesh(hBarGeo, chromeMat));
    group.add(cockpitWheel);

    const tukAvatar = createCoverArtDriverAvatar3D(
      avatarSeed + 5,
      '#0284c7',
      '#facc15',
      'cap',
      1.04,
      disposables,
    );
    tukAvatar.position.set(0, 0.78, -0.22);

    const guardTubeGeo = new THREE.TorusGeometry(0.38, 0.024, 8, 18, Math.PI);
    guardTubeGeo.rotateX(Math.PI / 2);
    const frontGuard = new THREE.Mesh(guardTubeGeo, chromeMat);
    frontGuard.position.set(0, 0.34, -0.92);

    const rackGeo = new THREE.BoxGeometry(width * 0.86, 0.05, 1.35);
    const roofRack = new THREE.Mesh(rackGeo, chromeMat);
    roofRack.position.set(0, 1.75, 0.22);

    group.add(tukAvatar, frontGuard, roofRack);

    attachSideAndRearValueBadges(width * 0.51, 0.66, 0.56, 0.88, 0.2, {
      y: 1.24,
      z: 1.17,
      w: 0.98,
      h: 0.22,
    });

    disposables.push(
      shadowGeo,
      shadowMat,
      floorGeo,
      rearTubGeo,
      frontCowlGeo,
      wsGeo,
      canopyMat,
      roofGeo,
      yellowBandGeo,
      rearFlapGeo,
      pillarGeo,
      seatGeo,
      roundHlGeo,
      blkGeo,
      tlGeo,
      plateTex,
      plateGeo,
      plateMat,
      tGeo,
      rGeo,
      fenderGeo,
      hBarGeo,
      guardTubeGeo,
      rackGeo,
    );

    attachDriverTag(2.18);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [fw, rlW, rrW],
      cockpitWheel,
      brakeLights: brakeLightMat,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // SPECIAL VEHICLE D: HEAVY CARGO TRUCK ("Camión") WITH 3D AVATAR & VALUE BANNERS
  // ==========================================================================
  if (spec.bodyStyle === 'heavy_truck') {
    const width = 2.38;
    const length = 7.4;
    const shadowGeo = new THREE.PlaneGeometry(width * 1.38, length * 1.22);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);

    const frameGeo = new THREE.BoxGeometry(width * 0.72, 0.28, length * 0.92);
    const frame = new THREE.Mesh(frameGeo, carbonMat);
    frame.position.set(0, 0.48, 0.1);

    const tankGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.35, 16);
    tankGeo.rotateX(Math.PI / 2);
    const tankL = new THREE.Mesh(tankGeo, chromeMat);
    tankL.position.set(-width * 0.44, 0.5, -0.65);
    const tankR = new THREE.Mesh(tankGeo, chromeMat);
    tankR.position.set(width * 0.44, 0.5, -0.65);

    const hoodGeo = new THREE.BoxGeometry(width * 0.86, 0.95, 1.45);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(0, 1.05, -2.85);

    // Open-glass Tractor Cab so 3D Driver Avatar is clearly visible!
    const cabLowerGeo = new THREE.BoxGeometry(width * 0.94, 0.92, 1.65);
    const cabLower = new THREE.Mesh(cabLowerGeo, paintMat);
    cabLower.position.set(0, 1.1, -1.55);

    const cabUpperGlassGeo = new THREE.BoxGeometry(width * 0.9, 0.82, 1.56);
    const cabUpperGlass = new THREE.Mesh(cabUpperGlassGeo, glassMat);
    cabUpperGlass.position.set(0, 1.96, -1.55);

    const cabRoofGeo = new THREE.BoxGeometry(width * 0.94, 0.1, 1.65);
    const cabRoof = new THREE.Mesh(cabRoofGeo, paintMat);
    cabRoof.position.set(0, 2.38, -1.55);

    const spoilerGeo = new THREE.BoxGeometry(width * 0.92, 0.55, 1.15);
    const spoiler = new THREE.Mesh(spoilerGeo, trimMat);
    spoiler.position.set(0, 2.66, -1.45);
    spoiler.rotation.x = 0.25;

    const grilleGeo = new THREE.BoxGeometry(width * 0.68, 0.78, 0.1);
    const grille = new THREE.Mesh(grilleGeo, chromeMat);
    grille.position.set(0, 1.04, -3.59);

    const bumperGeo = new THREE.BoxGeometry(width + 0.04, 0.34, 0.22);
    const bumper = new THREE.Mesh(bumperGeo, chromeMat);
    bumper.position.set(0, 0.52, -3.62);

    const stackGeo = new THREE.CylinderGeometry(0.075, 0.075, 2.55, 12);
    const stackL = new THREE.Mesh(stackGeo, chromeMat);
    stackL.position.set(-width * 0.48, 1.95, -0.68);
    const stackR = new THREE.Mesh(stackGeo, chromeMat);
    stackR.position.set(width * 0.48, 1.95, -0.68);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42, metalness: 0.15 });
    const cargoGeo = new THREE.BoxGeometry(width, 2.48, 4.35);
    const cargo = new THREE.Mesh(cargoGeo, boxMat);
    cargo.position.set(0, 1.88, 1.55);

    const stripeGeo = new THREE.BoxGeometry(width + 0.03, 0.26, 4.37);
    const stripe = new THREE.Mesh(stripeGeo, trimMat);
    stripe.position.set(0, 1.15, 1.55);

    const hlGeo = new THREE.BoxGeometry(0.36, 0.18, 0.08);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(-width * 0.34, 0.88, -3.59);
    const hlR = new THREE.Mesh(hlGeo, headlightMat);
    hlR.position.set(width * 0.34, 0.88, -3.59);

    const roofDotGeo = new THREE.BoxGeometry(0.12, 0.07, 0.08);
    for (const rx of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const rl = new THREE.Mesh(roofDotGeo, amberBlinkerMat);
      rl.position.set(rx, 2.45, -2.38);
      group.add(rl);
    }

    const tlGeo = new THREE.BoxGeometry(0.46, 0.16, 0.08);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-width * 0.36, 0.62, 3.73);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(width * 0.36, 0.62, 3.73);

    const truckAvatar = createCoverArtDriverAvatar3D(
      avatarSeed + 9,
      '#eab308',
      '#1d4ed8',
      'cap',
      1.1,
      disposables,
    );
    truckAvatar.position.set(-width * 0.22, 1.44, -1.62);

    group.add(
      shadowPlane,
      frame,
      tankL,
      tankR,
      hood,
      cabLower,
      cabUpperGlass,
      cabRoof,
      spoiler,
      grille,
      bumper,
      stackL,
      stackR,
      cargo,
      stripe,
      hlL,
      hlR,
      tlL,
      tlR,
      truckAvatar,
    );

    attachSideAndRearValueBadges(width * 0.51, 2.02, 1.55, 2.95, 0.64, {
      y: 2.02,
      z: 3.74,
      w: 1.95,
      h: 0.45,
    });

    const wR = 0.48;
    const tGeo = new THREE.CylinderGeometry(wR, wR, 0.34, 22);
    tGeo.rotateZ(Math.PI / 2);
    const rGeo = new THREE.CylinderGeometry(wR * 0.62, wR * 0.62, 0.36, 14);
    rGeo.rotateZ(Math.PI / 2);

    const buildTruckWheel = (dual = false) => {
      const wg = new THREE.Group();
      if (dual) {
        const t1 = new THREE.Mesh(tGeo, tireMat);
        t1.position.x = -0.14;
        const t2 = new THREE.Mesh(tGeo, tireMat);
        t2.position.x = 0.14;
        const rm = new THREE.Mesh(rGeo, chromeMat);
        wg.add(t1, t2, rm);
      } else {
        wg.add(new THREE.Mesh(tGeo, tireMat));
        wg.add(new THREE.Mesh(rGeo, chromeMat));
      }
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(-width * 0.46, wR, -2.75);
    const flW = buildTruckWheel(false);
    frontLeftPivot.add(flW);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(width * 0.46, wR, -2.75);
    const frW = buildTruckWheel(false);
    frontRightPivot.add(frW);

    const rl1 = buildTruckWheel(true);
    rl1.position.set(-width * 0.44, wR, 1.55);
    const rr1 = buildTruckWheel(true);
    rr1.position.set(width * 0.44, wR, 1.55);
    const rl2 = buildTruckWheel(true);
    rl2.position.set(-width * 0.44, wR, 2.68);
    const rr2 = buildTruckWheel(true);
    rr2.position.set(width * 0.44, wR, 2.68);

    group.add(frontLeftPivot, frontRightPivot, rl1, rr1, rl2, rr2);

    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(-width * 0.22, 1.68, -1.94);
    cockpitWheel.rotation.x = -0.55;
    const swGeo = new THREE.TorusGeometry(0.22, 0.026, 10, 24);
    cockpitWheel.add(new THREE.Mesh(swGeo, carbonMat));
    group.add(cockpitWheel);

    const trkMirrorGeo = new THREE.BoxGeometry(0.12, 0.42, 0.18);
    const mudflapGeo = new THREE.BoxGeometry(0.52, 0.48, 0.04);
    for (const side of [-1, 1]) {
      const tm = new THREE.Mesh(trkMirrorGeo, chromeMat);
      tm.position.set(side * (width * 0.53), 1.85, -2.12);
      const mf = new THREE.Mesh(mudflapGeo, carbonMat);
      mf.position.set(side * (width * 0.42), 0.36, 3.55);
      group.add(tm, mf);
    }

    disposables.push(
      shadowGeo,
      shadowMat,
      frameGeo,
      tankGeo,
      hoodGeo,
      cabLowerGeo,
      cabUpperGlassGeo,
      cabRoofGeo,
      spoilerGeo,
      grilleGeo,
      bumperGeo,
      stackGeo,
      boxMat,
      cargoGeo,
      stripeGeo,
      hlGeo,
      roofDotGeo,
      tlGeo,
      tGeo,
      rGeo,
      swGeo,
      trkMirrorGeo,
      mudflapGeo,
    );

    attachDriverTag(3.62);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [flW, frW, rl1, rr1, rl2, rr2],
      cockpitWheel,
      brakeLights: brakeLightMat,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // SPECIAL VEHICLE E: 4X4 DOUBLE-CAB PICKUP TRUCK ("Pickup 4x4") WITH 3D AVATAR
  // ==========================================================================
  if (spec.bodyStyle === 'pickup_truck') {
    const width = 2.02;
    const length = 5.18;
    const shadowGeo = new THREE.PlaneGeometry(width * 1.42, length * 1.26);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);

    const chassisGeo = new THREE.BoxGeometry(width * 0.84, 0.24, length * 0.92);
    const chassis = new THREE.Mesh(chassisGeo, carbonMat);
    chassis.position.set(0, 0.42, 0);

    const stepGeo = new THREE.BoxGeometry(width + 0.08, 0.08, 1.95);
    const steps = new THREE.Mesh(stepGeo, carbonMat);
    steps.position.set(0, 0.36, -0.32);

    const frontCabLowerGeo = new THREE.BoxGeometry(width, 0.68, 3.05);
    const frontCabLower = new THREE.Mesh(frontCabLowerGeo, paintMat);
    frontCabLower.position.set(0, 0.82, -1.02);

    const cabUpperGeo = new THREE.BoxGeometry(width * 0.88, 0.64, 1.72);
    const cabUpper = new THREE.Mesh(cabUpperGeo, glassMat);
    cabUpper.position.set(0, 1.44, -0.45);

    const roofCapGeo = new THREE.BoxGeometry(width * 0.9, 0.08, 1.76);
    const roofCap = new THREE.Mesh(roofCapGeo, paintMat);
    roofCap.position.set(0, 1.78, -0.45);

    // 3D Avatar Driver clearly visible inside the Pickup cabin!
    const pickupAvatar = createCoverArtDriverAvatar3D(
      avatarSeed + 11,
      '#f97316',
      '#ffffff',
      'cap',
      0.96,
      disposables,
    );
    pickupAvatar.position.set(-width * 0.21, 1.06, -0.58);

    const bedFloorGeo = new THREE.BoxGeometry(width * 0.92, 0.14, 1.98);
    const bedFloor = new THREE.Mesh(bedFloorGeo, carbonMat);
    bedFloor.position.set(0, 0.56, 1.54);

    const bedWallGeo = new THREE.BoxGeometry(0.14, 0.66, 2.02);
    const bedWallL = new THREE.Mesh(bedWallGeo, paintMat);
    bedWallL.position.set(-width * 0.465, 0.84, 1.54);
    const bedWallR = new THREE.Mesh(bedWallGeo, paintMat);
    bedWallR.position.set(width * 0.465, 0.84, 1.54);

    const tailgateGeo = new THREE.BoxGeometry(width * 0.98, 0.64, 0.12);
    const tailgate = new THREE.Mesh(tailgateGeo, paintMat);
    tailgate.position.set(0, 0.84, 2.52);

    const rollArchGeo = new THREE.TorusGeometry(width * 0.4, 0.045, 10, 20, Math.PI);
    const rollArch = new THREE.Mesh(rollArchGeo, carbonMat);
    rollArch.position.set(0, 1.16, 0.62);

    const rollBraceGeo = new THREE.CylinderGeometry(0.038, 0.038, 1.15, 8);
    rollBraceGeo.rotateX(-0.68);
    const braceL = new THREE.Mesh(rollBraceGeo, carbonMat);
    braceL.position.set(-width * 0.36, 1.42, 1.05);
    const braceR = new THREE.Mesh(rollBraceGeo, carbonMat);
    braceR.position.set(width * 0.36, 1.42, 1.05);

    const spotLampGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12);
    spotLampGeo.rotateX(Math.PI / 2);
    for (const sx of [-0.34, 0, 0.34]) {
      const spot = new THREE.Mesh(spotLampGeo, headlightMat);
      spot.position.set(sx, 1.96, 0.58);
      group.add(spot);
    }

    const grilleGeo = new THREE.BoxGeometry(width * 0.66, 0.38, 0.1);
    const grille = new THREE.Mesh(grilleGeo, carbonMat);
    grille.position.set(0, 0.86, -2.56);

    const bullbarGeo = new THREE.BoxGeometry(width * 0.92, 0.24, 0.18);
    const bullbar = new THREE.Mesh(bullbarGeo, chromeMat);
    bullbar.position.set(0, 0.54, -2.62);

    const rearBumperGeo = new THREE.BoxGeometry(width + 0.02, 0.2, 0.18);
    const rearBumper = new THREE.Mesh(rearBumperGeo, chromeMat);
    rearBumper.position.set(0, 0.48, 2.58);

    const hlGeo = new THREE.BoxGeometry(0.32, 0.16, 0.08);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(-width * 0.36, 0.92, -2.56);
    const hlR = new THREE.Mesh(hlGeo, headlightMat);
    hlR.position.set(width * 0.36, 0.92, -2.56);

    const tlGeo = new THREE.BoxGeometry(0.14, 0.38, 0.08);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-width * 0.45, 0.88, 2.57);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(width * 0.45, 0.88, 2.57);

    const wR = 0.42;
    const tGeo = new THREE.CylinderGeometry(wR, wR, 0.29, 20);
    tGeo.rotateZ(Math.PI / 2);
    const rGeo = new THREE.CylinderGeometry(wR * 0.6, wR * 0.6, 0.31, 12);
    rGeo.rotateZ(Math.PI / 2);

    const buildPickupWheel = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(tGeo, tireMat));
      wg.add(new THREE.Mesh(rGeo, chromeMat));
      return wg;
    };

    const frontLeftPivot = new THREE.Group();
    frontLeftPivot.position.set(-width * 0.47, wR, -1.68);
    const flW = buildPickupWheel();
    frontLeftPivot.add(flW);

    const frontRightPivot = new THREE.Group();
    frontRightPivot.position.set(width * 0.47, wR, -1.68);
    const frW = buildPickupWheel();
    frontRightPivot.add(frW);

    const rlW = buildPickupWheel();
    rlW.position.set(-width * 0.47, wR, 1.56);
    const rrW = buildPickupWheel();
    rrW.position.set(width * 0.47, wR, 1.56);

    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(-width * 0.21, 1.24, -0.92);
    cockpitWheel.rotation.x = -0.35;
    const swGeo = new THREE.TorusGeometry(0.18, 0.022, 10, 22);
    cockpitWheel.add(new THREE.Mesh(swGeo, carbonMat));

    group.add(
      chassis,
      steps,
      frontCabLower,
      cabUpper,
      roofCap,
      pickupAvatar,
      bedFloor,
      bedWallL,
      bedWallR,
      tailgate,
      rollArch,
      braceL,
      braceR,
      grille,
      bullbar,
      rearBumper,
      hlL,
      hlR,
      tlL,
      tlR,
      frontLeftPivot,
      frontRightPivot,
      rlW,
      rrW,
      cockpitWheel,
    );

    attachSideAndRearValueBadges(width * 0.54, 0.86, 1.52, 1.48, 0.32, {
      y: 0.86,
      z: 2.59,
      w: 1.28,
      h: 0.28,
    });

    disposables.push(
      shadowGeo,
      shadowMat,
      chassisGeo,
      stepGeo,
      frontCabLowerGeo,
      cabUpperGeo,
      roofCapGeo,
      bedFloorGeo,
      bedWallGeo,
      tailgateGeo,
      rollArchGeo,
      rollBraceGeo,
      spotLampGeo,
      grilleGeo,
      bullbarGeo,
      rearBumperGeo,
      hlGeo,
      tlGeo,
      tGeo,
      rGeo,
      swGeo,
    );

    attachDriverTag(2.42);

    return {
      group,
      frontLeftPivot,
      frontRightPivot,
      wheelMeshes: [flW, frW, rlW, rrW],
      cockpitWheel,
      brakeLights: brakeLightMat,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // ==========================================================================
  // HIGH-DETAIL REALISTIC AUTOMOBILES WITH 3D AVATARS & VALUE DECALS
  // ==========================================================================
  let width = 1.92;
  let length = 4.48;
  let chassisH = 0.54;
  let cabinH = 0.52;
  let cabinLen = 2.08;
  let cabinOffsetZ = 0.12;

  if (spec.bodyStyle === 'compact_hatch') {
    width = 1.76;
    length = 3.88;
    chassisH = 0.54;
    cabinH = 0.58;
    cabinLen = 2.26;
    cabinOffsetZ = 0.22;
  } else if (spec.bodyStyle === 'supercar_wedge') {
    width = 2.08;
    length = 4.56;
    chassisH = 0.42;
    cabinH = 0.42;
    cabinLen = 1.85;
    cabinOffsetZ = -0.05;
  } else if (spec.bodyStyle === 'sport_coupe' || spec.bodyStyle === 'gt_boxer') {
    width = 1.94;
    length = 4.44;
    chassisH = 0.48;
    cabinH = 0.48;
    cabinLen = 1.84;
    cabinOffsetZ = 0.24;
  } else if (spec.bodyStyle === 'gtr_race') {
    width = 1.92;
    length = 4.56;
    chassisH = 0.52;
    cabinH = 0.5;
    cabinLen = 1.98;
    cabinOffsetZ = 0.12;
  } else if (spec.bodyStyle === 'ev_fastback') {
    width = 1.98;
    length = 4.82;
    chassisH = 0.5;
    cabinH = 0.51;
    cabinLen = 2.58;
    cabinOffsetZ = 0.08;
  }

  const halfL = length / 2;

  const shadowGeo = new THREE.PlaneGeometry(width * 1.46, length * 1.32);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.68,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);
  disposables.push(shadowGeo, shadowMat);

  const sideShape = new THREE.Shape();
  if (spec.bodyStyle === 'supercar_wedge') {
    sideShape.moveTo(-halfL, 0.2);
    sideShape.lineTo(-halfL + 0.42, 0.44);
    sideShape.lineTo(-0.3, 0.62);
    sideShape.lineTo(0.45, 0.66);
    sideShape.lineTo(halfL - 0.12, 0.69);
    sideShape.lineTo(halfL, 0.3);
    sideShape.lineTo(-halfL, 0.2);
  } else {
    sideShape.moveTo(-halfL, 0.22);
    sideShape.lineTo(-halfL + 0.24, 0.24 + chassisH * 0.8);
    sideShape.lineTo(-halfL + 1.18, 0.28 + chassisH);
    sideShape.lineTo(halfL - 0.3, 0.29 + chassisH);
    sideShape.lineTo(halfL, 0.26 + chassisH * 0.74);
    sideShape.lineTo(halfL, 0.22);
    sideShape.lineTo(-halfL, 0.22);
  }

  const hullGeo = new THREE.ExtrudeGeometry(sideShape, {
    depth: width - 0.12,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.065,
    bevelThickness: 0.065,
  });
  hullGeo.rotateY(-Math.PI / 2);
  hullGeo.translate((width - 0.12) / 2, 0, 0);
  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.castShadow = !isSoftwareGl;
  hullMesh.receiveShadow = true;
  group.add(hullMesh);
  disposables.push(hullGeo);

  const skirtGeo = new THREE.BoxGeometry(width + 0.04, 0.1, length + 0.08);
  const skirtMesh = new THREE.Mesh(skirtGeo, carbonMat);
  skirtMesh.position.set(0, 0.22, 0);
  group.add(skirtMesh);
  disposables.push(skirtGeo);

  const flareGeo = new THREE.TorusGeometry(0.37, 0.045, 8, 16, Math.PI);
  flareGeo.rotateY(Math.PI / 2);
  const frontZ = -length * 0.31;
  const rearZ = length * 0.31;
  for (const fx of [-width * 0.49, width * 0.49]) {
    for (const fz of [frontZ, rearZ]) {
      const fl = new THREE.Mesh(flareGeo, paintMat);
      fl.position.set(fx, 0.34, fz);
      group.add(fl);
    }
  }
  disposables.push(flareGeo);

  const roofMat =
    spec.bodyStyle === 'sport_sedan' || spec.bodyStyle === 'ev_fastback' ? carbonMat : paintMat;

  const cabShape = new THREE.Shape();
  const cHalf = cabinLen * 0.5;
  const baseCabY = 0.26 + chassisH;
  cabShape.moveTo(-cHalf, baseCabY);
  cabShape.lineTo(-cHalf + cabinLen * 0.28, baseCabY + cabinH);
  cabShape.lineTo(cHalf - cabinLen * 0.22, baseCabY + cabinH);
  cabShape.lineTo(cHalf, baseCabY);
  cabShape.lineTo(-cHalf, baseCabY);

  const cabinGlassGeo = new THREE.ExtrudeGeometry(cabShape, {
    depth: width * 0.78,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  cabinGlassGeo.rotateY(-Math.PI / 2);
  cabinGlassGeo.translate((width * 0.78) / 2, 0, cabinOffsetZ);
  const cabinGlass = new THREE.Mesh(cabinGlassGeo, glassMat);
  cabinGlass.renderOrder = 2;
  group.add(cabinGlass);

  const roofCapGeo = new THREE.BoxGeometry(width * 0.75, 0.055, cabinLen * 0.52);
  const roofCap = new THREE.Mesh(roofCapGeo, roofMat);
  roofCap.position.set(0, baseCabY + cabinH + 0.02, cabinOffsetZ + cabinLen * 0.03);
  group.add(roofCap);

  // Sport Bucket Seats + Full Cover-Art 3D Avatar Driver visibly steering inside the car!
  const seatBackGeo = new THREE.BoxGeometry(0.36, 0.44, 0.1);
  const seatL = new THREE.Mesh(seatBackGeo, carbonMat);
  seatL.position.set(-width * 0.19, baseCabY + 0.14, cabinOffsetZ + 0.22);
  seatL.rotation.x = 0.18;
  const seatR = new THREE.Mesh(seatBackGeo, carbonMat);
  seatR.position.set(width * 0.19, baseCabY + 0.14, cabinOffsetZ + 0.22);
  seatR.rotation.x = 0.18;

  const isRaceHelmet =
    spec.bodyStyle === 'gtr_race' || spec.bodyStyle === 'supercar_wedge' ? 'helmet' : 'cap';
  const carAvatar = createCoverArtDriverAvatar3D(
    avatarSeed + 17,
    spec.accentHex || '#f59e0b',
    paintHex || spec.defaultPaint,
    isRaceHelmet,
    spec.bodyStyle === 'supercar_wedge' ? 0.68 : 0.76,
    disposables,
  );
  carAvatar.position.set(-width * 0.19, baseCabY - 0.1, cabinOffsetZ + 0.08);
  group.add(seatL, seatR, carAvatar);

  const mirrorCapGeo = new THREE.BoxGeometry(0.17, 0.095, 0.13);
  const mirrorStalkGeo = new THREE.BoxGeometry(0.08, 0.038, 0.05);
  const handleGeo = new THREE.BoxGeometry(0.035, 0.04, 0.18);
  const wiperGeo = new THREE.BoxGeometry(0.42, 0.018, 0.025);
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(mirrorStalkGeo, carbonMat);
    stalk.position.set(side * (width * 0.44), baseCabY + 0.08, cabinOffsetZ - cabinLen * 0.3);
    const cap = new THREE.Mesh(mirrorCapGeo, paintMat);
    cap.position.set(side * (width * 0.51), baseCabY + 0.11, cabinOffsetZ - cabinLen * 0.3);
    const handle = new THREE.Mesh(handleGeo, chromeMat);
    handle.position.set(side * (width * 0.505), baseCabY - 0.08, cabinOffsetZ + 0.08);
    group.add(stalk, cap, handle);
  }
  const wiperL = new THREE.Mesh(wiperGeo, carbonMat);
  wiperL.position.set(-0.22, baseCabY + 0.05, cabinOffsetZ - cHalf - 0.02);
  wiperL.rotation.z = 0.12;
  const wiperR = new THREE.Mesh(wiperGeo, carbonMat);
  wiperR.position.set(0.22, baseCabY + 0.05, cabinOffsetZ - cHalf - 0.02);
  wiperR.rotation.z = 0.12;
  group.add(wiperL, wiperR);

  disposables.push(
    cabinGlassGeo,
    roofCapGeo,
    seatBackGeo,
    mirrorCapGeo,
    mirrorStalkGeo,
    handleGeo,
    wiperGeo,
  );

  // Door Number Decal (#12 GTR) + Value Message Badges on Sides & Rear!
  if (spec.liveryNumber) {
    const doorTex = createNumberDoorTexture(spec.liveryNumber, paintHex || spec.defaultPaint);
    const decalGeo = new THREE.PlaneGeometry(0.95, 0.42);
    const decalMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const leftDoor = new THREE.Mesh(decalGeo, decalMat);
    leftDoor.position.set(-width / 2 - 0.015, 0.56, -0.32);
    leftDoor.rotation.y = -Math.PI / 2;
    const rightDoor = new THREE.Mesh(decalGeo, decalMat);
    rightDoor.position.set(width / 2 + 0.015, 0.56, -0.32);
    rightDoor.rotation.y = Math.PI / 2;
    group.add(leftDoor, rightDoor);
    disposables.push(doorTex, decalGeo, decalMat);
  }

  attachSideAndRearValueBadges(
    width / 2 + 0.016,
    0.52,
    spec.liveryNumber ? 0.56 : 0.06,
    1.18,
    0.26,
  );

  const grilleGeo = new THREE.BoxGeometry(width * 0.56, 0.21, 0.08);
  const grille = new THREE.Mesh(grilleGeo, spec.bodyStyle === 'ev_fastback' ? paintMat : carbonMat);
  grille.position.set(0, 0.41, -halfL - 0.02);
  group.add(grille);
  disposables.push(grilleGeo);

  if (spec.bodyStyle === 'sport_sedan') {
    const vBarGeo = new THREE.BoxGeometry(width * 0.42, 0.05, 0.09);
    const vBar = new THREE.Mesh(vBarGeo, chromeMat);
    vBar.position.set(0, 0.35, -halfL - 0.03);
    group.add(vBar);
    disposables.push(vBarGeo);
  }

  const hlGeo = new THREE.BoxGeometry(0.36, 0.1, 0.08);
  const drlStripGeo = new THREE.BoxGeometry(0.38, 0.026, 0.09);
  const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
  hlLeft.position.set(-width * 0.34, 0.51, -halfL - 0.015);
  const hlRight = new THREE.Mesh(hlGeo, headlightMat);
  hlRight.position.set(width * 0.34, 0.51, -halfL - 0.015);
  const drlL = new THREE.Mesh(drlStripGeo, headlightMat);
  drlL.position.set(-width * 0.34, 0.565, -halfL - 0.02);
  const drlR = new THREE.Mesh(drlStripGeo, headlightMat);
  drlR.position.set(width * 0.34, 0.565, -halfL - 0.02);
  group.add(hlLeft, hlRight, drlL, drlR);

  const plateTex = createLicensePlateTexture(`P-${spec.horsepower}GT`);
  const plateGeo = new THREE.PlaneGeometry(0.42, 0.15);
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(0, 0.3, -halfL - 0.065);
  frontPlate.rotation.y = Math.PI;
  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(0, 0.42, halfL + 0.065);
  group.add(frontPlate, rearPlate);
  disposables.push(hlGeo, drlStripGeo, plateTex, plateGeo, plateMat);

  if (spec.bodyStyle === 'gtr_race') {
    const roundTlGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16);
    roundTlGeo.rotateX(Math.PI / 2);
    for (const tx of [-0.68, -0.47, 0.47, 0.68]) {
      const tl = new THREE.Mesh(roundTlGeo, brakeLightMat);
      tl.position.set(tx, 0.58, halfL + 0.025);
      group.add(tl);
    }
    disposables.push(roundTlGeo);
  } else {
    const tlGeo = new THREE.BoxGeometry(0.44, 0.1, 0.07);
    const tlLeft = new THREE.Mesh(tlGeo, brakeLightMat);
    tlLeft.position.set(-width * 0.32, 0.56, halfL + 0.015);
    const tlRight = new THREE.Mesh(tlGeo, brakeLightMat);
    tlRight.position.set(width * 0.32, 0.56, halfL + 0.015);
    group.add(tlLeft, tlRight);
    disposables.push(tlGeo);
  }

  if (spec.engineTone !== 'ev') {
    const exhGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.18, 12);
    exhGeo.rotateX(Math.PI / 2);
    const exhL = new THREE.Mesh(exhGeo, chromeMat);
    exhL.position.set(-width * 0.28, 0.25, halfL + 0.04);
    const exhR = new THREE.Mesh(exhGeo, chromeMat);
    exhR.position.set(width * 0.28, 0.25, halfL + 0.04);
    group.add(exhL, exhR);
    disposables.push(exhGeo);
  }

  if (
    spec.bodyStyle === 'sport_coupe' ||
    spec.bodyStyle === 'gtr_race' ||
    spec.bodyStyle === 'supercar_wedge' ||
    spec.bodyStyle === 'gt_boxer'
  ) {
    const wingBladeGeo = new THREE.BoxGeometry(width * 0.88, 0.05, 0.26);
    const wingPillarGeo = new THREE.BoxGeometry(0.06, 0.22, 0.18);
    const wingY = 0.28 + chassisH + 0.22;
    const wingBlade = new THREE.Mesh(
      wingBladeGeo,
      spec.bodyStyle === 'gtr_race' ? paintMat : carbonMat,
    );
    wingBlade.position.set(0, wingY, halfL - 0.16);
    const pL = new THREE.Mesh(wingPillarGeo, carbonMat);
    pL.position.set(-width * 0.28, wingY - 0.11, halfL - 0.16);
    const pR = new THREE.Mesh(wingPillarGeo, carbonMat);
    pR.position.set(width * 0.28, wingY - 0.11, halfL - 0.16);
    group.add(wingBlade, pL, pR);
    disposables.push(wingBladeGeo, wingPillarGeo);
  }

  const wheelRadius = 0.34;
  const wheelWidth = 0.27;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 22);
  tireGeo.rotateZ(Math.PI / 2);
  const rimOuterGeo = new THREE.CylinderGeometry(
    wheelRadius * 0.72,
    wheelRadius * 0.72,
    wheelWidth + 0.015,
    16,
  );
  rimOuterGeo.rotateZ(Math.PI / 2);
  const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.54, wheelRadius * 0.54, 0.06, 14);
  rotorGeo.rotateZ(Math.PI / 2);
  const spokeBarGeo = new THREE.BoxGeometry(wheelWidth + 0.025, wheelRadius * 1.32, 0.045);
  const calGeo = new THREE.BoxGeometry(0.1, 0.16, 0.12);
  disposables.push(tireGeo, rimOuterGeo, rotorGeo, spokeBarGeo, calGeo);

  function buildWheelAssembly(sideSign: number): THREE.Group {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim = new THREE.Mesh(rimOuterGeo, carbonMat);
    const rotor = new THREE.Mesh(rotorGeo, chromeMat);
    const cal = new THREE.Mesh(calGeo, caliperMat);
    cal.position.set(sideSign * 0.06, 0.08, -0.11);
    wg.add(tire, rim, rotor, cal);
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(spokeBarGeo, chromeMat);
      sp.rotation.x = (s * Math.PI) / 5;
      wg.add(sp);
    }
    return wg;
  }

  const wheelX = width * 0.48;
  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-wheelX, wheelRadius, frontZ);
  const flWheel = buildWheelAssembly(-1);
  frontLeftPivot.add(flWheel);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(wheelX, wheelRadius, frontZ);
  const frWheel = buildWheelAssembly(1);
  frontRightPivot.add(frWheel);

  const rlWheel = buildWheelAssembly(-1);
  rlWheel.position.set(-wheelX, wheelRadius, rearZ);
  const rrWheel = buildWheelAssembly(1);
  rrWheel.position.set(wheelX, wheelRadius, rearZ);

  group.add(frontLeftPivot, frontRightPivot, rlWheel, rrWheel);

  const dashGroup = new THREE.Group();
  dashGroup.position.set(0, 0.28 + chassisH + 0.12, cabinOffsetZ - cabinLen * 0.26);
  const dashBoardGeo = new THREE.BoxGeometry(width * 0.74, 0.18, 0.38);
  const dashBoard = new THREE.Mesh(dashBoardGeo, carbonMat);
  dashGroup.add(dashBoard);
  disposables.push(dashBoardGeo);

  const cockpitWheel = new THREE.Group();
  cockpitWheel.position.set(-width * 0.19, 0.13, 0.22);
  cockpitWheel.rotation.x = -0.32;
  const rimTorusGeo = new THREE.TorusGeometry(0.17, 0.024, 10, 24);
  const spokeGeo = new THREE.BoxGeometry(0.3, 0.03, 0.02);
  const centerMarkerGeo = new THREE.BoxGeometry(0.03, 0.05, 0.03);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const wheelRimMesh = new THREE.Mesh(rimTorusGeo, carbonMat);
  const wheelSpokeMesh = new THREE.Mesh(spokeGeo, chromeMat);
  const topMarker = new THREE.Mesh(centerMarkerGeo, markerMat);
  topMarker.position.set(0, 0.17, 0);
  cockpitWheel.add(wheelRimMesh, wheelSpokeMesh, topMarker);
  dashGroup.add(cockpitWheel);
  group.add(dashGroup);
  disposables.push(rimTorusGeo, spokeGeo, centerMarkerGeo, markerMat);

  attachDriverTag(2.36);

  return {
    group,
    frontLeftPivot,
    frontRightPivot,
    wheelMeshes: [flWheel, frWheel, rlWheel, rrWheel],
    cockpitWheel,
    brakeLights: brakeLightMat,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

// ============================================================================
// 3D WALKING PEDESTRIANS WITH REAL PHOTOGRAPHIC PEOPLE TEXTURES
// ============================================================================
export function createWalkingPedestrian3D(
  pedestriansTex: THREE.Texture,
  contactShadowTex: THREE.CanvasTexture,
  variantIdx: number,
): WalkingPedestrian3D {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const slice = PEDESTRIAN_UV_SLICES[variantIdx % PEDESTRIAN_UV_SLICES.length];

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const pantsColors = [0x1e293b, 0x1d4ed8, 0x334155, 0x44403c];
  const shirtColors = [0xeab308, 0x16a34a, 0xdc2626, 0x0284c7];
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColors[variantIdx % pantsColors.length],
    roughness: 0.82,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColors[variantIdx % shirtColors.length],
    roughness: 0.72,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd69a72, roughness: 0.65 });

  // Articulated 3D Legs & 3D Shoes
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.5, 5, 8);
  legGeo.translate(0, -0.27, 0);
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.09, 0.25);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.78, 0);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.66, -0.04);
  leftLegPivot.add(new THREE.Mesh(legGeo, pantsMat), leftShoe);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.78, 0);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.66, -0.04);
  rightLegPivot.add(new THREE.Mesh(legGeo, pantsMat), rightShoe);

  // Articulated 3D Arms
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.42, 5, 8);
  armGeo.translate(0, -0.22, 0);
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.27, 1.36, 0);
  leftArmPivot.add(new THREE.Mesh(armGeo, skinMat));

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.27, 1.36, 0);
  rightArmPivot.add(new THREE.Mesh(armGeo, skinMat));

  // 3D Core Torso + Head + Real Photographic Person Portrait/Body Planes (Front & Back)
  const coreGeo = new THREE.BoxGeometry(0.38, 0.64, 0.22);
  const core = new THREE.Mesh(coreGeo, shirtMat);
  core.position.set(0, 1.1, 0);

  const headGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.58, 0);

  const photoPlaneGeo = new THREE.PlaneGeometry(0.74, 1.66);
  applyHorizontalUvSlice(photoPlaneGeo, slice.uMin, slice.uMax, 0.04, 0.96);
  const photoMat = new THREE.MeshStandardMaterial({
    map: pedestriansTex,
    roughness: 0.42,
    metalness: 0.02,
  });
  const photoFront = new THREE.Mesh(photoPlaneGeo, photoMat);
  photoFront.position.set(0, 0.98, -0.13);
  photoFront.rotation.y = Math.PI;

  const photoBack = new THREE.Mesh(photoPlaneGeo, photoMat);
  photoBack.position.set(0, 0.98, 0.13);

  group.add(
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    core,
    head,
    photoFront,
    photoBack,
  );

  disposables.push(
    shadowGeo,
    shadowMat,
    pantsMat,
    shirtMat,
    skinMat,
    shoeGeo,
    shoeMat,
    legGeo,
    armGeo,
    coreGeo,
    headGeo,
    photoPlaneGeo,
    photoMat,
  );

  return {
    group,
    updateWalk: (phase: number) => {
      const swing = Math.sin(phase) * 0.5;
      leftLegPivot.rotation.x = swing;
      rightLegPivot.rotation.x = -swing;
      leftArmPivot.rotation.x = -swing * 0.78;
      rightArmPivot.rotation.x = swing * 0.78;
      group.position.y = Math.abs(Math.cos(phase)) * 0.035;
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

function createSubtleKidShirtTexture(
  shirtHex: string,
  includeSubtleLabel: boolean,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 192;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = shirtHex;
  ctx.fillRect(0, 0, 192, 192);

  // Sporty collar trim
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(58, 0, 76, 14);

  if (includeSubtleLabel) {
    // Very subtle, small polo chest print so it looks like a discreet guest team jersey
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = 'bold 17px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('San Lolek', 96, 74);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSubtleHandheldPlacardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 100, 14);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 24px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('¡Vamos Campeón!', 128, 48);

  ctx.fillStyle = '#0284c7';
  ctx.font = '600 18px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Apoyo · San Lolek', 128, 80);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 3D CHECKPOINT FINISH META STAGE + VIRTUAL PODIUM:
// - TWO EDUCATOR SISTERS (WHITE & BLUE HABIT, SUN VISORS, SUNGLASSES ON ONE)
// - CHEERING KIDS WITH SUBTLE SHIRT PRINT / SMALL HANDHELD CHEERING SIGN
// ============================================================================
export function createCheckpointMetaStage3D(
  grandTrophyTex: THREE.Texture,
): CheckpointMetaStage3D {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Glowing ground ring in center of street so player knows exact target
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const groundRingGeo = new THREE.RingGeometry(3.8, 4.9, 32);
  groundRingGeo.rotateX(-Math.PI / 2);
  const groundRing = new THREE.Mesh(groundRingGeo, ringMat);
  groundRing.position.y = 0.09;

  // Festive Finish Archway Spanning Cleanly Over the Street (13.6m wide span)
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.34, 6.8, 12);
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const silverMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.16,
    clearcoat: 0.85,
  });
  const diamondMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    emissive: new THREE.Color(0xbae6fd),
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.02,
    clearcoat: 1.0,
    ior: 2.4,
  });
  const skyArchMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
  const velvetRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.62 });

  const archLeft = new THREE.Mesh(pillarGeo, goldMat);
  archLeft.position.set(-6.8, 3.4, 0);
  const archRight = new THREE.Mesh(pillarGeo, goldMat);
  archRight.position.set(6.8, 3.4, 0);

  const crossBeamGeo = new THREE.BoxGeometry(14.4, 0.55, 0.55);
  const crossBeam = new THREE.Mesh(crossBeamGeo, skyArchMat);
  crossBeam.position.set(0, 6.7, 0);

  group.add(groundRing, archLeft, archRight, crossBeam);

  // Side Ceremony Podium Stage at x = +5.55m (safely off the asphalt lane)
  const podiumGroup = new THREE.Group();
  podiumGroup.position.set(5.55, 0, 0);

  const carpetGeo = new THREE.BoxGeometry(3.5, 0.24, 3.0);
  const carpet = new THREE.Mesh(carpetGeo, skyArchMat);
  carpet.position.y = 0.12;
  podiumGroup.add(carpet);

  // Anonymous 3D Sporting Steward Figure (shown on intermediate metas 1..N-1)
  const childGroup = new THREE.Group();
  childGroup.position.set(-0.62, 0.24, 0);
  const stewardSkinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.6 });
  const childBodyGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.22, 10);
  const childBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
  const childBody = new THREE.Mesh(childBodyGeo, childBodyMat);
  childBody.position.set(0, 0.61, 0);

  const stewardHeadGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const stewardHead = new THREE.Mesh(stewardHeadGeo, stewardSkinMat);
  stewardHead.position.set(0, 1.42, 0);

  const capVisorGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12);
  const capVisor = new THREE.Mesh(capVisorGeo, goldMat);
  capVisor.position.set(0, 1.56, 0);

  const wavingArmPivot = new THREE.Group();
  wavingArmPivot.position.set(0.32, 1.12, 0);
  const waveArmGeo = new THREE.CapsuleGeometry(0.055, 0.42, 5, 8);
  waveArmGeo.translate(0, 0.22, 0);
  wavingArmPivot.add(new THREE.Mesh(waveArmGeo, stewardSkinMat));
  childGroup.add(childBody, stewardHead, capVisor, wavingArmPivot);
  podiumGroup.add(childGroup);

  // =========================================================================
  // GRAND FINALE PRESENTERS: TWO FAIR-SKINNED SPANISH CAUCASIAN EDUCATOR SISTERS
  // - White habit with sky/royal-blue scapular & veil ("hábito blanco con azul")
  // - BOTH wearing sporty sun visors ("visera para el sol")
  // - ONE Sister (left) wearing stylish sunglasses ("lentes de sol")
  // =========================================================================
  const madresGroup = new THREE.Group();
  madresGroup.position.set(-0.62, 0.24, 0);

  const caucasianSkinMat = new THREE.MeshStandardMaterial({
    color: 0xf9dfd0, // Fair Spanish Caucasian tone
    roughness: 0.56,
  });
  const habitWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.46 });
  const veilBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.44 });
  const veilLightBlueMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.42 });
  const beltBrownMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 });
  const sunglassesDarkMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.14,
    clearcoat: 1.0,
  });

  const sisterTunicGeo = new THREE.CylinderGeometry(0.22, 0.33, 1.38, 14);
  const sisterScapularGeo = new THREE.BoxGeometry(0.26, 1.24, 0.045);
  const sisterBeltGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.055, 14);
  const sisterWimpleGeo = new THREE.CylinderGeometry(0.21, 0.27, 0.22, 12);
  const sisterHeadGeo = new THREE.SphereGeometry(0.175, 14, 12);
  const sisterCoifBandGeo = new THREE.CylinderGeometry(0.182, 0.182, 0.08, 14);
  const sisterVeilTopGeo = new THREE.SphereGeometry(
    0.195,
    14,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.62,
  );
  const sisterVeilBackGeo = new THREE.BoxGeometry(0.42, 0.78, 0.12);
  const sunVisorBrimGeo = new THREE.CylinderGeometry(
    0.24,
    0.26,
    0.032,
    16,
    1,
    false,
    -Math.PI * 0.45,
    Math.PI * 0.9,
  );
  const sunGlassLensGeo = new THREE.BoxGeometry(0.082, 0.056, 0.025);
  const sunGlassBridgeGeo = new THREE.BoxGeometry(0.04, 0.016, 0.022);
  const sisterArmGeo = new THREE.CapsuleGeometry(0.052, 0.38, 5, 8);
  sisterArmGeo.translate(0, 0.18, 0);

  const sisterWaveArms: THREE.Group[] = [];

  for (const [idx, sx] of ([-0.46, 0.46] as const).entries()) {
    const nun = new THREE.Group();
    nun.position.set(sx, 0, 0.2);
    // Face toward the oncoming driver (-Z)
    nun.rotation.y = Math.PI;

    // 1. White Habit Tunic + Blue Scapular Apron (Front & Back) + Belt
    const tunic = new THREE.Mesh(sisterTunicGeo, habitWhiteMat);
    tunic.position.set(0, 0.69, 0);

    const scapFront = new THREE.Mesh(sisterScapularGeo, veilBlueMat);
    scapFront.position.set(0, 0.68, 0.22);
    const scapBack = new THREE.Mesh(sisterScapularGeo, veilBlueMat);
    scapBack.position.set(0, 0.68, -0.22);

    const belt = new THREE.Mesh(sisterBeltGeo, beltBrownMat);
    belt.position.set(0, 0.88, 0);

    const wimple = new THREE.Mesh(sisterWimpleGeo, habitWhiteMat);
    wimple.position.set(0, 1.33, 0);

    // 2. Fair Spanish Caucasian Face + White Coif + Blue Veil
    const head = new THREE.Mesh(sisterHeadGeo, caucasianSkinMat);
    head.position.set(0, 1.54, 0);

    const coifBand = new THREE.Mesh(sisterCoifBandGeo, habitWhiteMat);
    coifBand.position.set(0, 1.62, 0.015);

    const veilCap = new THREE.Mesh(sisterVeilTopGeo, veilLightBlueMat);
    veilCap.position.set(0, 1.56, -0.01);

    const veilBack = new THREE.Mesh(sisterVeilBackGeo, veilBlueMat);
    veilBack.position.set(0, 1.24, -0.15);

    // 3. Sporty Sun Visor ("visera para el sol") worn by BOTH Sisters!
    const visorCrown = new THREE.Mesh(sunVisorBrimGeo, habitWhiteMat);
    visorCrown.position.set(0, 1.63, 0.09);
    visorCrown.rotation.x = 0.22;

    const visorBlueTrim = new THREE.Mesh(sunVisorBrimGeo, veilBlueMat);
    visorBlueTrim.scale.set(1.03, 0.65, 1.03);
    visorBlueTrim.position.set(0, 1.645, 0.085);
    visorBlueTrim.rotation.x = 0.22;

    nun.add(
      tunic,
      scapFront,
      scapBack,
      belt,
      wimple,
      head,
      coifBand,
      veilCap,
      veilBack,
      visorCrown,
      visorBlueTrim,
    );

    // 4. Stylish Sunglasses ("lentes de sol") on Sister #1 (idx === 0)
    if (idx === 0) {
      const glassesGroup = new THREE.Group();
      glassesGroup.position.set(0, 1.555, 0.168);
      const lensL = new THREE.Mesh(sunGlassLensGeo, sunglassesDarkMat);
      lensL.position.set(-0.056, 0, 0);
      const lensR = new THREE.Mesh(sunGlassLensGeo, sunglassesDarkMat);
      lensR.position.set(0.056, 0, 0);
      const bridge = new THREE.Mesh(sunGlassBridgeGeo, goldMat);
      bridge.position.set(0, 0.01, 0.005);
      glassesGroup.add(lensL, lensR, bridge);
      nun.add(glassesGroup);
    }

    // 5. White-Sleeved Celebrating Arm
    const armPivot = new THREE.Group();
    armPivot.position.set(idx === 0 ? -0.27 : 0.27, 1.2, 0.06);
    const sleeveMesh = new THREE.Mesh(sisterArmGeo, habitWhiteMat);
    armPivot.add(sleeveMesh);
    nun.add(armPivot);
    sisterWaveArms.push(armPivot);

    madresGroup.add(nun);
  }

  // Framed 16:9 Podium Backdrop Board behind the Sisters & Trophy
  const madresPhotoGeo = new THREE.PlaneGeometry(1.96, 1.12);
  const madresPhotoMat = new THREE.MeshStandardMaterial({
    map: grandTrophyTex,
    roughness: 0.36,
    side: THREE.DoubleSide,
  });
  const madresPhotoMesh = new THREE.Mesh(madresPhotoGeo, madresPhotoMat);
  madresPhotoMesh.position.set(0.32, 1.28, -0.58);
  madresGroup.add(madresPhotoMesh);
  podiumGroup.add(madresGroup);

  // =========================================================================
  // CHEERING KIDS SUPPORTING ON THE SIDELINES (SUBTLE SAN LOLEK SHIRT / SIGN)
  // Safely off the street on the left grass edge (x = -5.45m) & right edge
  // =========================================================================
  const cheeringKidsGroup = new THREE.Group();
  const kidWaveArms: THREE.Group[] = [];
  const kidBodyGeo = new THREE.BoxGeometry(0.34, 0.52, 0.2);
  const kidLegGeo = new THREE.CapsuleGeometry(0.058, 0.32, 4, 8);
  const kidHeadGeo = new THREE.SphereGeometry(0.145, 12, 10);
  const kidHairGeo = new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const kidArmGeo = new THREE.CapsuleGeometry(0.044, 0.28, 4, 8);
  kidArmGeo.translate(0, 0.14, 0);

  const subtleBlueShirtTex = createSubtleKidShirtTexture('#0284c7', true);
  const subtleTealShirtTex = createSubtleKidShirtTexture('#0d9488', false);
  const subtlePinkShirtTex = createSubtleKidShirtTexture('#ec4899', false);
  const subtleSignTex = createSubtleHandheldPlacardTexture();

  const kidBlueShirtMat = new THREE.MeshStandardMaterial({
    map: subtleBlueShirtTex,
    roughness: 0.65,
  });
  const kidTealShirtMat = new THREE.MeshStandardMaterial({
    map: subtleTealShirtTex,
    roughness: 0.65,
  });
  const kidPinkShirtMat = new THREE.MeshStandardMaterial({
    map: subtlePinkShirtTex,
    roughness: 0.65,
  });
  const kidShortsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75 });
  const kidHairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
  const kidSkinTones = [
    new THREE.MeshStandardMaterial({ color: 0xf1c29d, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xe8b48f, roughness: 0.6 }),
  ];

  const signGeo = new THREE.PlaneGeometry(0.58, 0.26);
  const signStickGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6);
  const signMat = new THREE.MeshStandardMaterial({
    map: subtleSignTex,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });

  const kidPlacements: Array<{
    x: number;
    z: number;
    shirtMat: THREE.MeshStandardMaterial;
    holdsSubtleSign: boolean;
  }> = [
    { x: -5.35, z: -0.55, shirtMat: kidBlueShirtMat, holdsSubtleSign: false },
    { x: -5.85, z: 0.45, shirtMat: kidTealShirtMat, holdsSubtleSign: true },
    { x: 7.45, z: 0.35, shirtMat: kidPinkShirtMat, holdsSubtleSign: false },
  ];

  kidPlacements.forEach((kp, kIdx) => {
    const kid = new THREE.Group();
    kid.position.set(kp.x, 0, kp.z);
    kid.rotation.y = Math.PI; // Face oncoming car

    const legL = new THREE.Mesh(kidLegGeo, kidShortsMat);
    legL.position.set(-0.08, 0.22, 0);
    const legR = new THREE.Mesh(kidLegGeo, kidShortsMat);
    legR.position.set(0.08, 0.22, 0);

    const torso = new THREE.Mesh(kidBodyGeo, kp.shirtMat);
    torso.position.set(0, 0.64, 0);

    const kSkin = kidSkinTones[kIdx % kidSkinTones.length];
    const head = new THREE.Mesh(kidHeadGeo, kSkin);
    head.position.set(0, 1.06, 0);

    const hair = new THREE.Mesh(kidHairGeo, kidHairMat);
    hair.position.set(0, 1.08, -0.01);

    const kArmPivot = new THREE.Group();
    kArmPivot.position.set(0.22, 0.84, 0);
    kArmPivot.add(new THREE.Mesh(kidArmGeo, kSkin));

    if (kp.holdsSubtleSign) {
      const stick = new THREE.Mesh(signStickGeo, beltBrownMat);
      stick.position.set(0, 0.34, 0);
      const placard = new THREE.Mesh(signGeo, signMat);
      placard.position.set(0, 0.56, 0.02);
      kArmPivot.add(stick, placard);
    }

    kid.add(legL, legR, torso, head, hair, kArmPivot);
    kidWaveArms.push(kArmPivot);
    cheeringKidsGroup.add(kid);
  });

  group.add(cheeringKidsGroup);

  // Pedestal + Rotating 3D Awards (Regular Medal/Trophy vs Super Gold Trophy with Diamonds!)
  const pedestalGeo = new THREE.CylinderGeometry(0.45, 0.54, 1.05, 16);
  const pedestal = new THREE.Mesh(pedestalGeo, habitWhiteMat);
  pedestal.position.set(0.95, 0.76, 0);
  podiumGroup.add(pedestal);

  const awardSpinGroup = new THREE.Group();
  awardSpinGroup.position.set(0.95, 1.55, 0);

  // Regular Medal + Cup Trophy
  const regularTrophyGroup = new THREE.Group();
  const medalDiscGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24);
  medalDiscGeo.rotateX(Math.PI / 2);
  const medalDisc = new THREE.Mesh(medalDiscGeo, goldMat);
  medalDisc.position.set(-0.28, 0.25, 0);
  const cupBaseGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.18, 16);
  const cupBowlGeo = new THREE.CylinderGeometry(0.34, 0.14, 0.56, 20);
  const cupBowl = new THREE.Mesh(cupBowlGeo, goldMat);
  cupBowl.position.set(0.22, 0.34, 0);
  const cupBase = new THREE.Mesh(cupBaseGeo, carbonMatStub());
  cupBase.position.set(0.22, 0.02, 0);
  regularTrophyGroup.add(medalDisc, cupBowl, cupBase);

  // GRAND SUPER GOLD TROPHY WITH DIAMONDS ("Gran Trofeo Súper Oro con Diamantes")
  const superDiamondTrophyGroup = new THREE.Group();
  const grandPlinthGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.32, 20);
  const grandPlinth = new THREE.Mesh(grandPlinthGeo, goldMat);
  const grandStemGeo = new THREE.CylinderGeometry(0.14, 0.24, 0.52, 16);
  const grandStem = new THREE.Mesh(grandStemGeo, goldMat);
  grandStem.position.y = 0.38;
  const grandCupGeo = new THREE.CylinderGeometry(0.62, 0.22, 1.05, 28);
  const grandCup = new THREE.Mesh(grandCupGeo, goldMat);
  grandCup.position.y = 1.1;
  const handleTorusGeo = new THREE.TorusGeometry(0.32, 0.055, 10, 20, Math.PI);
  const hLeft = new THREE.Mesh(handleTorusGeo, goldMat);
  hLeft.position.set(-0.52, 1.12, 0);
  hLeft.rotation.z = Math.PI / 2;
  const hRight = new THREE.Mesh(handleTorusGeo, goldMat);
  hRight.position.set(0.52, 1.12, 0);
  hRight.rotation.z = -Math.PI / 2;
  superDiamondTrophyGroup.add(grandPlinth, grandStem, grandCup, hLeft, hRight);

  // Sparkling Ring of Faceted 3D Diamonds + Giant Crown Diamond on Top!
  const smallDiamondGeo = new THREE.OctahedronGeometry(0.11, 0);
  for (let d = 0; d < 8; d++) {
    const ang = (d * Math.PI * 2) / 8;
    const gem = new THREE.Mesh(smallDiamondGeo, diamondMat);
    gem.position.set(Math.cos(ang) * 0.58, 1.48, Math.sin(ang) * 0.58);
    superDiamondTrophyGroup.add(gem);
  }
  const crownDiamondGeo = new THREE.OctahedronGeometry(0.28, 0);
  const crownDiamond = new THREE.Mesh(crownDiamondGeo, diamondMat);
  crownDiamond.position.set(0, 1.92, 0);
  superDiamondTrophyGroup.add(crownDiamond);

  awardSpinGroup.add(regularTrophyGroup, superDiamondTrophyGroup);
  podiumGroup.add(awardSpinGroup);
  group.add(podiumGroup);

  function carbonMatStub() {
    const m = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
    disposables.push(m);
    return m;
  }

  let bannerObj: { sprite: THREE.Sprite; tex: THREE.CanvasTexture; mat: THREE.SpriteMaterial } | null =
    null;

  const configureForPlan = (plan: CheckpointPresenterPlan) => {
    if (bannerObj) {
      group.remove(bannerObj.sprite);
      bannerObj.tex.dispose();
      bannerObj.mat.dispose();
    }

    const topText = plan.isGrandFinale
      ? 'META FINAL · PODIO DE CAMPEONES'
      : `META ${plan.checkpointNumber}/${plan.totalCheckpoints} · ${plan.presenterName}`;
    const subText = plan.awardTitle;

    bannerObj = createMetaBannerSprite(topText, subText, plan.isGrandFinale);
    bannerObj.sprite.position.set(0, 8.2, 0);
    group.add(bannerObj.sprite);

    if (plan.isGrandFinale) {
      childGroup.visible = false;
      madresGroup.visible = true;
      regularTrophyGroup.visible = false;
      superDiamondTrophyGroup.visible = true;
      ringMat.color.setHex(0xfde047);
      ringMat.emissive.setHex(0xfacc15);
    } else {
      childGroup.visible = true;
      madresGroup.visible = false;
      regularTrophyGroup.visible = true;
      superDiamondTrophyGroup.visible = false;

      medalDisc.material = plan.awardKind === 'MEDAL_SILVER' ? silverMat : goldMat;
      ringMat.color.setHex(0xf59e0b);
      ringMat.emissive.setHex(0xf59e0b);
    }
  };

  // Skyward Golden Beacon Column to highlight the NEXT active meta from afar
  const beaconGeo = new THREE.CylinderGeometry(0.85, 2.2, 22, 18, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skyBeacon = new THREE.Mesh(beaconGeo, beaconMat);
  skyBeacon.position.set(0, 11, 0);
  skyBeacon.visible = false;
  group.add(skyBeacon);

  let isActiveMeta = false;
  const setActiveTarget = (isActive: boolean) => {
    isActiveMeta = isActive;
    skyBeacon.visible = isActive;
    ringMat.emissiveIntensity = isActive ? 2.1 : 0.65;
  };

  disposables.push(
    ringMat,
    groundRingGeo,
    pillarGeo,
    goldMat,
    silverMat,
    diamondMat,
    skyArchMat,
    velvetRedMat,
    crossBeamGeo,
    carpetGeo,
    stewardHeadGeo,
    capVisorGeo,
    childBodyGeo,
    childBodyMat,
    waveArmGeo,
    stewardSkinMat,
    caucasianSkinMat,
    habitWhiteMat,
    veilBlueMat,
    veilLightBlueMat,
    beltBrownMat,
    sunglassesDarkMat,
    sisterTunicGeo,
    sisterScapularGeo,
    sisterBeltGeo,
    sisterWimpleGeo,
    sisterHeadGeo,
    sisterCoifBandGeo,
    sisterVeilTopGeo,
    sisterVeilBackGeo,
    sunVisorBrimGeo,
    sunGlassLensGeo,
    sunGlassBridgeGeo,
    sisterArmGeo,
    madresPhotoGeo,
    madresPhotoMat,
    kidBodyGeo,
    kidLegGeo,
    kidHeadGeo,
    kidHairGeo,
    kidArmGeo,
    subtleBlueShirtTex,
    subtleTealShirtTex,
    subtlePinkShirtTex,
    subtleSignTex,
    kidBlueShirtMat,
    kidTealShirtMat,
    kidPinkShirtMat,
    kidShortsMat,
    kidHairMat,
    ...kidSkinTones,
    signGeo,
    signStickGeo,
    signMat,
    pedestalGeo,
    medalDiscGeo,
    cupBaseGeo,
    cupBowlGeo,
    grandPlinthGeo,
    grandStemGeo,
    grandCupGeo,
    handleTorusGeo,
    smallDiamondGeo,
    crownDiamondGeo,
    beaconGeo,
    beaconMat,
  );

  return {
    group,
    configureForPlan,
    setActiveTarget,
    updateAnimation: (timeSec: number) => {
      awardSpinGroup.rotation.y = timeSec * 1.6;
      awardSpinGroup.position.y = 1.55 + Math.sin(timeSec * 3.0) * 0.08;
      wavingArmPivot.rotation.z = -0.35 + Math.sin(timeSec * 6.5) * 0.45;
      sisterWaveArms.forEach((arm, idx) => {
        arm.rotation.z = (idx === 0 ? 0.32 : -0.32) + Math.sin(timeSec * 4.6 + idx * 1.3) * 0.28;
      });
      kidWaveArms.forEach((kArm, idx) => {
        kArm.rotation.z = -0.25 + Math.sin(timeSec * 6.2 + idx * 1.7) * 0.36;
      });
      if (isActiveMeta) {
        beaconMat.opacity = 0.14 + Math.sin(timeSec * 4.0) * 0.06;
      }
    },
    dispose: () => {
      if (bannerObj) {
        bannerObj.tex.dispose();
        bannerObj.mat.dispose();
      }
      disposables.forEach((d) => d.dispose());
    },
  };
}

// ============================================================================
// REAL 3D HOUSES & URBAN ARCHITECTURE ("Casas Reales")
// ============================================================================
export function createRealHouseMesh(
  width: number,
  depth: number,
  height: number,
  style: HouseStyle,
  facadeTex: THREE.CanvasTexture,
  roofTex: THREE.CanvasTexture,
  seed: number,
): THREE.Group {
  const house = new THREE.Group();

  const wallGeo = new THREE.BoxGeometry(width, height, depth);
  const wallMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: 0.78,
    metalness: 0.05,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.y = height / 2;
  wallMesh.receiveShadow = true;
  house.add(wallMesh);

  const useFlatModern = style === 'modernist_brasilia' || (style === 'campus_gt' && seed % 2 === 1);
  if (useFlatModern) {
    const parapetGeo = new THREE.BoxGeometry(width + 0.5, 0.45, depth + 0.5);
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const parapet = new THREE.Mesh(parapetGeo, parapetMat);
    parapet.position.y = height + 0.22;
    house.add(parapet);
  } else {
    const roofH = Math.min(2.6, Math.max(1.35, width * 0.22));
    const roofRadius = Math.hypot(width * 0.56, depth * 0.56);
    const roofGeo = new THREE.ConeGeometry(roofRadius, roofH, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      roughness: 0.72,
      metalness: 0.06,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + roofH / 2 - 0.05;
    house.add(roof);
  }

  const awningGeo = new THREE.BoxGeometry(width * 0.55, 0.16, 1.3);
  const awningMat = new THREE.MeshStandardMaterial({
    color: style === 'colonial_gt' ? 0x7c2d12 : 0x334155,
    roughness: 0.65,
  });
  const awning = new THREE.Mesh(awningGeo, awningMat);
  awning.position.set(0, Math.min(height * 0.54, 3.1), depth / 2 + 0.55);
  house.add(awning);

  return house;
}

// ============================================================================
// CIVIC, CULTURAL, UNIVERSITY, ZOO SAFARI & RACE CIRCUIT LANDMARKS
// ============================================================================
function createHeritageLandmarkSprite(label: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = 'rgba(12, 24, 44, 0.84)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 76, 18);
  ctx.fill();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.font = '700 16px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PATRIMONIO CULTURAL MONUMENTAL', 256, 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 23px Outfit, sans-serif';
  ctx.fillText(label.slice(0, 38), 256, 67);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(15.5, 2.9, 1);
  return sp;
}

export function createLandmarkGroup(
  spec: LandmarkSpec,
  _texPack: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  if (spec.rotationY !== undefined) {
    g.rotation.y = spec.rotationY;
  } else if (spec.kind === 'cristo_redentor') {
    // Face directly toward the center of the city/circuit so outstretched arms embrace the track
    g.rotation.y = Math.atan2(-spec.x, -spec.z);
  }

  let plaqueHeight = 18;

  if (spec.kind === 'cristo_redentor') {
    // MONUMENTAL CRISTO REDENTOR (BRAZIL) — Lush Corcovado Peak + Art Deco Pedestal + Jesus with Wide Extended Arms
    const corcovadoGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.86 });
    const graniteCliffMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 });
    const pedestalStoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.52 });
    const soapstoneWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefefe,
      emissive: new THREE.Color(0xfffbeb),
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.45,
    });
    const sacredHeartMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });

    // 1. Lush Tropical Corcovado Mountain Base + Granite Cliff Face
    const mountLower = new THREE.Mesh(new THREE.ConeGeometry(42, 34, 24), corcovadoGreenMat);
    mountLower.position.y = 16;
    const graniteSummit = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 22, 16, 16), graniteCliffMat);
    graniteSummit.position.y = 30;
    const terraceDeck = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 12.8, 2.2, 16), pedestalStoneMat);
    terraceDeck.position.y = 38.6;

    // 2. Octagonal Art Deco Pedestal (8.2m tall)
    const pedestalBase = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.6, 8.2, 8), pedestalStoneMat);
    pedestalBase.position.y = 43.8;
    const pedestalPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.5, 1.4, 8), soapstoneWhiteMat);
    pedestalPlinth.position.y = 48.4;

    // 3. Monumental Statue of Jesus with Wide Horizontally Outstretched Arms (~26m statue height, 26m armspan!)
    const statue = new THREE.Group();
    statue.position.y = 49.0;

    // Flowing Art Deco Tunic Robe & Pleats
    const lowerRobe = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 3.25, 11.5, 16), soapstoneWhiteMat);
    lowerRobe.position.y = 5.75;
    const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.45, 7.6, 16), soapstoneWhiteMat);
    upperTorso.position.y = 14.8;

    // Diagonal Mantle Sash across chest
    const mantleSash = new THREE.Mesh(new THREE.BoxGeometry(5.2, 8.4, 3.3), soapstoneWhiteMat);
    mantleSash.position.set(0, 13.8, 0.25);
    mantleSash.rotation.z = 0.24;

    // Sacred Heart Relief on Chest
    const sacredHeart = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), sacredHeartMat);
    sacredHeart.position.set(0, 15.6, 2.65);

    // Wide Horizontally Extended Arms ("con los brazos extendidos") — 26 meters wide!
    const armCrossBeam = new THREE.Mesh(new THREE.BoxGeometry(23.6, 2.35, 2.15), soapstoneWhiteMat);
    armCrossBeam.position.set(0, 16.9, 0.1);

    // Sculpted Draped Sleeves under both outstretched arms
    const sleeveGeo = new THREE.BoxGeometry(9.6, 2.8, 1.65);
    const leftSleeve = new THREE.Mesh(sleeveGeo, soapstoneWhiteMat);
    leftSleeve.position.set(-6.4, 15.6, 0.05);
    leftSleeve.rotation.z = 0.14;
    const rightSleeve = new THREE.Mesh(sleeveGeo, soapstoneWhiteMat);
    rightSleeve.position.set(6.4, 15.6, 0.05);
    rightSleeve.rotation.z = -0.14;

    // Open Welcoming Hands & Thumbs on Both Sides
    const palmGeo = new THREE.BoxGeometry(2.15, 0.95, 0.55);
    const leftHand = new THREE.Mesh(palmGeo, soapstoneWhiteMat);
    leftHand.position.set(-12.7, 16.95, 0.2);
    const rightHand = new THREE.Mesh(palmGeo, soapstoneWhiteMat);
    rightHand.position.set(12.7, 16.95, 0.2);

    // Neck, Serene Head & Flowing Hair (gently inclined forward toward the city)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 1.5, 12), soapstoneWhiteMat);
    neck.position.set(0, 19.2, 0.15);
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 21.1, 0.35);
    headGroup.rotation.x = 0.18; // Gentle compassionate downward gaze
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.75, 18, 16), soapstoneWhiteMat);
    head.scale.set(0.88, 1.18, 0.95);
    const hairVeil = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.88, 2.6, 14), soapstoneWhiteMat);
    hairVeil.position.set(0, -0.45, -0.35);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.4, 10), soapstoneWhiteMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -1.35, 0.75);
    headGroup.add(head, hairVeil, beard);

    statue.add(
      lowerRobe,
      upperTorso,
      mantleSash,
      sacredHeart,
      armCrossBeam,
      leftSleeve,
      rightSleeve,
      leftHand,
      rightHand,
      neck,
      headGroup,
    );
    g.add(mountLower, graniteSummit, terraceDeck, pedestalBase, pedestalPlinth, statue);
    plaqueHeight = 76;
  } else if (spec.kind === 'maya_pyramid') {
    // GRAN JAGUAR MAYA STEPPED PYRAMID (GUATEMALA / PETÉN / KAMINALJUYÚ HERITAGE)
    const limestoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d0c4, roughness: 0.85 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
    for (let tier = 0; tier < 9; tier++) {
      const w = 30 - tier * 2.65;
      const h = 2.4;
      const stepBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), limestoneMat);
      stepBox.position.y = tier * 2.35 + h * 0.5;
      g.add(stepBox);
    }
    const stairRamp = new THREE.Mesh(new THREE.BoxGeometry(5.6, 23.5, 4.2), darkStoneMat);
    stairRamp.position.set(0, 10.6, 10.2);
    stairRamp.rotation.x = -0.46;
    const upperSanctuary = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.8, 6.2), limestoneMat);
    upperSanctuary.position.set(0, 23.4, -0.4);
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.1, 0.6), darkStoneMat);
    doorway.position.set(0, 22.6, 2.6);
    const roofComb = new THREE.Mesh(new THREE.BoxGeometry(6.8, 6.6, 1.8), limestoneMat);
    roofComb.position.set(0, 28.8, -0.8);
    g.add(stairRamp, upperSanctuary, doorway, roofComb);
    plaqueHeight = 35.5;
  } else if (spec.kind === 'white_basilica') {
    // GLEAMING WHITE FOUR-TOWER BAROQUE BASILICA (ESQUIPULAS CULTURAL HERITAGE)
    const whiteStucco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36 });
    const goldDomeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.78,
      roughness: 0.22,
    });
    const nave = new THREE.Mesh(new THREE.BoxGeometry(20, 12.5, 28), whiteStucco);
    nave.position.y = 6.25;
    g.add(nave);
    for (const [tx, tz] of [
      [-9.5, 13],
      [9.5, 13],
      [-9.5, -13],
      [9.5, -13],
    ]) {
      const belfry = new THREE.Mesh(new THREE.BoxGeometry(4.4, 21, 4.4), whiteStucco);
      belfry.position.set(tx, 10.5, tz);
      const cupola = new THREE.Mesh(new THREE.SphereGeometry(2.3, 14, 10), goldDomeMat);
      cupola.position.set(tx, 21.6, tz);
      g.add(belfry, cupola);
    }
    const centralDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 4.5, 16), whiteStucco);
    centralDrum.position.set(0, 14.5, 0);
    const centralDome = new THREE.Mesh(new THREE.SphereGeometry(5.1, 18, 12), goldDomeMat);
    centralDome.position.set(0, 17.2, 0);
    g.add(centralDrum, centralDome);
    plaqueHeight = 26.5;
  } else if (spec.kind === 'colonial_cathedral') {
    // MONUMENTAL HISPANIC-AMERICAN COLONIAL CATHEDRAL
    const ochreStone = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.62 });
    const terracottaDome = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const darkPortal = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 24), ochreStone);
    body.position.y = 6;
    const towerL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 19.5, 4.8), ochreStone);
    towerL.position.set(-9.2, 9.75, 10.5);
    const towerR = towerL.clone();
    towerR.position.x = 9.2;
    const domeL = new THREE.Mesh(new THREE.SphereGeometry(2.45, 14, 10), terracottaDome);
    domeL.position.set(-9.2, 20.1, 10.5);
    const domeR = domeL.clone();
    domeR.position.x = 9.2;
    const mainCupola = new THREE.Mesh(new THREE.SphereGeometry(5.4, 18, 12), terracottaDome);
    mainCupola.position.set(0, 13.8, -2);
    const portalArch = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.2, 0.8), darkPortal);
    portalArch.position.set(0, 3.1, 12.1);
    g.add(body, towerL, towerR, domeL, domeR, mainCupola, portalArch);
    plaqueHeight = 25.5;
  } else if (spec.kind === 'puerta_alcala') {
    // PUERTA DE ALCALÁ NEOCLASSICAL GRANITE MONUMENT (MADRID, SPAIN)
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0xe2e0d8, roughness: 0.58 });
    const shadowArchMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const baseWall = new THREE.Mesh(new THREE.BoxGeometry(28, 13.5, 5.2), graniteMat);
    baseWall.position.y = 6.75;
    const attic = new THREE.Mesh(new THREE.BoxGeometry(16, 4.2, 5.6), graniteMat);
    attic.position.y = 15.5;
    const pediment = new THREE.Mesh(new THREE.ConeGeometry(9.2, 3.4, 4), graniteMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.scale.set(1.25, 1, 0.45);
    pediment.position.y = 19.1;
    g.add(baseWall, attic, pediment);
    for (const ax of [-8.5, 0, 8.5]) {
      const archVoid = new THREE.Mesh(new THREE.BoxGeometry(3.8, 8.6, 5.5), shadowArchMat);
      archVoid.position.set(ax, 4.3, 0);
      g.add(archVoid);
    }
    plaqueHeight = 24;
  } else if (spec.kind === 'sagrada_torres') {
    // MODERNIST SAGRADA TORRES BASILICA SPIRES (BARCELONA / CATALUNYA)
    const sandstoneMat = new THREE.MeshStandardMaterial({ color: 0xd6bfa3, roughness: 0.68 });
    const mosaicGold = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    const portalBase = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 14), sandstoneMat);
    portalBase.position.y = 6.5;
    g.add(portalBase);
    for (const [sx, h] of [
      [-7.2, 30],
      [-2.5, 35],
      [2.5, 35],
      [7.2, 30],
    ]) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 2.35, h, 12), sandstoneMat);
      spire.position.set(sx, h * 0.5 + 4, 0);
      const pinnacle = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 1), mosaicGold);
      pinnacle.position.set(sx, h + 4.8, 0);
      g.add(spire, pinnacle);
    }
    plaqueHeight = 43.5;
  } else if (spec.kind === 'cn_tower') {
    // MONUMENTAL CN TOWER SKYLINE NEEDLE (CANADA)
    const concreteTowerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.42 });
    const skyPodGlass = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.5,
    });
    const baseFins = new THREE.Mesh(new THREE.ConeGeometry(6.8, 18, 3), concreteTowerMat);
    baseFins.position.y = 9;
    const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.2, 48, 16), concreteTowerMat);
    mainShaft.position.y = 24;
    const podLower = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 3.6, 3.2, 24), concreteTowerMat);
    podLower.position.y = 39.5;
    const podGlassRing = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 2.2, 24), skyPodGlass);
    podGlassRing.position.y = 42.1;
    const podRoof = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5.6, 2.2, 24), concreteTowerMat);
    podRoof.position.y = 44.2;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.95, 18, 10), concreteTowerMat);
    mast.position.y = 56;
    g.add(baseFins, mainShaft, podLower, podGlassRing, podRoof, mast);
    plaqueHeight = 68;
  } else if (spec.kind === 'zoo_gate') {
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 });

    const leftTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 9.2, 10), timberMat);
    leftTrunk.position.set(-8.2, 4.6, 0);
    const rightTrunk = leftTrunk.clone();
    rightTrunk.position.x = 8.2;

    const topBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 18.5, 10).rotateZ(Math.PI / 2),
      timberMat,
    );
    topBeam.position.set(0, 8.8, 0);

    const thatch = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.4, 8), leafMat);
    thatch.position.set(-8.2, 10.1, 0);
    const thatchR = thatch.clone();
    thatchR.position.x = 8.2;

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 0.4), goldMat);
    plaque.position.set(0, 8.8, 0);
    g.add(leftTrunk, rightTrunk, topBeam, thatch, thatchR, plaque);
    plaqueHeight = 14;
  } else if (spec.kind === 'race_grandstand') {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.2 });
    const redAccentMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });

    for (let step = 0; step < 5; step++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(28, 1.1, 2.2), concreteMat);
      tier.position.set(0, 0.55 + step * 1.1, step * 2.0);
      g.add(tier);
    }
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(28.4, 9.5, 0.8), concreteMat);
    backWall.position.set(0, 4.75, 9.5);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(29.2, 0.5, 12.5), canopyMat);
    roof.position.set(0, 9.8, 4.2);
    roof.rotation.x = -0.1;
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(29.3, 0.65, 0.4), redAccentMat);
    fascia.position.set(0, 9.2, -1.9);
    g.add(backWall, roof, fascia);
    plaqueHeight = 14.5;
  } else if (spec.kind === 'arch_catalina') {
    const stuccoYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.65 });
    const whiteTrim = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10.5, 3.4), stuccoYellow);
    leftPillar.position.set(-7.6, 5.25, 0);
    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10.5, 3.4), stuccoYellow);
    rightPillar.position.set(7.6, 5.25, 0);

    const upperSpan = new THREE.Mesh(new THREE.BoxGeometry(18.4, 3.4, 3.2), stuccoYellow);
    upperSpan.position.set(0, 9.2, 0);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.55, 3.8), whiteTrim);
    cornice.position.set(0, 11.0, 0);

    const turret = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.8, 2.8), stuccoYellow);
    turret.position.set(0, 12.9, 0);
    const clockFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 2.95, 20).rotateX(Math.PI / 2),
      whiteTrim,
    );
    clockFace.position.set(0, 13.0, 0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), whiteTrim);
    dome.position.set(0, 14.9, 0);

    g.add(leftPillar, rightPillar, upperSpan, cornice, turret, clockFace, dome);
    plaqueHeight = 19.2;
  } else if (spec.kind === 'campus_skybridge') {
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.68 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    const glassSpanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.6,
      roughness: 0.2,
    });

    const towerL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 9.5, 3.8), brickMat);
    towerL.position.set(-8.5, 4.75, 0);
    const towerR = new THREE.Mesh(new THREE.BoxGeometry(3.4, 9.5, 3.8), brickMat);
    towerR.position.set(8.5, 4.75, 0);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.8, 3.4), concreteMat);
    deck.position.set(0, 6.4, 0);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16.2, 2.1, 3.0), glassSpanMat);
    canopy.position.set(0, 7.8, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.45, 3.8), concreteMat);
    roof.position.set(0, 9.0, 0);

    g.add(towerL, towerR, deck, canopy, roof);
    plaqueHeight = 13.2;
  } else if (spec.kind === 'stone_bridge') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85 });
    const parapetL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 22), stoneMat);
    parapetL.position.set(-7.8, 0.9, 0);
    const parapetR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 22), stoneMat);
    parapetR.position.set(7.8, 0.9, 0);
    for (const pz of [-9, 0, 9]) {
      const postL = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 1.9), stoneMat);
      postL.position.set(-7.8, 1.3, pz);
      const postR = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 1.9), stoneMat);
      postR.position.set(7.8, 1.3, pz);
      g.add(postL, postR);
    }
    g.add(parapetL, parapetR);
    plaqueHeight = 8.5;
  } else if (spec.kind === 'university_hall') {
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.65 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.2 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });

    const wingA = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 11), brickMat);
    wingA.position.set(0, 6, 0);
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 13), glassMat);
    atrium.position.set(0, 7, 1.5);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(23, 0.8, 12), concreteMat);
    cornice.position.set(0, 12.4, 0);
    g.add(wingA, atrium, cornice);
    plaqueHeight = 17.5;
  } else if (spec.kind === 'modern_congress') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 16), whiteMat);
    deck.position.set(0, 1.1, 0);
    const tower1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 26, 7), whiteMat);
    tower1.position.set(-2.6, 13, 0);
    const tower2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 26, 7), whiteMat);
    tower2.position.set(2.6, 13, 0);
    const domeLeft = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      whiteMat,
    );
    domeLeft.position.set(-10.5, 2.2, 2);
    const bowlRight = new THREE.Mesh(new THREE.CylinderGeometry(6, 3.8, 3.2, 24), whiteMat);
    bowlRight.position.set(10.5, 3.6, 2);
    g.add(deck, tower1, tower2, domeLeft, bowlRight);
    plaqueHeight = 30.5;
  } else if (spec.kind === 'coastal_lighthouse') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: new THREE.Color(0xfacc15),
      emissiveIntensity: 2.2,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 16, 16), whiteMat);
    base.position.y = 8;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 4, 16), redMat);
    band.position.y = 10;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 2.8, 14), lampMat);
    lantern.position.y = 17.4;
    g.add(base, band, lantern);
    plaqueHeight = 22.5;
  } else if (spec.kind === 'central_plaza') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.3 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 0.35, 24), stoneMat);
    pad.position.y = 0.18;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.9, 20), stoneMat);
    basin.position.y = 0.6;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.96, 20), waterMat);
    water.position.y = 0.65;
    const kiosk = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.6, 8), stoneMat);
    kiosk.position.y = 4.2;
    g.add(pad, basin, water, kiosk);
    plaqueHeight = 9.5;
  } else {
    // Monumental Obelisk (e.g., Obelisco de Buenos Aires / Reforma)
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.36 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.88, roughness: 0.2 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.2, 7.2), marbleMat);
    plinth.position.y = 1.6;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 2.55, 32, 4), marbleMat);
    shaft.rotation.y = Math.PI / 4;
    shaft.position.y = 19.2;
    const pyramidion = new THREE.Mesh(new THREE.ConeGeometry(1.62, 3.8, 4), goldMat);
    pyramidion.rotation.y = Math.PI / 4;
    pyramidion.position.y = 37.1;
    g.add(plinth, shaft, pyramidion);
    plaqueHeight = 42.5;
  }

  if (spec.name && spec.kind !== 'stone_bridge' && spec.kind !== 'race_grandstand') {
    const plaqueSprite = createHeritageLandmarkSprite(spec.name);
    plaqueSprite.position.set(0, plaqueHeight, 0);
    g.add(plaqueSprite);
  }

  return g;
}

