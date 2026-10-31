import { randomBytes } from 'crypto';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CustomPlaceTrackPayload {
  id: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lon: number;
}

interface DriverState {
  /** Opaque server-generated peer ID — client tokens & IPs are NEVER exposed to peers */
  publicPeerId: string;
  alias: string;
  carId: string;
  paintHex: string;
  valueMessage?: string;
  mapId: string;
  roomCode: string;
  realMapMode?: boolean;
  customTrack?: CustomPlaceTrackPayload | null;
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
  valueMessage?: string;
  mapId: string;
  roomCode: string;
  realMapMode?: boolean;
  customTrack?: CustomPlaceTrackPayload | null;
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
  valueMessage?: string;
  checkpoints?: number;
}

interface ClientSwitchRoomPayload {
  type: 'player:switch_map';
  playerId: string;
  mapId: string;
  roomCode: string;
  realMapMode?: boolean;
  customTrack?: CustomPlaceTrackPayload | null;
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
const socketMeta = new Map<
  WebSocket,
  { roomKey: string; publicPeerId: string; msgCount: number; windowStart: number }
>();

/**
 * Scrubs any accidental GPS coordinates, IPv4 addresses, emails, or phone digits
 * so players' real locations or personal identifiers are NEVER stored or broadcast.
 */
function scrubSensitiveServerText(raw: unknown, maxLen = 280): string {
  return String(raw || '')
    .replace(/[-+]?\d{1,2}\.\d{3,}\s*[,;/]\s*[-+]?\d{1,3}\.\d{3,}/g, '')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
    .replace(/\+?\d[\d\s\-()]{6,}\d/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeSafeUsername(raw: unknown): string {
  const cleaned = scrubSensitiveServerText(raw, 40)
    .replace(/[@\d]{5,}/g, '')
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .trim()
    .slice(0, 18);
  return cleaned || 'Piloto';
}

function clampCircuitMeters(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(-2500, Math.min(2500, Math.round(num * 100) / 100));
}

/**
 * Coarsens public custom track centers to 2 decimal places (~1.1 km city-level grid)
 * so custom online tracks can NEVER encode or pinpoint any private home or exact location.
 */
function sanitizeCustomTrack(raw: unknown): CustomPlaceTrackPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawLat = Number(obj.lat);
  const rawLon = Number(obj.lon);
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) return null;
  if (rawLat < -85 || rawLat > 85 || rawLon < -180 || rawLon > 180) return null;
  const lat = Math.round(rawLat * 100) / 100;
  const lon = Math.round(rawLon * 100) / 100;
  const id = `pista_${Math.round(lat * 100)}_${Math.round(lon * 100)}`.slice(0, 48);
  const name =
    scrubSensitiveServerText(obj.name || 'Pista Pública en Línea', 64) || 'Pista Pública en Línea';
  const formattedAddress = scrubSensitiveServerText(obj.formattedAddress || name, 80) || name;
  return { id, name, formattedAddress, lat, lon };
}

function makeRoomKey(roomCode: string, mapId: string): string {
  const cleanRoom =
    (roomCode || 'GLOBAL')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 16) || 'GLOBAL';
  const cleanMap =
    (mapId || 'gt_antigua')
      .replace(/[^A-Za-z0-9_\-]/g, '')
      .slice(0, 48) || 'gt_antigua';
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

function toPublicPlayerPayload(d: DriverState) {
  return {
    playerId: d.publicPeerId,
    alias: d.alias,
    carId: d.carId,
    paintHex: d.paintHex,
    valueMessage: d.valueMessage,
    x: d.x,
    z: d.z,
    heading: d.heading,
    steerAngle: d.steerAngle,
    speedKmh: d.speedKmh,
    gear: d.gear,
    checkpoints: d.checkpoints,
  };
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
  if (room && room.has(meta.publicPeerId)) {
    room.delete(meta.publicPeerId);
    broadcastToRoom(wss, meta.roomKey, {
      type: 'player:left',
      playerId: meta.publicPeerId,
    });
    if (room.size === 0) {
      rooms.delete(meta.roomKey);
    }
  }
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta configurar GEMINI_API_KEY en el panel Settings > Secrets de AI Studio.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Error desconocido');
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message:
        'Revisa o selecciona tu clave de API en el panel Settings > Secrets para activar esta función.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Límite de cuota alcanzado. Selecciona una clave con facturación activa en Settings > Secrets.',
    };
  }
  return { status: 500, message: raw.slice(0, 260) };
}

