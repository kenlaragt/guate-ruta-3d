import * as THREE from 'three';
import {
  CheckpointPresenterPlan,
  PEDESTRIAN_UV_SLICES,
} from '../data/awardsCatalog';
import { CarSpec, HouseStyle, LandmarkSpec } from '../types/game';
import {
  createDriverLabelSprite,
  createNumberDoorTexture,
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
  ctx.fillText('GUATEMALA · C.A.', 128, 17);
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
  // Standard PlaneGeometry vertex order: (0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right)
  uv.setXY(0, uMin, vMax);
  uv.setXY(1, uMax, vMax);
  uv.setXY(2, uMin, vMin);
  uv.setXY(3, uMax, vMin);
  uv.needsUpdate = true;
}

// ============================================================================
// REALISTIC MULTI-PART VEHICLES: CARS, TUK-TUK, BICYCLE & HEAVY TRUCK
// ============================================================================
export function createRealisticCarRig(
  spec: CarSpec,
  paintHex: string,
  contactShadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
  driverAlias?: string,
): CarRig3D {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

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
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.12,
    roughness: 0.07,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.58 : 0.88,
    ior: 1.5,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xe0f2fe),
    emissiveIntensity: 2.0,
    roughness: 0.12,
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

  disposables.push(
    paintMat,
    trimMat,
    carbonMat,
    chromeMat,
    glassMat,
    headlightMat,
    brakeLightMat,
    amberBlinkerMat,
    tireMat,
    caliperMat,
  );

  const attachDriverTag = (topY: number) => {
    if (!driverAlias) return;
    const labelSprite = createDriverLabelSprite(
      driverAlias,
      `${spec.brand} ${spec.name.replace(spec.brand, '').trim()}`,
      paintHex || spec.defaultPaint,
    );
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
  // SPECIAL VEHICLE A: BICYCLE WITH 3D CYCLIST ("Bicicleta")
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

    // Diamond Tubular Frame
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
    // Seat tube, top tube, down tube, chainstays, seatstays, head tube & fork
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

    // Saddle & Rear Safety LED
    const saddleGeo = new THREE.BoxGeometry(0.16, 0.05, 0.28);
    const saddle = new THREE.Mesh(saddleGeo, carbonMat);
    saddle.position.set(0, 0.92, 0.24);
    const tailLedGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
    const tailLed = new THREE.Mesh(tailLedGeo, brakeLightMat);
    tailLed.position.set(0, 0.86, 0.38);
    group.add(saddle, tailLed);
    disposables.push(saddleGeo, tailLedGeo);

    // Handlebars (Cockpit Steering)
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

    // Crankset + Pedals + Articulated 3D Cyclist
    const crankGroup = new THREE.Group();
    crankGroup.position.set(0, 0.34, 0.08);
    const chainRingGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16);
    chainRingGeo.rotateZ(Math.PI / 2);
    crankGroup.add(new THREE.Mesh(chainRingGeo, chromeMat));
    group.add(crankGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.65 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const jerseyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55 });
    const torsoGeo = new THREE.CapsuleGeometry(0.16, 0.38, 6, 12);
    const torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.position.set(0, 1.24, 0.02);
    torso.rotation.x = -0.58;

    const headGeo = new THREE.SphereGeometry(0.12, 14, 12);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.54, -0.18);
    const helmetGeo = new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const helmet = new THREE.Mesh(helmetGeo, trimMat);
    helmet.position.set(0, 1.56, -0.18);

    // Cyclist arms reaching handlebars
    addTube(-0.16, 1.36, -0.1, -0.22, 0.99, -0.44, skinMat);
    addTube(0.16, 1.36, -0.1, 0.22, 0.99, -0.44, skinMat);

    const legGeo = new THREE.CapsuleGeometry(0.065, 0.42, 5, 8);
    legGeo.translate(0, -0.22, 0);
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.11, 0.92, 0.2);
    leftLeg.add(new THREE.Mesh(legGeo, shortsMat));

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.11, 0.92, 0.2);
    rightLeg.add(new THREE.Mesh(legGeo, shortsMat));

    group.add(torso, head, helmet, leftLeg, rightLeg);
    disposables.push(
      chainRingGeo,
      skinMat,
      shortsMat,
      jerseyMat,
      torsoGeo,
      headGeo,
      helmetGeo,
      legGeo,
    );

    attachDriverTag(1.98);

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
  // SPECIAL VEHICLE B: AUTHENTIC 3-WHEEL GUATEMALAN TUK-TUK ("Tuk Tuk")
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

    // Lower body tub + rear engine bay + front leg shield cowl
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

    // Curved windshield + central wiper
    const wsGeo = new THREE.PlaneGeometry(0.96, 0.58);
    const ws = new THREE.Mesh(wsGeo, glassMat);
    ws.position.set(0, 1.26, -0.78);
    ws.rotation.x = -0.22;

    // Characteristic Black Canvas Roof Canopy + Yellow Trim Band
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

    // Roof pillars & passenger bench seat
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

    // Single central headlight + twin blinkers + rear lights + Guatemala Tuk-Tuk plate
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

    // 3 Wheels: 1 Front Steered Wheel with Mudguard + 2 Rear Wheels
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

    // Cockpit Handlebar + 3D Tuk-Tuk Driver + Chrome Front Guard & Roof Rack
    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(0, 0.96, -0.58);
    const hBarGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.54, 10);
    hBarGeo.rotateZ(Math.PI / 2);
    cockpitWheel.add(new THREE.Mesh(hBarGeo, chromeMat));
    group.add(cockpitWheel);

    const tukDriverMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.65 });
    const tukSkinMat = new THREE.MeshStandardMaterial({ color: 0xd69a72, roughness: 0.65 });
    const drvTorsoGeo = new THREE.CapsuleGeometry(0.16, 0.36, 5, 10);
    const drvTorso = new THREE.Mesh(drvTorsoGeo, tukDriverMat);
    drvTorso.position.set(0, 1.04, -0.22);
    const drvHeadGeo = new THREE.SphereGeometry(0.115, 12, 10);
    const drvHead = new THREE.Mesh(drvHeadGeo, tukSkinMat);
    drvHead.position.set(0, 1.38, -0.22);

    const guardTubeGeo = new THREE.TorusGeometry(0.38, 0.024, 8, 18, Math.PI);
    guardTubeGeo.rotateX(Math.PI / 2);
    const frontGuard = new THREE.Mesh(guardTubeGeo, chromeMat);
    frontGuard.position.set(0, 0.34, -0.92);

    const rackGeo = new THREE.BoxGeometry(width * 0.86, 0.05, 1.35);
    const roofRack = new THREE.Mesh(rackGeo, chromeMat);
    roofRack.position.set(0, 1.75, 0.22);

    group.add(drvTorso, drvHead, frontGuard, roofRack);

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
      tukDriverMat,
      tukSkinMat,
      drvTorsoGeo,
      drvHeadGeo,
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
  // SPECIAL VEHICLE C: HEAVY CARGO TRUCK ("Camión")
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

    // Heavy steel ladder chassis + chrome fuel tanks
    const frameGeo = new THREE.BoxGeometry(width * 0.72, 0.28, length * 0.92);
    const frame = new THREE.Mesh(frameGeo, carbonMat);
    frame.position.set(0, 0.48, 0.1);

    const tankGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.35, 16);
    tankGeo.rotateX(Math.PI / 2);
    const tankL = new THREE.Mesh(tankGeo, chromeMat);
    tankL.position.set(-width * 0.44, 0.5, -0.65);
    const tankR = new THREE.Mesh(tankGeo, chromeMat);
    tankR.position.set(width * 0.44, 0.5, -0.65);

    // Tractor Cab + Hood + Chrome Grille + Bullbar + Wind Deflector
    const hoodGeo = new THREE.BoxGeometry(width * 0.86, 0.95, 1.45);
    const hood = new THREE.Mesh(hoodGeo, paintMat);
    hood.position.set(0, 1.05, -2.85);

    const cabGeo = new THREE.BoxGeometry(width * 0.94, 1.75, 1.65);
    const cab = new THREE.Mesh(cabGeo, paintMat);
    cab.position.set(0, 1.52, -1.55);

    const cabWindshieldGeo = new THREE.PlaneGeometry(width * 0.84, 0.72);
    const cabWs = new THREE.Mesh(cabWindshieldGeo, glassMat);
    cabWs.position.set(0, 1.88, -2.385);
    cabWs.rotation.y = Math.PI;

    const spoilerGeo = new THREE.BoxGeometry(width * 0.92, 0.55, 1.15);
    const spoiler = new THREE.Mesh(spoilerGeo, trimMat);
    spoiler.position.set(0, 2.58, -1.45);
    spoiler.rotation.x = 0.25;

    const grilleGeo = new THREE.BoxGeometry(width * 0.68, 0.78, 0.1);
    const grille = new THREE.Mesh(grilleGeo, chromeMat);
    grille.position.set(0, 1.04, -3.59);

    const bumperGeo = new THREE.BoxGeometry(width + 0.04, 0.34, 0.22);
    const bumper = new THREE.Mesh(bumperGeo, chromeMat);
    bumper.position.set(0, 0.52, -3.62);

    // Twin Vertical Chrome Exhaust Stacks
    const stackGeo = new THREE.CylinderGeometry(0.075, 0.075, 2.55, 12);
    const stackL = new THREE.Mesh(stackGeo, chromeMat);
    stackL.position.set(-width * 0.48, 1.95, -0.68);
    const stackR = new THREE.Mesh(stackGeo, chromeMat);
    stackR.position.set(width * 0.48, 1.95, -0.68);

    // Tall Corrugated Cargo Box with Accent Stripe
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42, metalness: 0.15 });
    const cargoGeo = new THREE.BoxGeometry(width, 2.48, 4.35);
    const cargo = new THREE.Mesh(cargoGeo, boxMat);
    cargo.position.set(0, 1.88, 1.55);

    const stripeGeo = new THREE.BoxGeometry(width + 0.03, 0.26, 4.37);
    const stripe = new THREE.Mesh(stripeGeo, trimMat);
    stripe.position.set(0, 1.15, 1.55);

    // Headlights, Roof Amber Clearance Lights & Rear Taillights
    const hlGeo = new THREE.BoxGeometry(0.36, 0.18, 0.08);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(-width * 0.34, 0.88, -3.59);
    const hlR = new THREE.Mesh(hlGeo, headlightMat);
    hlR.position.set(width * 0.34, 0.88, -3.59);

    const roofDotGeo = new THREE.BoxGeometry(0.12, 0.07, 0.08);
    for (const rx of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const rl = new THREE.Mesh(roofDotGeo, amberBlinkerMat);
      rl.position.set(rx, 2.42, -2.38);
      group.add(rl);
    }

    const tlGeo = new THREE.BoxGeometry(0.46, 0.16, 0.08);
    const tlL = new THREE.Mesh(tlGeo, brakeLightMat);
    tlL.position.set(-width * 0.36, 0.62, 3.73);
    const tlR = new THREE.Mesh(tlGeo, brakeLightMat);
    tlR.position.set(width * 0.36, 0.62, 3.73);

    group.add(
      shadowPlane,
      frame,
      tankL,
      tankR,
      hood,
      cab,
      cabWs,
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
    );

    // 6 Heavy Truck Wheels (Steered Front + Tandem Dual Rear Axles)
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

    // Truck Cockpit Steering Wheel + Chrome Side Mirrors & Mudflaps
    const cockpitWheel = new THREE.Group();
    cockpitWheel.position.set(-width * 0.22, 1.58, -1.92);
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
      cabGeo,
      cabWindshieldGeo,
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

    attachDriverTag(3.55);

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
  // SPECIAL VEHICLE D: 4X4 DOUBLE-CAB PICKUP TRUCK ("Pickup 4x4")
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

    // Lifted 4x4 Chassis + Side Running Boards (Estribos)
    const chassisGeo = new THREE.BoxGeometry(width * 0.84, 0.24, length * 0.92);
    const chassis = new THREE.Mesh(chassisGeo, carbonMat);
    chassis.position.set(0, 0.42, 0);

    const stepGeo = new THREE.BoxGeometry(width + 0.08, 0.08, 1.95);
    const steps = new THREE.Mesh(stepGeo, carbonMat);
    steps.position.set(0, 0.36, -0.32);

    // Front Engine Bay / Hood + Double Cab Lower Body
    const frontCabLowerGeo = new THREE.BoxGeometry(width, 0.68, 3.05);
    const frontCabLower = new THREE.Mesh(frontCabLowerGeo, paintMat);
    frontCabLower.position.set(0, 0.82, -1.02);

    // Double Cab Greenhouse (Tinted Windows + Roof)
    const cabUpperGeo = new THREE.BoxGeometry(width * 0.88, 0.64, 1.72);
    const cabUpper = new THREE.Mesh(cabUpperGeo, glassMat);
    cabUpper.position.set(0, 1.44, -0.45);

    const roofCapGeo = new THREE.BoxGeometry(width * 0.9, 0.08, 1.76);
    const roofCap = new THREE.Mesh(roofCapGeo, paintMat);
    roofCap.position.set(0, 1.78, -0.45);

    // Open Cargo Bed ("Palangana") — Floor Liner + Left/Right Walls + Rear Tailgate
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

    // Sports Rollbar ("Barra Antivuelco") + 3 Off-Road Roof Spotlights
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

    // Rugged 4x4 Front Grille, Bullbar, Headlights & Taillights
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

    // 4 Rugged Off-Road 4x4 Wheels
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

    // Cockpit Steering Wheel
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

    attachDriverTag(2.35);

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
  // HIGH-DETAIL REALISTIC AUTOMOBILES (BYD F, COROLLA, SUPRA, GT86, LAMBO, TESLA, GTR, SENTRA)
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
    cabinH = 0.38;
    cabinLen = 1.85;
    cabinOffsetZ = -0.05;
  } else if (spec.bodyStyle === 'sport_coupe' || spec.bodyStyle === 'gt_boxer') {
    width = 1.94;
    length = 4.44;
    chassisH = 0.48;
    cabinH = 0.45;
    cabinLen = 1.84;
    cabinOffsetZ = 0.24;
  } else if (spec.bodyStyle === 'gtr_race') {
    width = 1.92;
    length = 4.56;
    chassisH = 0.52;
    cabinH = 0.48;
    cabinLen = 1.98;
    cabinOffsetZ = 0.12;
  } else if (spec.bodyStyle === 'ev_fastback') {
    width = 1.98;
    length = 4.82;
    chassisH = 0.5;
    cabinH = 0.49;
    cabinLen = 2.58;
    cabinOffsetZ = 0.08;
  }

  const halfL = length / 2;

  // 1. Contact shadow grounded just above road
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

  // 2. Sculpted profile lower hull via ExtrudeGeometry with smooth bevels
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

  // 3. Lower aerodynamic front lip, side skirts & rear diffuser
  const skirtGeo = new THREE.BoxGeometry(width + 0.04, 0.1, length + 0.08);
  const skirtMesh = new THREE.Mesh(skirtGeo, carbonMat);
  skirtMesh.position.set(0, 0.22, 0);
  group.add(skirtMesh);
  disposables.push(skirtGeo);

  // Sculpted Wheel Arch Flares
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

  // 4. Sculpted Aerodynamic Sloped Cabin Greenhouse + Roof Cap + Interior Seats/Driver + Mirrors + Door Handles
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
  group.add(cabinGlass);

  const roofCapGeo = new THREE.BoxGeometry(width * 0.75, 0.055, cabinLen * 0.52);
  const roofCap = new THREE.Mesh(roofCapGeo, roofMat);
  roofCap.position.set(0, baseCabY + cabinH + 0.02, cabinOffsetZ + cabinLen * 0.03);
  group.add(roofCap);

  // Interior Bucket Seats & Driver Silhouette visible through glass
  const seatBackGeo = new THREE.BoxGeometry(0.36, 0.44, 0.1);
  const drvHeadGeo = new THREE.SphereGeometry(0.105, 10, 10);
  const seatL = new THREE.Mesh(seatBackGeo, carbonMat);
  seatL.position.set(-width * 0.19, baseCabY + 0.18, cabinOffsetZ + 0.16);
  seatL.rotation.x = 0.18;
  const seatR = new THREE.Mesh(seatBackGeo, carbonMat);
  seatR.position.set(width * 0.19, baseCabY + 0.18, cabinOffsetZ + 0.16);
  seatR.rotation.x = 0.18;
  const drvHead = new THREE.Mesh(drvHeadGeo, carbonMat);
  drvHead.position.set(-width * 0.19, baseCabY + 0.34, cabinOffsetZ + 0.12);
  group.add(seatL, seatR, drvHead);

  // Left & Right Side Mirrors + Door Handles + Windshield Wipers
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
    drvHeadGeo,
    mirrorCapGeo,
    mirrorStalkGeo,
    handleGeo,
    wiperGeo,
  );

  // 5. Nissan Calsonic #12 Door Number Decals
  if (spec.liveryNumber) {
    const doorTex = createNumberDoorTexture(spec.liveryNumber, paintHex || spec.defaultPaint);
    const decalGeo = new THREE.PlaneGeometry(1.15, 0.48);
    const decalMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const leftDoor = new THREE.Mesh(decalGeo, decalMat);
    leftDoor.position.set(-width / 2 - 0.015, 0.56, 0.05);
    leftDoor.rotation.y = -Math.PI / 2;
    const rightDoor = new THREE.Mesh(decalGeo, decalMat);
    rightDoor.position.set(width / 2 + 0.015, 0.56, 0.05);
    rightDoor.rotation.y = Math.PI / 2;
    group.add(leftDoor, rightDoor);
    disposables.push(doorTex, decalGeo, decalMat);
  }

  // 6. Detailed Front Grille, Lower Splitter Intake, LED DRL Strips, Headlights & License Plates
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

  // 7. Rear Taillights, Twin Exhaust Pipes & Model-Specific Spoiler
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

  // 8. 4 Multi-Spoke Alloy Wheels with Brake Rotors & Red Brake Calipers
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

  // 9. Interior Simulator Cockpit Dashboard + Rotating 3D Steering Wheel
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

  attachDriverTag(2.28);

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

