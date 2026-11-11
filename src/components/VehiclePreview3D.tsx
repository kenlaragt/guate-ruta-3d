import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getCarById } from '../data/carsCatalog';
import { renderFallbackShowroomTurntable } from '../engine/canvas3dFallbackRenderer';
import { CarRig3D, createRealisticCarRig } from '../engine/models3d';
import { detectSoftwareWebGL } from '../engine/proceduralTextures';
import { CarModelId } from '../types/game';

interface VehiclePreview3DProps {
  carId: CarModelId;
  paintHex: string;
}

function createShowroomContactShadow(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 122);
  grad.addColorStop(0, 'rgba(0,0,0,0.82)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.38)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export const VehiclePreview3D: React.FC<VehiclePreview3DProps> = ({ carId, paintHex }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ dragging: false, lastX: 0, manualYaw: 0.62 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const w0 = container.clientWidth || 560;
    const h0 = container.clientHeight || 280;

    let activeRenderer: THREE.WebGLRenderer | null = null;
    try {
      activeRenderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl2 = probeCanvas.getContext('webgl2', {
          antialias: false,
          depth: true,
          stencil: false,
          failIfMajorPerformanceCaveat: false,
        }) as WebGL2RenderingContext | null;
        if (gl2) {
          activeRenderer = new THREE.WebGLRenderer({
            canvas: probeCanvas,
            context: gl2,
            antialias: false,
          });
        }
      } catch {
        activeRenderer = null;
      }
    }

    if (!activeRenderer) {
      // Built-in 3D Perspective Canvas Showroom Turntable when WebGL2 is disabled/blocked
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = w0;
      fallbackCanvas.height = h0;
      fallbackCanvas.style.width = '100%';
      fallbackCanvas.style.height = '100%';
      fallbackCanvas.style.display = 'block';
      container.innerHTML = '';
      container.appendChild(fallbackCanvas);
      const ctx2d = fallbackCanvas.getContext('2d');

      const onFallbackResize = () => {
        if (!container) return;
        fallbackCanvas.width = Math.max(2, container.clientWidth || 560);
        fallbackCanvas.height = Math.max(2, container.clientHeight || 280);
      };
      window.addEventListener('resize', onFallbackResize);

      let fbFrame = 0;
      let fbUnmounted = false;
      let fbPrev = performance.now();
      const tickFallback = () => {
        if (fbUnmounted) return;
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - fbPrev) / 1000));
        fbPrev = now;
        if (!dragStateRef.current.dragging) {
          dragStateRef.current.manualYaw += dt * 0.45;
        }
        if (ctx2d) {
          renderFallbackShowroomTurntable(
            ctx2d,
            fallbackCanvas.width,
            fallbackCanvas.height,
            carId,
            paintHex,
            dragStateRef.current.manualYaw,
          );
        }
        fbFrame = requestAnimationFrame(tickFallback);
      };
      fbFrame = requestAnimationFrame(tickFallback);

      return () => {
        fbUnmounted = true;
        cancelAnimationFrame(fbFrame);
        window.removeEventListener('resize', onFallbackResize);
      };
    }

    const renderer = activeRenderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w0, h0);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdcf0fe);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(44, w0 / h0, 0.2, 80);

    // Sunny Daytime 3-Point Showroom Lighting Rig
    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0xbae6fd, 1.25);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.35);
    keyLight.position.set(6, 9, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    // Bright Sky-Daytime Showroom Turntable Plinth
    const plinthGeo = new THREE.CylinderGeometry(4.4, 4.6, 0.16, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.15,
      roughness: 0.42,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.08;

    const ringGeo = new THREE.RingGeometry(4.18, 4.32, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(plinth, ring);

    const shadowTex = createShowroomContactShadow();
    const spec = getCarById(carId);
    const rig: CarRig3D = createRealisticCarRig(spec, paintHex, shadowTex, isSoftwareGl);
    scene.add(rig.group);

    // Frame camera distance cleanly for Bicycle, Electric Quad/Tricycle, Tuk-Tuk, Car, or Heavy 7.4m Truck
    const camDist =
      spec.bodyStyle === 'heavy_truck'
        ? 8.9
        : spec.bodyStyle === 'bicycle'
          ? 3.7
          : spec.bodyStyle === 'tuk_tuk' ||
              spec.bodyStyle === 'electric_quad_trike' ||
              spec.bodyStyle === 'electric_tricycle'
            ? 4.45
            : 5.9;
    const camY =
      spec.bodyStyle === 'heavy_truck'
        ? 2.85
        : spec.bodyStyle === 'bicycle'
          ? 1.55
          : spec.bodyStyle === 'tuk_tuk' ||
              spec.bodyStyle === 'electric_quad_trike' ||
              spec.bodyStyle === 'electric_tricycle'
            ? 1.78
            : 1.85;
    const lookY =
      spec.bodyStyle === 'heavy_truck'
        ? 1.35
        : spec.bodyStyle === 'bicycle'
          ? 0.88
          : 0.78;
    camera.position.set(0, camY, camDist);
    camera.lookAt(0, lookY, 0);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let unmounted = false;
    let prev = performance.now();

    function afterDraw(cb: () => void) {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || gl.isContextLost() || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 32);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const poll = () => {
            if (unmounted) return;
            const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 4);
            } else {
              gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 32);
            }
          };
          frameId = window.setTimeout(poll, 4);
        } else {
          frameId = window.setTimeout(cb, 32);
        }
      } catch {
        frameId = window.setTimeout(cb, 32);
      }
    }

    function tick() {
      if (unmounted) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
      prev = now;

      if (!dragStateRef.current.dragging) {
        dragStateRef.current.manualYaw += dt * 0.45;
      }
      rig.group.rotation.y = dragStateRef.current.manualYaw;
      plinth.rotation.y = dragStateRef.current.manualYaw;

      rig.wheelMeshes.forEach((wm) => {
        wm.rotation.x -= dt * 2.2;
      });
      if (rig.cyclistLegs) {
        const phase = now * 0.005;
        rig.cyclistLegs.crank.rotation.x -= dt * 3.2;
        rig.cyclistLegs.left.rotation.x = -0.35 + Math.sin(phase) * 0.4;
        rig.cyclistLegs.right.rotation.x = -0.35 - Math.sin(phase) * 0.4;
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      rig.dispose();
      shadowTex.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTex.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // Ignore if context already lost
      }
    };
  }, [carId, paintHex]);

  return (
    <div
      onPointerDown={(e) => {
        dragStateRef.current.dragging = true;
        dragStateRef.current.lastX = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!dragStateRef.current.dragging) return;
        const dx = e.clientX - dragStateRef.current.lastX;
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.manualYaw += dx * 0.012;
      }}
      onPointerUp={() => {
        dragStateRef.current.dragging = false;
      }}
      onPointerLeave={() => {
        dragStateRef.current.dragging = false;
      }}
      className="relative w-full h-[270px] sm:h-[300px] rounded-xl overflow-hidden border border-sky-200 bg-[#dcf0fe] cursor-grab active:cursor-grabbing select-none shadow-sm"
    >
      <div ref={mountRef} className="w-full h-full" />
      <div className="pointer-events-none absolute bottom-2.5 right-3 px-2.5 py-1 rounded-md bg-white/85 border border-sky-200 text-[11px] font-medium text-sky-900">
        Arrastra para girar 360°
      </div>
    </div>
  );
};
