import React, { useEffect, useRef } from 'react';
import { RemoteOnlinePlayer, RoadNode2D, RoadSegmentSpec, WorldMapSpec } from '../types/game';

interface MinimapCanvasProps {
  map: WorldMapSpec;
  extraRoads: RoadSegmentSpec[];
  playerX: number;
  playerZ: number;
  playerHeading: number;
  p2Pos?: { x: number; z: number; heading: number } | null;
  remotePlayers: RemoteOnlinePlayer[];
  activeCheckpoint: RoadNode2D | null;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  map,
  extraRoads,
  playerX,
  playerZ,
  playerHeading,
  p2Pos,
  remotePlayers,
  activeCheckpoint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background radar grid
    ctx.fillStyle = '#090f1a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const scale = 0.34;
    const cx = w / 2;
    const cy = h / 2;

    const toScreen = (wx: number, wz: number) => ({
      sx: cx + (wx - playerX) * scale,
      sy: cy + (wz - playerZ) * scale,
    });

    const allRoads = [...map.roads, ...extraRoads];

    // Draw streets
    for (const seg of allRoads) {
      if (seg.points.length < 2) continue;
      ctx.beginPath();
      seg.points.forEach((pt, idx) => {
        const { sx, sy } = toScreen(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = seg.isMainArtery ? '#64748b' : '#334155';
      ctx.lineWidth = Math.max(2.5, seg.width * scale * 0.65);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (seg.isMainArtery) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Landmarks
    for (const lm of map.landmarks) {
      const { sx, sy } = toScreen(lm.x, lm.z);
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    // Active Checkpoint target
    if (activeCheckpoint) {
      const { sx, sy } = toScreen(activeCheckpoint.x, activeCheckpoint.z);
      const clampedX = Math.max(10, Math.min(w - 10, sx));
      const clampedY = Math.max(10, Math.min(h - 10, sy));
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Online remote players
    for (const rp of remotePlayers) {
      const { sx, sy } = toScreen(rp.x, rp.z);
      if (sx < 4 || sx > w - 4 || sy < 4 || sy > h - 4) continue;
      ctx.fillStyle = rp.paintHex || '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 9px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rp.alias.slice(0, 10), sx, sy - 7);
    }

    // Player 2 dot if Split 2P
    if (p2Pos) {
      const { sx, sy } = toScreen(p2Pos.x, p2Pos.z);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player 1 heading arrow at center
    ctx.save();
    ctx.translate(cx, cy);
    // In Three.js our car forward is (-sin(heading), -cos(heading))
    ctx.rotate(-playerHeading);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#090f1a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }, [map, extraRoads, playerX, playerZ, playerHeading, p2Pos, remotePlayers, activeCheckpoint]);

  return (
    <div className="bg-[#0b101b] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <canvas ref={canvasRef} width={196} height={154} className="block w-[196px] h-[154px]" />
    </div>
  );
};