const CURATED_GAME_VALUES_THEMES: Record<string, string> = {
  proteccion_vida:
    'Vibrant sunlit 3D video game animation of Juego de 3D de Carros: colorful sports cars, green electric quad-tricycles, and bicycles driven by smiling 3D avatars slowing down respectfully at a flower-lined crosswalk so families, children, and elders cross safely, lush green mountains, a gentle volcano on the horizon, palm trees, and sparkling moving river water, celebrating protection of human life and safe joyful community.',
  respeto_inclusion:
    'Bright daytime 3D driving game scene in Juego de 3D de Carros: friendly 3D driver avatars in electric tricycles, pickups, and colorful cars waving warmly and giving priority to pedestrians with wheelchairs and diverse abilities along a scenic coastal boulevard with palm trees, flowers, mountains, and rippling turquoise sea, radiating dignity, empathy, inclusion, and respect for every life.',
  hermandad_sin_fronteras:
    'Festive 3D racing game celebration in Juego de 3D de Carros: diverse smiling 3D avatars driving colorful cars, tuk-tuks, bicycles, and electric quad-trikes crossing a golden finish arch together where everyone receives gold medals, surrounded by green mountains, lakes, blooming flowers, and Christ the Redeemer with open arms high on a distant sunny peak, symbolizing unity, peace, and shared joy.',
  juegos_y_vida_sana:
    'Sunny 3D game world of Juego de 3D de Carros: cheerful 3D vehicles, bicycles, and electric tricycles cruising gently beside a park plaza with colorful kites in the blue sky, spinning wooden tops, flowers, green mountains, and a crystal lagoon with moving ripples, celebrating healthy play, friendship, protection, and love for life.',
};

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Strict Zero-Location & Anti-Cracker HTTP Security Headers on EVERY response
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), camera=(), usb=(), bluetooth=(), serial=(), hid=(), ambient-light-sensor=(), microphone=(self)',
    );
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const wssLive = new WebSocketServer({ noServer: true });

  // Route WebSocket upgrades cleanly without reading or logging any client IP address
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost';
      const parsedUrl = new URL(req.url || '/', `http://${host}`);
      if (parsedUrl.pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws);
        });
      } else if (parsedUrl.pathname === '/ws-live') {
        wssLive.handleUpgrade(req, socket, head, (ws) => {
          wssLive.emit('connection', ws);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  // =========================================================================
  // 1. MULTIPLAYER ROOMS WEBSOCKET (/ws) — ZERO IP / ZERO LOCATION / OPAQUE IDs
  // =========================================================================
  wss.on('connection', (ws: WebSocket) => {
    const assignedOpaqueId = `peer_${randomBytes(5).toString('hex')}`;

    ws.on('message', (raw) => {
      try {
        // Anti-flood / anti-cracker rate guard
        const now = Date.now();
        const currentMeta = socketMeta.get(ws);
        if (currentMeta) {
          if (now - currentMeta.windowStart > 1000) {
            currentMeta.windowStart = now;
            currentMeta.msgCount = 1;
          } else {
            currentMeta.msgCount += 1;
            if (currentMeta.msgCount > 45) return;
          }
        }

        const rawStr = String(raw);
        if (rawStr.length > 4096) return;
        const msg = JSON.parse(rawStr) as IncomingMessage;
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', serverTime: now }));
          }
          return;
        }

        if (msg.type === 'player:join') {
          removeSocketFromRoom(wss, ws);

          const roomKey = makeRoomKey(msg.roomCode, msg.mapId);
          const room = getOrCreateRoom(roomKey);

          const driver: DriverState = {
            publicPeerId: assignedOpaqueId,
            alias: sanitizeSafeUsername(msg.alias),
            carId: String(msg.carId || 'cuatrimoto_el').replace(/[^a-z0-9_]/gi, '').slice(0, 32),
            paintHex: String(msg.paintHex || '#16a34a').replace(/[^#a-fA-F0-9]/g, '').slice(0, 9),
            valueMessage: msg.valueMessage
              ? scrubSensitiveServerText(msg.valueMessage, 36)
              : undefined,
            mapId: String(msg.mapId || 'gt_antigua').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 48),
            roomCode:
              (msg.roomCode || 'GLOBAL').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16) ||
              'GLOBAL',
            realMapMode: Boolean(msg.realMapMode),
            customTrack: sanitizeCustomTrack(msg.customTrack),
            x: clampCircuitMeters(msg.x),
            z: clampCircuitMeters(msg.z),
            heading: Number.isFinite(msg.heading) ? msg.heading : 0,
            steerAngle: 0,
            speedKmh: 0,
            gear: '1',
            transmission: msg.transmission === 'MT' ? 'MT' : 'AT',
            checkpoints: 0,
            updatedAt: now,
          };

          room.set(assignedOpaqueId, driver);
          socketMeta.set(ws, {
            roomKey,
            publicPeerId: assignedOpaqueId,
            msgCount: 1,
            windowStart: now,
          });

          if (ws.readyState === WebSocket.OPEN) {
            const otherPeers = Array.from(room.values())
              .filter((p) => p.publicPeerId !== assignedOpaqueId)
              .map(toPublicPlayerPayload);
            ws.send(
              JSON.stringify({
                type: 'room:init',
                roomKey,
                players: otherPeers,
              }),
            );
          }

          broadcastToRoom(
            wss,
            roomKey,
            {
              type: 'player:joined',
              player: toPublicPlayerPayload(driver),
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
          const existing = room.get(meta.publicPeerId);
          if (!existing) return;

          if (Number.isFinite(msg.x)) existing.x = clampCircuitMeters(msg.x);
          if (Number.isFinite(msg.z)) existing.z = clampCircuitMeters(msg.z);
          if (Number.isFinite(msg.heading)) existing.heading = msg.heading;
          if (Number.isFinite(msg.steerAngle)) {
            existing.steerAngle = Math.max(-1.5, Math.min(1.5, msg.steerAngle));
          }
          if (Number.isFinite(msg.speedKmh)) {
            existing.speedKmh = Math.max(0, Math.min(420, msg.speedKmh));
          }
          if (typeof msg.gear === 'string') existing.gear = msg.gear.slice(0, 4);
          if (typeof msg.carId === 'string') {
            existing.carId = msg.carId.replace(/[^a-z0-9_]/gi, '').slice(0, 32);
          }
          if (typeof msg.paintHex === 'string') {
            existing.paintHex = msg.paintHex.replace(/[^#a-fA-F0-9]/g, '').slice(0, 9);
          }
          if (typeof msg.valueMessage === 'string' && msg.valueMessage.trim()) {
            existing.valueMessage = scrubSensitiveServerText(msg.valueMessage, 36);
          }
          if (typeof msg.alias === 'string' && msg.alias.trim()) {
            existing.alias = sanitizeSafeUsername(msg.alias);
          }
          if (typeof msg.checkpoints === 'number' && Number.isFinite(msg.checkpoints)) {
            existing.checkpoints = Math.max(0, Math.min(999, Math.floor(msg.checkpoints)));
          }
          existing.updatedAt = now;

          broadcastToRoom(
            wss,
            meta.roomKey,
            {
              type: 'player:updated',
              ...toPublicPlayerPayload(existing),
            },
            ws,
          );
          return;
        }

        if (msg.type === 'player:switch_map') {
          const meta = socketMeta.get(ws);
          if (!meta) return;
          const prevRoom = rooms.get(meta.roomKey);
          const prevDriver = prevRoom?.get(meta.publicPeerId);
          if (!prevDriver) return;

          removeSocketFromRoom(wss, ws);

          const nextRoomKey = makeRoomKey(msg.roomCode, msg.mapId);
          const nextRoom = getOrCreateRoom(nextRoomKey);
          const movedDriver: DriverState = {
            ...prevDriver,
            mapId: String(msg.mapId || prevDriver.mapId)
              .replace(/[^a-zA-Z0-9_\-]/g, '')
              .slice(0, 48),
            roomCode:
              (msg.roomCode || prevDriver.roomCode)
                .replace(/[^A-Za-z0-9]/g, '')
                .toUpperCase()
                .slice(0, 16) || 'GLOBAL',
            realMapMode:
              msg.realMapMode !== undefined ? Boolean(msg.realMapMode) : prevDriver.realMapMode,
            customTrack:
              msg.customTrack !== undefined
                ? sanitizeCustomTrack(msg.customTrack)
                : prevDriver.customTrack,
            x: clampCircuitMeters(msg.x),
            z: clampCircuitMeters(msg.z),
            heading: Number.isFinite(msg.heading) ? msg.heading : 0,
            speedKmh: 0,
            updatedAt: now,
          };
          nextRoom.set(movedDriver.publicPeerId, movedDriver);
          socketMeta.set(ws, {
            roomKey: nextRoomKey,
            publicPeerId: movedDriver.publicPeerId,
            msgCount: 1,
            windowStart: now,
          });

          if (ws.readyState === WebSocket.OPEN) {
            const otherPeers = Array.from(nextRoom.values())
              .filter((p) => p.publicPeerId !== movedDriver.publicPeerId)
              .map(toPublicPlayerPayload);
            ws.send(
              JSON.stringify({
                type: 'room:init',
                roomKey: nextRoomKey,
                players: otherPeers,
              }),
            );
          }
          broadcastToRoom(
            wss,
            nextRoomKey,
            {
              type: 'player:joined',
              player: toPublicPlayerPayload(movedDriver),
            },
            ws,
          );
        }
      } catch {
        // Ignore malformed packets safely without logging client metadata
      }
    });

    ws.on('close', () => {
      removeSocketFromRoom(wss, ws);
    });

    ws.on('error', () => {
      removeSocketFromRoom(wss, ws);
    });
  });

  // =========================================================================
  // 2. REAL-TIME VOICE CONVERSATIONS (/ws-live) — gemini-3.8-live (Live API)
  // =========================================================================
  wssLive.on('connection', (clientWs: WebSocket) => {
    let closed = false;
    let liveSessionRef: { close: () => void } | null = null;

    let ai: GoogleGenAI;
    try {
      ai = getGenAIClient();
    } catch (err) {
      const formatted = formatGeminiError(err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: formatted.message }));
      }
      clientWs.close();
      return;
    }

    const sessionPromise = ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction:
          'Eres el Copiloto de Valores, Protección y Cuidado de la Vida de "Juego de 3D de Carros". ' +
          'Conversa siempre en español con tono cálido, juvenil, alegre y respetuoso. ' +
          'Habla sobre las pistas escénicas 3D del juego (montañas, volcanes, ríos, mares, monumentos culturales como el Cristo Redentor), ' +
          'los vehículos (carros, cuatrimotos eléctricas, triciclos eléctricos, bicicletas, pickups), los juegos tradicionales de los siglos XIX y XX, ' +
          'el respeto e inclusión hacia personas con discapacidad o distintos espectros cognitivos, la hermandad intercultural y el cuidado sagrado de la vida en el camino. ' +
          'REGLA DE SEGURIDAD ABSOLUTA: Jamás pidas ni repitas ubicaciones reales, direcciones, teléfonos ni datos personales de ningún jugador; ' +
          'recuerda siempre que en este juego la ubicación real de los jugadores está 100% protegida y nunca se comparte con nadie.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (closed || clientWs.readyState !== WebSocket.OPEN) return;
          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            clientWs.send(
              JSON.stringify({
                inputTranscript: scrubSensitiveServerText(content.inputTranscription.text, 240),
              }),
            );
          }
          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({
                outputTranscript: scrubSensitiveServerText(content.outputTranscription.text, 320),
              }),
            );
          }
          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }
          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onerror: (err: unknown) => {
          if (!closed && clientWs.readyState === WebSocket.OPEN) {
            const formatted = formatGeminiError(err);
            clientWs.send(JSON.stringify({ error: formatted.message }));
          }
        },
        onclose: () => {
          if (!closed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        },
      },
    });

    sessionPromise
      .then((session) => {
        liveSessionRef = session;
        if (closed) {
          session.close();
          return;
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ ready: true }));
        }
      })
      .catch((err) => {
        if (!closed && clientWs.readyState === WebSocket.OPEN) {
          const formatted = formatGeminiError(err);
          clientWs.send(JSON.stringify({ error: formatted.message }));
          clientWs.close();
        }
      });

    clientWs.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as { audio?: string; text?: string };
        if (parsed.audio && typeof parsed.audio === 'string') {
          sessionPromise
            .then((session) => {
              if (!closed) {
                session.sendRealtimeInput({
                  audio: { data: parsed.audio!, mimeType: 'audio/pcm;rate=16000' },
                });
              }
            })
            .catch(() => {});
        } else if (parsed.text && typeof parsed.text === 'string') {
          const safeText = scrubSensitiveServerText(parsed.text, 260);
          if (safeText) {
            sessionPromise
              .then((session) => {
                if (!closed) {
                  session.sendRealtimeInput({ text: safeText });
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        // Ignore malformed audio frame
      }
    });

    const cleanupLive = () => {
      if (closed) return;
      closed = true;
      if (liveSessionRef) {
        try {
          liveSessionRef.close();
        } catch {
          // Ignore close errors
        }
        liveSessionRef = null;
      }
    };

    clientWs.on('close', cleanupLive);
    clientWs.on('error', cleanupLive);
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

  // =========================================================================
  // 3. AUDIO TRANSCRIPTION ENDPOINT — gemini-3.5-transcribe
  // =========================================================================
  app.post('/api/audio/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
      };
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ ok: false, error: 'No se recibió audio para transcribir.' });
        return;
      }
      const cleanMime =
        typeof mimeType === 'string' && mimeType.startsWith('audio/')
          ? mimeType.split(';')[0]
          : 'audio/webm';

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe este audio con precisión en el idioma hablado. Devuelve únicamente el texto transcrito.',
            },
          ],
        },
      });

      const transcript = scrubSensitiveServerText(response.text ?? '', 420);
      res.json({ ok: true, transcript });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ ok: false, error: formatted.message });
    }
  });

  // =========================================================================
  // 4. GAME, VALUES, PROTECTION & LIFE VIDEO GENERATION — gemini-omni-1.1-flash
  //    (Supports Uploaded EXIF-Scrubbed Photos + 16:9 / 9:16 Aspect Ratios)
  // =========================================================================
  app.post('/api/videos/generate', async (req, res) => {
    try {
      const { prompt, themeId, aspectRatio, imageBase64, imageMimeType } = (req.body || {}) as {
        prompt?: string;
        themeId?: string;
        aspectRatio?: '16:9' | '9:16';
        imageBase64?: string;
        imageMimeType?: string;
      };

      const validAspect: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const baseTheme =
        (themeId && CURATED_GAME_VALUES_THEMES[themeId]) ||
        CURATED_GAME_VALUES_THEMES.proteccion_vida;
      const userAddition = scrubSensitiveServerText(prompt || '', 260);

      const safeValuesPrompt = userAddition
        ? `${baseTheme} Additional scene focus related to the 3D driving game, positive human values, protection, and care for life: ${userAddition}. Bright daytime family-friendly 3D video game cinematography, fictional scenic track, zero personal data or real private addresses.`
        : `${baseTheme} Bright daytime family-friendly 3D video game cinematography, smooth camera motion, vibrant colors.`;

      const ai = getGenAIClient();

      const inputPayload =
        imageBase64 && typeof imageBase64 === 'string'
          ? [
              {
                type: 'image' as const,
                mime_type:
                  typeof imageMimeType === 'string' && imageMimeType.startsWith('image/')
                    ? imageMimeType
                    : 'image/jpeg',
                data: imageBase64,
              },
              {
                type: 'text' as const,
                text: `Animate this image into a joyful 3D driving game video celebrating positive values, mutual protection, road respect, and love for life: ${safeValuesPrompt}`,
              },
            ]
          : safeValuesPrompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspect,
            duration: '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 },
      );

      let videoData: string | undefined = interaction.output_video?.data;
      let videoMime = interaction.output_video?.mime_type || 'video/mp4';
      let videoUri: string | undefined = interaction.output_video?.uri;

      if (!videoData && Array.isArray(interaction.steps)) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const c of step.content) {
              if (c.type === 'video') {
                if ('data' in c && typeof c.data === 'string') videoData = c.data;
                if ('mime_type' in c && typeof c.mime_type === 'string') videoMime = c.mime_type;
                if ('uri' in c && typeof c.uri === 'string') videoUri = c.uri;
              }
            }
          }
        }
      }

      if (!videoData && videoUri) {
        const videoResp = await fetch(videoUri);
        if (videoResp.ok) {
          const arrBuf = await videoResp.arrayBuffer();
          videoData = Buffer.from(arrBuf).toString('base64');
          videoMime = videoResp.headers.get('content-type') || videoMime;
        }
      }

      if (!videoData) {
        res.status(502).json({
          ok: false,
          error: 'No se pudo obtener el flujo de video generado. Intenta nuevamente.',
        });
        return;
      }

      res.json({
        ok: true,
        videoBase64: videoData,
        mimeType: videoMime,
        aspectRatio: validAspect,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ ok: false, error: formatted.message });
    }
  });

  // Active multiplayer rooms summary API (sanitized — zero IPs, zero player tokens, coarse public tracks only)
  app.get('/api/rooms', (_req, res) => {
    const summary: Array<{
      roomKey: string;
      count: number;
      aliases: string[];
      realMapMode?: boolean;
      customTrack?: CustomPlaceTrackPayload | null;
    }> = [];
    for (const [roomKey, room] of rooms.entries()) {
      const drivers = Array.from(room.values());
      const firstWithTrack = drivers.find((d) => d.customTrack) || drivers[0];
      summary.push({
        roomKey,
        count: room.size,
        aliases: drivers.slice(0, 8).map((d) => d.alias),
        realMapMode: drivers.some((d) => d.realMapMode),
        customTrack: firstWithTrack?.customTrack ?? null,
      });
    }
    res.json({ ok: true, rooms: summary });
  });

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
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Juego de 3D de Carros listening locally on http://0.0.0.0:${PORT}`);
  });
}

startServer();
