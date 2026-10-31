import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Globe, Lock, MapPin, Navigation, Search, WifiOff, X } from 'lucide-react';
import { metersToLatLon } from '../data/worldMapsCatalog';
import {
  coarsenPublicTrackCoord,
  scrubLocationAndSensitiveText,
} from '../engine/privacyShield';
import { RemoteOnlinePlayer, WorldMapSpec } from '../types/game';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export interface CustomOnlinePlaceTrack {
  id: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lon: number;
}

interface RealGoogleMapDriveLayerProps {
  enabled: boolean;
  isOnline: boolean;
  mapTypeId: 'hybrid' | 'roadmap';
  activeMap: WorldMapSpec;
  customPlaceTrack: CustomOnlinePlaceTrack | null;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  remotePlayers: RemoteOnlinePlayer[];
  onQuotaExceeded?: () => void;
}

/**
 * Synchronizes the live Google Maps camera with the 3D vehicle's real-time position & heading
 * so ThreeDrivingSimulator (with transparent WebGL alpha) renders the 3D cars directly on top of
 * real satellite/hybrid or roadmap streets!
 */
const MapCameraFollower: React.FC<{
  centerLat: number;
  centerLon: number;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  mapTypeId: 'hybrid' | 'roadmap';
}> = ({ centerLat, centerLon, playerX, playerZ, playerHeading, mapTypeId }) => {
  const map = useMap('online-real-drive-map');

  useEffect(() => {
    if (!map) return;
    // Project 7m ahead of vehicle matching ThreeDrivingSimulator realMapOverlayMode lookAhead(7m)
    const sinH = Math.sin(playerHeading);
    const cosH = Math.cos(playerHeading);
    const lookX = playerX - sinH * 7;
    const lookZ = playerZ - cosH * 7;
    const gps = metersToLatLon(centerLat, centerLon, lookX, lookZ);
    // Convert Three.js heading (0 = North/-Z, +CCW) to Google Maps compass heading (0 = North, +CW degrees)
    const compassDeg = (((-playerHeading * 180) / Math.PI) % 360 + 360) % 360;

    try {
      map.moveCamera({
        center: { lat: gps.lat, lng: gps.lon },
        zoom: 19.2,
        tilt: 57.5,
        heading: compassDeg,
      });
    } catch {
      // Fallback if vector tilt/heading is unsupported on raster tiles
      map.setCenter({ lat: gps.lat, lng: gps.lon });
      map.setZoom(19);
    }
  }, [map, centerLat, centerLon, playerX, playerZ, playerHeading]);

  useEffect(() => {
    if (!map) return;
    try {
      map.setMapTypeId(mapTypeId);
    } catch {
      // Ignore mapTypeId errors during initialization
    }
  }, [map, mapTypeId]);

  return null;
};

