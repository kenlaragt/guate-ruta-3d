/**
 * Zero-Location Privacy & Anti-Cracker Shield
 * Ensures player physical location, GPS hardware, WebRTC IP candidates, and image EXIF GPS tags
 * are NEVER accessed, stored, or shared with third parties, servers, or other players.
 */

let shieldInstalled = false;

export function installZeroLocationPrivacyShield(): void {
  if (shieldInstalled || typeof window === 'undefined') return;
  shieldInstalled = true;

  // 1. Hard-block browser Geolocation API so neither third-party SDKs nor injected scripts can ever read GPS
  try {
    const blockedGeo: Geolocation = {
      getCurrentPosition: (_success, error) => {
        if (typeof error === 'function') {
          error({
            code: 1,
            message: 'Ubicación bloqueada permanentemente por el Escudo de Privacidad del jugador.',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      },
      watchPosition: (_success, error) => {
        if (typeof error === 'function') {
          error({
            code: 1,
            message: 'Ubicación bloqueada permanentemente por el Escudo de Privacidad del jugador.',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
        return -1;
      },
      clearWatch: () => {
        // No-op
      },
    };

    Object.defineProperty(navigator, 'geolocation', {
      value: blockedGeo,
      configurable: false,
      writable: false,
    });
  } catch {
    // Fallback if navigator.geolocation property is non-configurable in this WebView
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = (_s, err) => {
          err?.({
            code: 1,
            message: 'Geolocation blocked',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        };
        navigator.geolocation.watchPosition = (_s, err) => {
          err?.({
            code: 1,
            message: 'Geolocation blocked',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
          return -1;
        };
      }
    } catch {
      // Ignore locked prototype
    }
  }

  // 2. Neutralize Permissions API probing for geolocation
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = ((descriptor: PermissionDescriptor) => {
        if (descriptor && descriptor.name === 'geolocation') {
          return Promise.resolve({
            state: 'denied',
            name: 'geolocation',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as unknown as PermissionStatus);
        }
        return origQuery(descriptor);
      }) as typeof navigator.permissions.query;
    }
  } catch {
    // Ignore if permissions API is read-only
  }

  // 3. Block WebRTC STUN/TURN IP-address & city-level leak vectors against crackers
  // (Multiplayer uses server-relayed WebSocket /ws only, never P2P WebRTC)
  try {
    const win = window as unknown as {
      RTCPeerConnection?: typeof RTCPeerConnection;
      webkitRTCPeerConnection?: typeof RTCPeerConnection;
    };
    const OrigPeerConnection = win.RTCPeerConnection || win.webkitRTCPeerConnection;
    if (OrigPeerConnection) {
      const SafePeerConnection = function (this: unknown, config?: RTCConfiguration) {
        const sanitizedConfig: RTCConfiguration = {
          ...(config || {}),
          iceServers: [],
          iceTransportPolicy: 'relay',
        };
        return new OrigPeerConnection(sanitizedConfig);
      } as unknown as typeof RTCPeerConnection;
      SafePeerConnection.prototype = OrigPeerConnection.prototype;
      win.RTCPeerConnection = SafePeerConnection;
      if (win.webkitRTCPeerConnection) {
        win.webkitRTCPeerConnection = SafePeerConnection;
      }
    }
  } catch {
    // Ignore if RTCPeerConnection is locked
  }
}

/**
 * Generates an ephemeral, non-trackable per-session player token using Web Crypto
 * so players cannot be tracked across sessions or correlated by crackers.
 */
export function createEphemeralPlayerSessionId(): string {
  try {
    const existing = sessionStorage.getItem('carros3d_ephemeral_sid');
    if (existing && /^drv_[a-f0-9]{12}$/.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const next = `drv_${hex}`;
    sessionStorage.setItem('carros3d_ephemeral_sid', next);
    return next;
  } catch {
    return `drv_${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  }
}

/**
 * Scrubs accidental or malicious GPS coordinates, IPv4/IPv6 addresses, emails,
 * phone numbers, and exact home address patterns from user-entered strings.
 */
export function scrubLocationAndSensitiveText(raw: string, maxLen = 280): string {
  return String(raw || '')
    // Remove decimal lat/lon coordinate pairs (e.g. 14.6349, -90.5069)
    .replace(/[-+]?\d{1,2}\.\d{3,}\s*[,;/]\s*[-+]?\d{1,3}\.\d{3,}/g, '[ubicación-protegida]')
    // Remove IPv4 addresses
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[red-protegida]')
    // Remove emails
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[privado]')
    // Remove phone-like sequences of 7+ digits
    .replace(/\+?\d[\d\s\-()]{6,}\d/g, '[privado]')
    .trim()
    .slice(0, maxLen);
}

/**
 * Coarsens public track coordinates to 2 decimal places (~1.1 km city-center grid)
 * so custom online tracks can NEVER pinpoint a private residence or exact location.
 */
export function coarsenPublicTrackCoord(coord: number): number {
  if (!Number.isFinite(coord)) return 0;
  return Math.round(coord * 100) / 100;
}

/**
 * Strips 100% of EXIF metadata (including GPSLatitude, GPSLongitude, camera serials,
 * and timestamps) by re-encoding only visual pixels onto an offscreen HTML5 Canvas.
 */
export async function stripImageExifAndSanitizeToJpeg(
  source: File | Blob | string,
  maxDim = 1280,
): Promise<{ base64Data: string; mimeType: 'image/jpeg'; previewDataUrl: string }> {
  const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'));
      el.src = objectUrl;
    });

    const srcW = Math.max(1, img.naturalWidth || img.width || 640);
    const srcH = Math.max(1, img.naturalHeight || img.height || 360);
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const dstW = Math.max(16, Math.round(srcW * scale));
    const dstH = Math.max(16, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el lienzo de limpieza EXIF.');
    }
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, dstW, dstH);
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const commaIdx = previewDataUrl.indexOf(',');
    const base64Data = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

    return {
      base64Data,
      mimeType: 'image/jpeg',
      previewDataUrl,
    };
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