// ============================================================================
// 3D CHECKPOINT FINISH META STAGE + ANONYMOUS SPORTING PODIUM + GRAND CHAMPION TROPHY
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
  const velvetRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.62 });

  const archLeft = new THREE.Mesh(pillarGeo, goldMat);
  archLeft.position.set(-6.8, 3.4, 0);
  const archRight = new THREE.Mesh(pillarGeo, goldMat);
  archRight.position.set(6.8, 3.4, 0);

  const crossBeamGeo = new THREE.BoxGeometry(14.4, 0.55, 0.55);
  const crossBeam = new THREE.Mesh(crossBeamGeo, velvetRedMat);
  crossBeam.position.set(0, 6.7, 0);

  group.add(groundRing, archLeft, archRight, crossBeam);

  // Side Ceremony Podium Stage at x = +5.4m
  const podiumGroup = new THREE.Group();
  podiumGroup.position.set(5.4, 0, 0);

  const carpetGeo = new THREE.BoxGeometry(3.2, 0.24, 2.8);
  const carpet = new THREE.Mesh(carpetGeo, velvetRedMat);
  carpet.position.y = 0.12;
  podiumGroup.add(carpet);

  // Anonymous 3D Sporting Steward Figure (shown on metas 1..N-1 — zero personal names/photos)
  const childGroup = new THREE.Group();
  childGroup.position.set(-0.55, 0.24, 0);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd69a72, roughness: 0.6 });
  const childBodyGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.22, 10);
  const childBodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 });
  const childBody = new THREE.Mesh(childBodyGeo, childBodyMat);
  childBody.position.set(0, 0.61, 0);

  const stewardHeadGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const stewardHead = new THREE.Mesh(stewardHeadGeo, skinMat);
  stewardHead.position.set(0, 1.42, 0);

  const capVisorGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12);
  const capVisor = new THREE.Mesh(capVisorGeo, goldMat);
  capVisor.position.set(0, 1.56, 0);

  const wavingArmPivot = new THREE.Group();
  wavingArmPivot.position.set(0.32, 1.12, 0);
  const waveArmGeo = new THREE.CapsuleGeometry(0.055, 0.42, 5, 8);
  waveArmGeo.translate(0, 0.22, 0);
  wavingArmPivot.add(new THREE.Mesh(waveArmGeo, skinMat));
  childGroup.add(childBody, stewardHead, capVisor, wavingArmPivot);
  podiumGroup.add(childGroup);

  // Championship Finale Stewards Group (shown on Final Meta — purely sporting!)
  const madresGroup = new THREE.Group();
  madresGroup.position.set(-0.55, 0.24, 0);
  const habitWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const veilBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.48 });

  const sisterRobeGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.42, 12);
  const sisterVeilGeo = new THREE.SphereGeometry(0.16, 12, 10);
  for (const sx of [-0.42, 0.42]) {
    const blazer = new THREE.Mesh(sisterRobeGeo, veilBlueMat);
    blazer.position.set(sx, 0.72, 0.14);
    const head = new THREE.Mesh(sisterVeilGeo, skinMat);
    head.position.set(sx, 1.56, 0.14);
    madresGroup.add(blazer, head);
  }
  const madresPhotoGeo = new THREE.PlaneGeometry(1.55, 1.55);
  const madresPhotoMat = new THREE.MeshStandardMaterial({
    map: grandTrophyTex,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
  const madresPhotoMesh = new THREE.Mesh(madresPhotoGeo, madresPhotoMat);
  madresPhotoMesh.position.set(0, 0.96, -0.02);
  madresGroup.add(madresPhotoMesh);
  podiumGroup.add(madresGroup);

  // Pedestal + Rotating 3D Awards (Regular Medal/Trophy vs Super Gold Trophy with Diamonds!)
  const pedestalGeo = new THREE.CylinderGeometry(0.45, 0.54, 1.05, 16);
  const pedestal = new THREE.Mesh(pedestalGeo, habitWhiteMat);
  pedestal.position.set(0.88, 0.76, 0);
  podiumGroup.add(pedestal);

  const awardSpinGroup = new THREE.Group();
  awardSpinGroup.position.set(0.88, 1.55, 0);

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
      ? `GRAN META FINAL · ${plan.presenterName}`
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
    velvetRedMat,
    crossBeamGeo,
    carpetGeo,
    stewardHeadGeo,
    capVisorGeo,
    childBodyGeo,
    childBodyMat,
    waveArmGeo,
    skinMat,
    habitWhiteMat,
    veilBlueMat,
    sisterRobeGeo,
    sisterVeilGeo,
    madresPhotoGeo,
    madresPhotoMat,
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
export function createLandmarkGroup(
  spec: LandmarkSpec,
  _texPack: ProceduralTexturePack,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z);
  if (spec.rotationY) g.rotation.y = spec.rotationY;

  if (spec.kind === 'zoo_gate') {
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 });

    const leftTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 9.2, 10), timberMat);
    leftTrunk.position.set(-8.2, 4.6, 0);
    const rightTrunk = leftTrunk.clone();
    rightTrunk.position.x = 8.2;

    const topBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 18.5, 10).rotateZ(Math.PI / 2), timberMat);
    topBeam.position.set(0, 8.8, 0);

    const thatch = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.4, 8), leafMat);
    thatch.position.set(-8.2, 10.1, 0);
    const thatchR = thatch.clone();
    thatchR.position.x = 8.2;

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 0.4), goldMat);
    plaque.position.set(0, 8.8, 0);
    g.add(leftTrunk, rightTrunk, topBeam, thatch, thatchR, plaque);
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
    const bowlRight = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 3.8, 3.2, 24),
      whiteMat,
    );
    bowlRight.position.set(10.5, 3.6, 2);
    g.add(deck, tower1, tower2, domeLeft, bowlRight);
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
  } else {
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.88, roughness: 0.2 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 2.4, 16), marbleMat);
    plinth.position.y = 1.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.1, 22, 12), marbleMat);
    shaft.position.y = 13.2;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 16), goldMat);
    crown.position.y = 25;
    g.add(plinth, shaft, crown);
  }

  return g;
}