export const RealGoogleMapDriveLayer: React.FC<RealGoogleMapDriveLayerProps> = ({
  enabled,
  isOnline,
  mapTypeId,
  activeMap,
  customPlaceTrack,
  playerX,
  playerZ,
  playerHeading,
  remotePlayers,
}) => {
  if (!enabled || !isOnline || !GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const baseLat = customPlaceTrack ? customPlaceTrack.lat : activeMap.centerLat;
  const baseLon = customPlaceTrack ? customPlaceTrack.lon : activeMap.centerLon;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full z-0 overflow-hidden"
      style={{ height: '100%', width: '100%' }}
    >
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="es" region="GT">
        <div style={{ height: '100%', width: '100%' }}>
          <Map
            id="online-real-drive-map"
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: baseLat, lng: baseLon }}
            defaultZoom={19}
            defaultTilt={57.5}
            mapTypeId={mapTypeId}
            disableDefaultUI={true}
            gestureHandling="none"
            keyboardShortcuts={false}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraFollower
              centerLat={baseLat}
              centerLon={baseLon}
              playerX={playerX}
              playerZ={playerZ}
              playerHeading={playerHeading}
              mapTypeId={mapTypeId}
            />

            {/* Show live online peers on the real Google Map as modern AdvancedMarker pins */}
            {remotePlayers.map((peer) => {
              const peerGps = metersToLatLon(baseLat, baseLon, peer.x, peer.z);
              return (
                <AdvancedMarker
                  key={peer.playerId}
                  position={{ lat: peerGps.lat, lng: peerGps.lon }}
                >
                  <div className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-400 text-[10px] font-bold text-amber-300 shadow">
                    {peer.alias}
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>
        </div>
      </APIProvider>
    </div>
  );
};

interface OnlinePlacePickerInnerProps {
  onSelectTrack: (track: CustomOnlinePlaceTrack) => void;
  onQuotaExceeded?: () => void;
  compact?: boolean;
  variant?: 'day' | 'dark';
}

type PlacesLib = NonNullable<ReturnType<typeof useMapsLibrary<'places'>>>;
type PlacesSessionToken = InstanceType<PlacesLib['AutocompleteSessionToken']>;
type PlacesAutocompleteSuggestion = Awaited<
  ReturnType<PlacesLib['AutocompleteSuggestion']['fetchAutocompleteSuggestions']>
>['suggestions'][number];

/**
 * Modern Places API (New) AutocompleteSuggestion + Place.fetchFields custom track selector
 * allowing online players to search and choose ANY real destination or track to drive in 3D!
 */
const OnlinePlacePickerInner: React.FC<OnlinePlacePickerInnerProps> = ({
  onSelectTrack,
  onQuotaExceeded,
  compact = false,
  variant = 'day',
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<PlacesSessionToken | null>(null);
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<PlacesAutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setErrorMsg(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions || []);
      } catch (err) {
        const msg = String(err || '');
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          onQuotaExceeded?.();
        } else {
          setErrorMsg('No se encontraron sugerencias en este momento.');
        }
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [placesLib, query, onQuotaExceeded]);

  const handleChooseSuggestion = useCallback(
    async (suggestion: PlacesAutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        setLoading(true);
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        sessionTokenRef.current = null;
        setSuggestions([]);

        const loc = place.location;
        if (!loc) return;
        const rawLat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
        const rawLon = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
        const lat = coarsenPublicTrackCoord(rawLat);
        const lon = coarsenPublicTrackCoord(rawLon);
        const label =
          scrubLocationAndSensitiveText(
            place.displayName ||
              suggestion.placePrediction.text?.text ||
              'Pista Pública en Línea',
            64,
          ) || 'Pista Pública en Línea';
        const addr = scrubLocationAndSensitiveText(place.formattedAddress || label, 80) || label;
        const cleanId = `pista_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;

        setQuery('');
        onSelectTrack({
          id: cleanId,
          name: label,
          formattedAddress: addr,
          lat,
          lon,
        });
      } catch (err) {
        const msg = String(err || '');
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          onQuotaExceeded?.();
        }
      } finally {
        setLoading(false);
      }
    },
    [placesLib, onSelectTrack, onQuotaExceeded],
  );

  const isDark = variant === 'dark';

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search
          className={`w-3.5 h-3.5 ${
            isDark ? 'text-amber-400' : 'text-sky-600'
          } absolute left-2.5 pointer-events-none`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            compact
              ? 'Buscar otra pista o ciudad real en Google Maps...'
              : 'Buscar otra pista, autódromo o lugar real en Google Maps...'
          }
          className={`w-full pl-8 pr-7 ${compact ? 'py-1.5 text-[11px]' : 'py-2 text-xs'} rounded-lg border focus:outline-none ${
            isDark
              ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-amber-500'
              : 'bg-white border-sky-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            aria-label="Limpiar búsqueda"
            className={`absolute right-2 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading && (
        <div
          className={`text-[11px] mt-1 px-1 ${
            isDark ? 'text-amber-300' : 'text-sky-700 font-medium'
          }`}
        >
          Buscando pistas en Google Maps...
        </div>
      )}
      {errorMsg && (
        <div className={`text-[11px] mt-1 px-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {errorMsg}
        </div>
      )}

      {suggestions.length > 0 && (
        <ul
          className={`mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-2xl z-40 ${
            isDark
              ? 'bg-[#0b101b] border-slate-700 divide-y divide-slate-800'
              : 'bg-white border-sky-200 divide-y divide-sky-100'
          }`}
        >
          {suggestions.map((sug, idx) => {
            const text = sug.placePrediction?.text?.text || 'Destino en Google Maps';
            return (
              <li key={`${text}_${idx}`}>
                <button
                  type="button"
                  onClick={() => void handleChooseSuggestion(sug)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                    isDark
                      ? 'text-slate-100 hover:bg-slate-800'
                      : 'text-slate-800 hover:bg-sky-50'
                  }`}
                >
                  <MapPin
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDark ? 'text-amber-400' : 'text-sky-600'
                    }`}
                  />
                  <span className="truncate">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

interface OnlineRealMapsSelectorProps {
  isOnline: boolean;
  realMapEnabled: boolean;
  realMapTypeId: 'hybrid' | 'roadmap';
  customPlaceTrack: CustomOnlinePlaceTrack | null;
  onToggleRealMap: (enabled: boolean) => void;
  onChangeMapTypeId: (type: 'hybrid' | 'roadmap') => void;
  onSelectCustomPlaceTrack: (track: CustomOnlinePlaceTrack | null) => void;
  onQuotaExceeded?: () => void;
  compact?: boolean;
  variant?: 'day' | 'dark';
}

export const OnlineRealMapsSelector: React.FC<OnlineRealMapsSelectorProps> = ({
  isOnline,
  realMapEnabled,
  realMapTypeId,
  customPlaceTrack,
  onToggleRealMap,
  onChangeMapTypeId,
  onSelectCustomPlaceTrack,
  onQuotaExceeded,
  compact = false,
  variant = 'day',
}) => {
  const isDark = variant === 'dark';

  if (!isOnline) {
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-[11px] flex items-center gap-2 ${
          isDark
            ? 'bg-slate-950 border-slate-800 text-slate-400'
            : 'bg-sky-50 border-sky-200 text-sky-900'
        }`}
      >
        <WifiOff
          className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-sky-600'}`}
        />
        <span>
          Modalidad Local Sin Internet activa: jugando en Circuitos Locales 3D. Activa Con Internet
          para abrir Mapas Reales de Google Maps.
        </span>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border ${
        isDark
          ? realMapEnabled
            ? 'bg-sky-950/30 border-sky-500/70'
            : 'bg-slate-950/90 border-slate-800'
          : realMapEnabled
            ? 'bg-sky-100/70 border-sky-400'
            : 'bg-sky-50/80 border-sky-200'
      } ${compact ? 'p-2.5 space-y-2' : 'p-4 space-y-2.5'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isDark ? 'text-sky-300' : 'text-sky-900'
          }`}
        >
          <Globe className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
          <span>Mapas Reales en Línea (Jugadores Online)</span>
        </div>

        <div
          className={`flex items-center gap-1 p-0.5 rounded-lg border ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-sky-200'
          }`}
        >
          <button
            type="button"
            onClick={() => onToggleRealMap(false)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              !realMapEnabled
                ? 'bg-amber-400 text-slate-950'
                : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Circuito 3D Local
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleRealMap(true);
              onChangeMapTypeId('hybrid');
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              realMapEnabled && realMapTypeId === 'hybrid'
                ? 'bg-sky-600 text-white'
                : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satélite Real
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleRealMap(true);
              onChangeMapTypeId('roadmap');
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              realMapEnabled && realMapTypeId === 'roadmap'
                ? 'bg-sky-600 text-white'
                : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mapa Vial Real
          </button>
        </div>
      </div>

      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="es" region="GT">
        <OnlinePlacePickerInner
          compact={compact}
          variant={variant}
          onQuotaExceeded={onQuotaExceeded}
          onSelectTrack={(track) => {
            onSelectCustomPlaceTrack(track);
            onToggleRealMap(true);
          }}
        />
      </APIProvider>

      {customPlaceTrack && (
        <div
          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${
            isDark
              ? 'bg-sky-950/60 border-sky-700/70 text-sky-100'
              : 'bg-white border-sky-300 text-sky-950'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Navigation
              className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}
            />
            <span className="truncate">
              Pista Real elegida: <strong>{customPlaceTrack.name}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectCustomPlaceTrack(null)}
            className={`underline shrink-0 cursor-pointer ${
              isDark ? 'text-sky-300 hover:text-white' : 'text-sky-700 hover:text-sky-950'
            }`}
          >
            Volver a circuito base
          </button>
        </div>
      )}

      <div
        className={`flex items-center gap-1.5 text-[11px] ${
          isDark ? 'text-emerald-300' : 'text-emerald-800'
        }`}
      >
        <Lock className="w-3 h-3 shrink-0" />
        <span>
          Escudo Anti-Rastreo: solo pistas públicas generales; tu ubicación real nunca se lee ni se
          comparte.
        </span>
      </div>
    </div>
  );
};
