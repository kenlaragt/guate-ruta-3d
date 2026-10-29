import { useCallback, useEffect, useRef, useState } from 'react';
import { CarModelId, GearLabel, RemoteOnlinePlayer, SessionMode, TransmissionType } from '../types/game';

interface UseMultiplayerOptions {
  enabled: boolean;
  sessionMode: SessionMode;
  playerId: string;
  alias: string;
  carId: CarModelId;
  paintHex: string;
  mapId: string;
  roomCode: string;
  transmission: TransmissionType;
  spawn: { x: number; z: number; heading: number };
}

export function useMultiplayerRoom(opts: UseMultiplayerOptions) {
  const remotePlayersRef = useRef<Map<string, RemoteOnlinePlayer>>(new Map());
  const [peerList, setPeerList] = useState<RemoteOnlinePlayer[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const syncListSnapshot = useCallback(() => {
    setPeerList(Array.from(remotePlayersRef.current.values()));
  }, []);

  useEffect(() => {
    const active = opts.enabled && opts.sessionMode === 'ONLINE_MULTI';
    if (!active) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
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

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'player:join',
            playerId: opts.playerId,
            alias: opts.alias || 'Piloto',
            carId: opts.carId,
            paintHex: opts.paintHex,
            mapId: opts.mapId,
            roomCode: opts.roomCode || 'GLOBAL',
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
                remotePlayersRef.current.set(p.playerId, p as RemoteOnlinePlayer);
              }
            }
            syncListSnapshot();
          } else if (msg.type === 'player:joined' && msg.player) {
            const p = msg.player as RemoteOnlinePlayer;
            if (p.playerId && p.playerId !== opts.playerId) {
              remotePlayersRef.current.set(p.playerId, p);
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
              x: Number.isFinite(msg.x) ? msg.x : (prev?.x ?? 0),
              z: Number.isFinite(msg.z) ? msg.z : (prev?.z ?? 0),
              heading: Number.isFinite(msg.heading) ? msg.heading : (prev?.heading ?? 0),
              steerAngle: Number.isFinite(msg.steerAngle) ? msg.steerAngle : 0,
              speedKmh: Number.isFinite(msg.speedKmh) ? msg.speedKmh : 0,
              gear: msg.gear || prev?.gear || '1',
              checkpoints: msg.checkpoints ?? prev?.checkpoints ?? 0,
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
        if (!cancelled) {
          reconnectTimerRef.current = window.setTimeout(connect, 1800);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // Refresh roster snapshot periodically for UI speeds/checkpoints
    const uiInterval = window.setInterval(syncListSnapshot, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(uiInterval);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
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
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'player:update',
          playerId: opts.playerId,
          alias: opts.alias,
          carId: opts.carId,
          paintHex: opts.paintHex,
          ...payload,
        }),
      );
    },
    [opts.playerId, opts.alias, opts.carId, opts.paintHex],
  );

  return {
    remotePlayersRef,
    peerList,
    connected,
    sendPositionUpdate,
  };
}
