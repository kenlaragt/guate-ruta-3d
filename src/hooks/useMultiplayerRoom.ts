import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CarModelId,
  GearLabel,
  RemoteOnlinePlayer,
  SessionMode,
  TransmissionType,
} from '../types/game';

import { CustomOnlinePlaceTrack } from '../components/RealGoogleMapDriveLayer';
import { scrubLocationAndSensitiveText } from '../engine/privacyShield';

interface UseMultiplayerOptions {
  enabled: boolean;
  sessionMode: SessionMode;
  playerId: string;
  alias: string;
  carId: CarModelId;
  paintHex: string;
  valueMessage?: string;
  mapId: string;
  roomCode: string;
  realMapMode?: boolean;
  customTrack?: CustomOnlinePlaceTrack | null;
  forceOffline?: boolean;
  transmission: TransmissionType;
  spawn: { x: number; z: number; heading: number };
}

interface LocalBroadcastPacket {
  type: 'local:update' | 'local:leave';
  roomKey: string;
  player?: RemoteOnlinePlayer & { updatedAt?: number };
  playerId: string;
}

export function useMultiplayerRoom(opts: UseMultiplayerOptions) {
  const remotePlayersRef = useRef<Map<string, RemoteOnlinePlayer & { updatedAt?: number }>>(
    new Map(),
  );
  const [peerList, setPeerList] = useState<RemoteOnlinePlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const roomKey = `${(opts.roomCode || 'PISTA1').trim().toUpperCase()}::${opts.mapId}`;

  const syncListSnapshot = useCallback(() => {
    const now = Date.now();
    for (const [pid, peer] of remotePlayersRef.current.entries()) {
      if (peer.updatedAt && now - peer.updatedAt > 15_000) {
        remotePlayersRef.current.delete(pid);
      }
    }
    setPeerList(Array.from(remotePlayersRef.current.values()));
  }, []);

  useEffect(() => {
    const active = opts.enabled && opts.sessionMode === 'ONLINE_MULTI';
    if (!active) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (bcRef.current) {
        bcRef.current.close();
        bcRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      remotePlayersRef.current.clear();
      setPeerList([]);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let backoffMs = 2200;

    // Local Offline BroadcastChannel Fallback (syncs local browser windows/tabs with 0 internet)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('carros3d_local_room_v1');
        bcRef.current = bc;
        bc.onmessage = (evt: MessageEvent<LocalBroadcastPacket>) => {
          const pkt = evt.data;
          if (!pkt || pkt.roomKey !== roomKey || pkt.playerId === opts.playerId) return;
          if (pkt.type === 'local:leave') {
            if (remotePlayersRef.current.delete(pkt.playerId)) {
              syncListSnapshot();
            }
          } else if (pkt.type === 'local:update' && pkt.player) {
            const hadPeer = remotePlayersRef.current.has(pkt.playerId);
            remotePlayersRef.current.set(pkt.playerId, {
              ...pkt.player,
              updatedAt: Date.now(),
            });
            if (!hadPeer) {
              syncListSnapshot();
            }
          }
        };
      } catch {
        // Safely ignore if BroadcastChannel is unavailable
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || opts.forceOffline) return;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      // Pause noisy reconnect loops when device has no network interface
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      reconnectTimerRef.current = window.setTimeout(connect, backoffMs);
      backoffMs = Math.min(12_000, Math.round(backoffMs * 1.6));
    };

    const connect = () => {
      if (cancelled || opts.forceOffline) {
        setConnected(false);
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnected(false);
        return;
      }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/ws`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          backoffMs = 2200;
          setConnected(true);
          ws.send(
            JSON.stringify({
              type: 'player:join',
              playerId: opts.playerId,
              alias: scrubLocationAndSensitiveText(opts.alias || 'Piloto', 18) || 'Piloto',
              carId: opts.carId,
              paintHex: opts.paintHex,
              valueMessage: opts.valueMessage
                ? scrubLocationAndSensitiveText(opts.valueMessage, 36)
                : undefined,
              mapId: opts.mapId,
              roomCode: opts.roomCode || 'GLOBAL',
              realMapMode: Boolean(opts.realMapMode),
              customTrack: opts.customTrack || null,
              x: opts.spawn.x,
              z: opts.spawn.z,
              heading: opts.spawn.heading,
              transmission: opts.transmission,
            }),
          );
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(String(evt.data));
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'room:init' && Array.isArray(msg.players)) {
              remotePlayersRef.current.clear();
              for (const p of msg.players) {
                if (p.playerId && p.playerId !== opts.playerId) {
                  remotePlayersRef.current.set(p.playerId, {
                    ...(p as RemoteOnlinePlayer),
                    updatedAt: Date.now(),
                  });
                }
              }
              syncListSnapshot();
            } else if (msg.type === 'player:joined' && msg.player) {
              const p = msg.player as RemoteOnlinePlayer;
              if (p.playerId && p.playerId !== opts.playerId) {
                remotePlayersRef.current.set(p.playerId, { ...p, updatedAt: Date.now() });
                syncListSnapshot();
              }
            } else if (msg.type === 'player:updated' && msg.playerId) {
              if (msg.playerId === opts.playerId) return;
              const prev = remotePlayersRef.current.get(msg.playerId);
              remotePlayersRef.current.set(msg.playerId, {
                playerId: msg.playerId,
                alias: msg.alias || prev?.alias || 'Piloto',
                carId: msg.carId || prev?.carId || 'toyota_supra',
                paintHex: msg.paintHex || prev?.paintHex || '#ef4444',
                valueMessage: msg.valueMessage || prev?.valueMessage,
                x: Number.isFinite(msg.x) ? msg.x : (prev?.x ?? 0),
                z: Number.isFinite(msg.z) ? msg.z : (prev?.z ?? 0),
                heading: Number.isFinite(msg.heading) ? msg.heading : (prev?.heading ?? 0),
                steerAngle: Number.isFinite(msg.steerAngle) ? msg.steerAngle : 0,
                speedKmh: Number.isFinite(msg.speedKmh) ? msg.speedKmh : 0,
                gear: msg.gear || prev?.gear || '1',
                checkpoints: msg.checkpoints ?? prev?.checkpoints ?? 0,
                updatedAt: Date.now(),
              });
            } else if (msg.type === 'player:left' && msg.playerId) {
              if (remotePlayersRef.current.delete(msg.playerId)) {
                syncListSnapshot();
              }
            }
          } catch {
            // Ignore malformed packet
          }
        };

        ws.onclose = () => {
          setConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        setConnected(false);
        scheduleReconnect();
      }
    };

    const handleOnline = () => {
      backoffMs = 1500;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    connect();

    const uiInterval = window.setInterval(syncListSnapshot, 1200);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.clearInterval(uiInterval);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            type: 'local:leave',
            roomKey,
            playerId: opts.playerId,
          } satisfies LocalBroadcastPacket);
          bcRef.current.close();
        } catch {
          // Ignore close errors
        }
        bcRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    opts.enabled,
    opts.sessionMode,
    opts.playerId,
    opts.mapId,
    opts.roomCode,
    opts.realMapMode,
    opts.customTrack,
    opts.forceOffline,
    roomKey,
    syncListSnapshot,
  ]);

  const sendPositionUpdate = useCallback(
    (payload: {
      x: number;
      z: number;
      heading: number;
      steerAngle: number;
      speedKmh: number;
      gear: GearLabel;
      checkpoints: number;
    }) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'player:update',
            playerId: opts.playerId,
            alias: opts.alias,
            carId: opts.carId,
            paintHex: opts.paintHex,
            valueMessage: opts.valueMessage,
            ...payload,
          }),
        );
        return;
      }

      // Offline / local fallback: broadcast to any local windows/tabs in the same room
      const bc = bcRef.current;
      if (bc) {
        try {
          bc.postMessage({
            type: 'local:update',
            roomKey,
            playerId: opts.playerId,
            player: {
              playerId: opts.playerId,
              alias: scrubLocationAndSensitiveText(opts.alias || 'Piloto', 18) || 'Piloto',
              carId: opts.carId,
              paintHex: opts.paintHex,
              valueMessage: opts.valueMessage
                ? scrubLocationAndSensitiveText(opts.valueMessage, 36)
                : undefined,
              ...payload,
            },
          } satisfies LocalBroadcastPacket);
        } catch {
          // Ignore broadcast errors
        }
      }
    },
    [opts.playerId, opts.alias, opts.carId, opts.paintHex, opts.valueMessage, roomKey],
  );

  return {
    remotePlayersRef,
    peerList,
    connected,
    sendPositionUpdate,
  };
}
