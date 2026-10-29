import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DriverState {
  playerId: string;
  alias: string;
  carId: string;
  paintHex: string;
  mapId: string;
  roomCode: string;
  x: number;
  z: number;
  heading: number;
  steerAngle: number;
  speedKmh: number;
  gear: string;
  transmission: 'AT' | 'MT';
  checkpoints: number;
  updatedAt: number;
}

interface ClientJoinPayload {
  type: 'player:join';
  playerId: string;
  alias: string;
  carId: string;
  paintHex: string;
  mapId: string;
  roomCode: string;
  x: number;
  z: number;
  heading: number;
  transmission: 'AT' | 'MT';
}

interface ClientUpdatePayload {
  type: 'player:update';
  playerId: string;
  x: number;
  z: number;
  heading: number;
  steerAngle: number;
  speedKmh: number;
  gear: string;
  carId?: string;
  paintHex?: string;
  alias?: string;
  checkpoints?: number;
}

interface ClientSwitchRoomPayload {
  type: 'player:switch_map';
  playerId: string;
  mapId: string;
  roomCode: string;
  x: number;
  z: number;
  heading: number;
}

type IncomingMessage =
  | ClientJoinPayload
  | ClientUpdatePayload
  | ClientSwitchRoomPayload
  | { type: 'ping' };

const rooms = new Map<string, Map<string, DriverState>>();
const socketMeta = new Map<WebSocket, { roomKey: string; playerId: string }>();

function sanitizeSafeUsername(raw: unknown): string {
  const cleaned = String(raw || '')
    .replace(/[@\d]{5,}/g, '')
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .trim()
    .slice(0, 18);
  return cleaned || 'Piloto';
}

function makeRoomKey(roomCode: string, mapId: string): string {
  const cleanRoom = (roomCode || 'GLOBAL').trim().toUpperCase().slice(0, 20) || 'GLOBAL';
  const cleanMap = (mapId || 'gt_antigua').trim().slice(0, 40);
  return `${cleanRoom}::${cleanMap}`;
}

function getOrCreateRoom(roomKey: string): Map<string, DriverState> {
  let room = rooms.get(roomKey);
  if (!room) {
    room = new Map<string, DriverState>();
    rooms.set(roomKey, room);
  }
  return room;
}

function broadcastToRoom(
  wss: WebSocketServer,
  roomKey: string,
  payload: unknown,
  excludeSocket?: WebSocket,
): void {
  const serialized = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client === excludeSocket || client.readyState !== WebSocket.OPEN) continue;
    const meta = socketMeta.get(client);
    if (meta && meta.roomKey === roomKey) {
      client.send(serialized);
    }
  }
}

