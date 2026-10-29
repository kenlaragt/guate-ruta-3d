import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getCarById } from '../data/carsCatalog';
import { CarRig3D, createRealisticCarRig } from '../engine/models3d';
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

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    const w0 = container.clientWidth || 560;
    const h0 = container.clientHeight || 280;
    renderer.setSize(w0, h0);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b111e);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(44, w0 / h0, 0.2, 80);

    // 3-Point Showroom Lighting Rig
    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 0.9);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(6, 8, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-7, 4, -6);
    scene.add(rimLight);

    // Showroom Turntable Plinth
    const plinthGeo = new THREE.CylinderGeometry(4.4, 4.6, 0.16, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x131c2e,
      metalness: 0.45,
      roughness: 0.35,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.08;

    const ringGeo = new THREE.RingGeometry(4.18, 4.32, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(plinth, ring);

    const shadowTex = createShowroomContactShadow();
    const spec = getCarById(carId);
    const rig: CarRig3D = createRealisticCarRig(spec, paintHex, shadowTex, isSoftwareGl);
    scene.add(rig.group);

    // Frame camera distance cleanly for Bicycle, Tuk-Tuk, Car, or Heavy 7.4m Truck
    const camDist =
      spec.bodyStyle === 'heavy_truck'
        ? 8.9
        : spec.bodyStyle === 'bicycle'
          ? 3.7
          : spec.bodyStyle === 'tuk_tuk'
            ? 4.6
            : 5.9;
    const camY =
      spec.bodyStyle === 'heavy_truck'
        ? 2.85
        : spec.bodyStyle === 'bicycle'
          ? 1.55
          : spec.bodyStyle === 'tuk_tuk'
            ? 1.75
            : 1.85;
    const lookY =
      spec.bodyStyle === 'heavy_truck'
        ? 1.35
        : spec.bodyStyle === 'bicycle'
          ? 0.88
          : 0.72;
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
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
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
      className="relative w-full h-[270px] sm:h-[300px] rounded-xl overflow-hidden border border-slate-800 bg-[#0b111e] cursor-grab active:cursor-grabbing select-none"
    >
      <div ref={mountRef} className="w-full h-full" />
      <div className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] text-slate-400">
        Arrastra para girar 360°
      </div>
    </div>
  );
};