function removeSocketFromRoom(wss: WebSocketServer, ws: WebSocket): void {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  socketMeta.delete(ws);
  const room = rooms.get(meta.roomKey);
  if (room && room.has(meta.playerId)) {
    room.delete(meta.playerId);
    broadcastToRoom(wss, meta.roomKey, {
      type: 'player:left',
      playerId: meta.playerId,
    });
    if (room.size === 0) {
      rooms.delete(meta.roomKey);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as IncomingMessage;
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
          }
          return;
        }

        if (msg.type === 'player:join') {
          removeSocketFromRoom(wss, ws);
          const playerId = String(msg.playerId || '').slice(0, 48);
          if (!playerId) return;

          const roomKey = makeRoomKey(msg.roomCode, msg.mapId);
          const room = getOrCreateRoom(roomKey);

          const driver: DriverState = {
            playerId,
            alias: sanitizeSafeUsername(msg.alias),
            carId: String(msg.carId || 'toyota_supra').slice(0, 32),
            paintHex: String(msg.paintHex || '#ef4444').slice(0, 16),
            mapId: String(msg.mapId || 'gt_antigua').slice(0, 40),
            roomCode: (msg.roomCode || 'GLOBAL').trim().toUpperCase().slice(0, 20) || 'GLOBAL',
            x: Number.isFinite(msg.x) ? msg.x : 0,
            z: Number.isFinite(msg.z) ? msg.z : 0,
            heading: Number.isFinite(msg.heading) ? msg.heading : 0,
            steerAngle: 0,
            speedKmh: 0,
            gear: '1',
            transmission: msg.transmission === 'MT' ? 'MT' : 'AT',
            checkpoints: 0,
            updatedAt: Date.now(),
          };

          // Idempotent upsert into authoritative room state
          room.set(playerId, driver);
          socketMeta.set(ws, { roomKey, playerId });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'room:init',
                roomKey,
                players: Array.from(room.values()),
              }),
            );
          }

          broadcastToRoom(
            wss,
            roomKey,
            {
              type: 'player:joined',
              player: driver,
            },
            ws,
          );
          return;
        }

        if (msg.type === 'player:update') {
          const meta = socketMeta.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomKey);
          if (!room) return;
          const existing = room.get(meta.playerId);
          if (!existing) return;

          if (Number.isFinite(msg.x)) existing.x = msg.x;
          if (Number.isFinite(msg.z)) existing.z = msg.z;
          if (Number.isFinite(msg.heading)) existing.heading = msg.heading;
          if (Number.isFinite(msg.steerAngle)) existing.steerAngle = msg.steerAngle;
          if (Number.isFinite(msg.speedKmh)) existing.speedKmh = msg.speedKmh;
          if (typeof msg.gear === 'string') existing.gear = msg.gear.slice(0, 4);
          if (typeof msg.carId === 'string') existing.carId = msg.carId.slice(0, 32);
          if (typeof msg.paintHex === 'string') existing.paintHex = msg.paintHex.slice(0, 16);
          if (typeof msg.alias === 'string' && msg.alias.trim()) {
            existing.alias = sanitizeSafeUsername(msg.alias);
          }
          if (typeof msg.checkpoints === 'number' && Number.isFinite(msg.checkpoints)) {
            existing.checkpoints = msg.checkpoints;
          }
          existing.updatedAt = Date.now();

          broadcastToRoom(
            wss,
            meta.roomKey,
            {
              type: 'player:updated',
              playerId: existing.playerId,
              x: existing.x,
              z: existing.z,
              heading: existing.heading,
              steerAngle: existing.steerAngle,
              speedKmh: existing.speedKmh,
              gear: existing.gear,
              carId: existing.carId,
              paintHex: existing.paintHex,
              alias: existing.alias,
              checkpoints: existing.checkpoints,
            },
            ws,
          );
          return;
        }

        if (msg.type === 'player:switch_map') {
          const meta = socketMeta.get(ws);
          if (!meta) return;
          const prevRoom = rooms.get(meta.roomKey);
          const prevDriver = prevRoom?.get(meta.playerId);
          if (!prevDriver) return;

          removeSocketFromRoom(wss, ws);

          const nextRoomKey = makeRoomKey(msg.roomCode, msg.mapId);
          const nextRoom = getOrCreateRoom(nextRoomKey);
          const movedDriver: DriverState = {
            ...prevDriver,
            mapId: String(msg.mapId || prevDriver.mapId).slice(0, 40),
            roomCode:
              (msg.roomCode || prevDriver.roomCode).trim().toUpperCase().slice(0, 20) || 'GLOBAL',
            x: Number.isFinite(msg.x) ? msg.x : 0,
            z: Number.isFinite(msg.z) ? msg.z : 0,
            heading: Number.isFinite(msg.heading) ? msg.heading : 0,
            speedKmh: 0,
            updatedAt: Date.now(),
          };
          nextRoom.set(movedDriver.playerId, movedDriver);
          socketMeta.set(ws, { roomKey: nextRoomKey, playerId: movedDriver.playerId });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'room:init',
                roomKey: nextRoomKey,
                players: Array.from(nextRoom.values()),
              }),
            );
          }
          broadcastToRoom(
            wss,
            nextRoomKey,
            {
              type: 'player:joined',
              player: movedDriver,
            },
            ws,
          );
        }
      } catch {
        // Ignore malformed packets safely
      }
    });

    ws.on('close', () => {
      removeSocketFromRoom(wss, ws);
    });

    ws.on('error', () => {
      removeSocketFromRoom(wss, ws);
    });
  });

  // Periodic stale session sweep
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [roomKey, room] of rooms.entries()) {
      for (const [pid, state] of room.entries()) {
        if (state.updatedAt < cutoff) {
          room.delete(pid);
          broadcastToRoom(wss, roomKey, { type: 'player:left', playerId: pid });
        }
      }
      if (room.size === 0) rooms.delete(roomKey);
    }
  }, 20_000);

  // Active multiplayer rooms summary API
  app.get('/api/rooms', (_req, res) => {
    const summary: Array<{ roomKey: string; count: number; aliases: string[] }> = [];
    for (const [roomKey, room] of rooms.entries()) {
      summary.push({
        roomKey,
        count: room.size,
        aliases: Array.from(room.values()).map((d) => d.alias),
      });
    }
    res.json({ ok: true, rooms: summary });
  });

  // Safe offline response for legacy road queries (no real-world street fetching)
  app.get('/api/osm-roads', (_req, res) => {
    res.json({ ok: true, cached: true, elements: [] });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`GuateRutas World Sim 3D listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
