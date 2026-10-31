import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Film,
  Heart,
  Image as ImageIcon,
  Lock,
  Mic,
  MicOff,
  Pause,
  PhoneCall,
  PhoneOff,
  Play,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  scrubLocationAndSensitiveText,
  stripImageExifAndSanitizeToJpeg,
} from '../engine/privacyShield';

interface ValuesVideoAndVoiceStudioProps {
  coverArtUrl: string;
  isOnline: boolean;
}

type VideoAspectRatio = '16:9' | '9:16';

type CuratedThemeId =
  | 'proteccion_vida'
  | 'respeto_inclusion'
  | 'hermandad_sin_fronteras'
  | 'juegos_y_vida_sana';

interface LocalAnimatedEpisode {
  id: CuratedThemeId;
  numberLabel: string;
  title: string;
  pillarBadge: string;
  summary: string;
  skyTop: string;
  skyBottom: string;
  accentHex: string;
  vehicleLabel: string;
  valueBanner: string;
  captions: [string, string, string];
}

const LOCAL_GAME_VALUES_EPISODES: LocalAnimatedEpisode[] = [
  {
    id: 'proteccion_vida',
    numberLabel: 'Episodio 1',
    title: 'Protección de la Vida en la Vía y Escudo Digital',
    pillarBadge: 'Protección y Vida',
    summary:
      'En cada pista 3D, frenar a tiempo ante el paso peatonal cuida la vida humana, mientras el Escudo Cero-Ubicación protege a los jugadores frente a terceros y crackers.',
    skyTop: '#0284c7',
    skyBottom: '#bae6fd',
    accentHex: '#16a34a',
    vehicleLabel: 'Cuatrimoto Eléctrica 3D',
    valueBanner: 'Cuidar la Vida es Primero',
    captions: [
      'En Juego de 3D de Carros cada cruce peatonal recuerda que toda vida es sagrada.',
      'Avatares 3D reducen la velocidad con respeto para proteger a familias, niñas, niños y mayores.',
      'Y en el mundo digital tu ubicación real jamás se entrega a terceros, servidores ni crackers.',
    ],
  },
  {
    id: 'respeto_inclusion',
    numberLabel: 'Episodio 2',
    title: 'Empatía, Inclusión y Apoyo en Cada Camino',
    pillarBadge: 'Inclusión y Dignidad',
    summary:
      'Triciclos eléctricos, bicicletas y carros comparten el bulevar costero apoyando con respeto a personas con discapacidad y distintos espectros cognitivos.',
    skyTop: '#0369a1',
    skyBottom: '#e0f2fe',
    accentHex: '#0284c7',
    vehicleLabel: 'Triciclo Eléctrico Solar 3D',
    valueBanner: 'Empatía e Inclusión Vial',
    captions: [
      'Cada persona avanza a su propio ritmo y merece respeto, paciencia y apoyo genuino.',
      'Los letreros viales del juego invitan a cuidar a personas con discapacidad y neurodivergencia.',
      'Cuando conducimos con empatía, la pista se convierte en una comunidad segura para todos.',
    ],
  },
  {
    id: 'hermandad_sin_fronteras',
    numberLabel: 'Episodio 3',
    title: 'Hermandad Intercultural · Todos Somos Ganadores',
    pillarBadge: 'Respeto Intercultural',
    summary:
      'Bajo montañas, ríos en movimiento y el Cristo Redentor con los brazos abiertos, pilotos de todas las culturas se guían juntos hacia la meta y todos reciben medalla.',
    skyTop: '#0ea5e9',
    skyBottom: '#fef3c7',
    accentHex: '#f59e0b',
    vehicleLabel: 'Deportivo 3D · Todos Ganan',
    valueBanner: 'Hermandad Sin Fronteras',
    captions: [
      'Diferentes culturas, pueblos y colores unidos en una misma pista luminosa de paz.',
      'En la Carrera Add Time de 4 minutos nos guiamos mutuamente hacia la meta sin excluir a nadie.',
      'Al cruzar el arco dorado todos reciben medalla: proteger la vida nos hace ganadores a todos.',
    ],
  },
  {
    id: 'juegos_y_vida_sana',
    numberLabel: 'Episodio 4',
    title: 'Juegos Tradicionales, Naturaleza y Alegría de Vivir',
    pillarBadge: 'Vida Sana y Cultura',
    summary:
      'Barriletes, trompos y rayuela de los siglos XIX y XX acompañan lagunas cristalinas, volcanes y flores para celebrar la amistad y la vida sana.',
    skyTop: '#0284c7',
    skyBottom: '#d9f99d',
    accentHex: '#059669',
    vehicleLabel: 'Bicicleta y Carros Escénicos 3D',
    valueBanner: 'Alegría, Cultura y Vida',
    captions: [
      'Recordar la rayuela, el trompo, las canicas y el barrilete conecta generaciones con alegría.',
      'Montañas verdes, volcanes, palmeras y ríos en movimiento celebran la belleza de la vida.',
      'Jugar en comunidad con valores fortalece el corazón y protege el bienestar de todos.',
    ],
  },
];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export const ValuesVideoAndVoiceStudio: React.FC<ValuesVideoAndVoiceStudioProps> = ({
  coverArtUrl,
  isOnline,
}) => {
  // =========================================================================
  // 1. LOCAL + ONLINE ANIMATED GAME & VALUES VIDEO PLAYER STATE
  // =========================================================================
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState<number>(0);
  const [episodePlaying, setEpisodePlaying] = useState<boolean>(true);
  const [episodeChimeMuted, setEpisodeChimeMuted] = useState<boolean>(true);
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [activeCaptionIndex, setActiveCaptionIndex] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chimeCtxRef = useRef<AudioContext | null>(null);

  const activeEpisode = LOCAL_GAME_VALUES_EPISODES[selectedEpisodeIdx] || LOCAL_GAME_VALUES_EPISODES[0];

  // =========================================================================
  // 2. PHOTO-TO-VIDEO GENERATOR (gemini-omni-1.1-flash) + AUDIO TRANSCRIPTION (gemini-3.5-transcribe)
  // =========================================================================
  const [selectedThemeId, setSelectedThemeId] = useState<CuratedThemeId>('proteccion_vida');
  const [customVideoPrompt, setCustomVideoPrompt] = useState<string>(
    'Carros 3D y cuatrimotos eléctricas respetando la vida en un paisaje soleado con montañas, río en movimiento y avatares sonrientes.',
  );
  const [sanitizedPhoto, setSanitizedPhoto] = useState<{
    base64Data: string;
    mimeType: 'image/jpeg';
    previewDataUrl: string;
    sourceLabel: string;
  } | null>(null);
  const [exifCleanedNotice, setExifCleanedNotice] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [videoGenError, setVideoGenError] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<{
    objectUrl: string;
    aspectRatio: VideoAspectRatio;
    themeTitle: string;
  } | null>(null);

  // Audio Transcription state (gemini-3.5-transcribe)
  const [isRecordingTranscribe, setIsRecordingTranscribe] = useState<boolean>(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [lastTranscribedText, setLastTranscribedText] = useState<string>('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // =========================================================================
  // 3. REAL-TIME VOICE CONVERSATION STATE (gemini-3.8-live via /ws-live)
  // =========================================================================
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [liveConnecting, setLiveConnecting] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<
    Array<{ role: 'jugador' | 'copiloto'; text: string }>
  >([]);

  const liveWsRef = useRef<WebSocket | null>(null);
  const liveReadyRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureAudioCtxRef = useRef<AudioContext | null>(null);
  const playbackAudioCtxRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const activePlaybackNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Clean up generated video objectURL when replaced or unmounted
  useEffect(() => {
    return () => {
      if (generatedVideo?.objectUrl) {
        URL.revokeObjectURL(generatedVideo.objectUrl);
      }
    };
  }, [generatedVideo]);

  // Play gentle harmonic chime when user unmutes episode audio
  const triggerGentleValuesChime = useCallback(() => {
    if (episodeChimeMuted) return;
    try {
      if (!chimeCtxRef.current) {
        chimeCtxRef.current = new AudioContext();
      }
      const ctx = chimeCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.0001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.035, now + i * 0.14 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.6);
      });
    } catch {
      // Ignore Web Audio restrictions
    }
  }, [episodeChimeMuted]);

  // Render animated 3D-style game & values video episode onto HTML5 Canvas (works 100% offline & online)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let elapsedSec = 0;
    let lastTime = performance.now();
    let prevCaptionBucket = -1;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (episodePlaying) {
        elapsedSec += dt;
      }

      const w = videoAspectRatio === '9:16' ? 540 : 960;
      const h = videoAspectRatio === '9:16' ? 960 : 540;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const cycleSec = 18;
      const t = elapsedSec % cycleSec;
      const bucket = Math.min(2, Math.floor((t / cycleSec) * 3));
      if (bucket !== prevCaptionBucket) {
        prevCaptionBucket = bucket;
        setActiveCaptionIndex(bucket);
      }

      // 1. Sunlit Daytime Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.56);
      skyGrad.addColorStop(0, activeEpisode.skyTop);
      skyGrad.addColorStop(1, activeEpisode.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.58);

      // Sun & soft rays
      const sunX = w * 0.82;
      const sunY = h * 0.16;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, w * 0.16);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.98)');
      sunGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.45)');
      sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, w * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // Drifting white clouds
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (let c = 0; c < 4; c++) {
        const cx = ((c * 260 + elapsedSec * (16 + c * 4)) % (w + 180)) - 90;
        const cy = h * (0.11 + (c % 2) * 0.07);
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.arc(cx + 20, cy - 6, 26, 0, Math.PI * 2);
        ctx.arc(cx + 44, cy, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Majestic Mountains, Volcano & Cultural Monument Silhouette (Christ the Redeemer on Peak)
      const horizonY = h * 0.52;
      ctx.fillStyle = '#3b7a57';
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w * 0.18, h * 0.28);
      ctx.lineTo(w * 0.36, horizonY);
      ctx.closePath();
      ctx.fill();

      // Volcano cone
      ctx.fillStyle = '#2d5a4c';
      ctx.beginPath();
      ctx.moveTo(w * 0.28, horizonY);
      ctx.lineTo(w * 0.47, h * 0.24);
      ctx.lineTo(w * 0.51, h * 0.24);
      ctx.lineTo(w * 0.7, horizonY);
      ctx.closePath();
      ctx.fill();

      // Peak with open-arms monument (Cristo Redentor tribute in Episode 3 & scenic background)
      ctx.fillStyle = '#4d8b63';
      ctx.beginPath();
      ctx.moveTo(w * 0.58, horizonY);
      ctx.lineTo(w * 0.76, h * 0.3);
      ctx.lineTo(w * 0.96, horizonY);
      ctx.closePath();
      ctx.fill();

      const statueX = w * 0.76;
      const statueY = h * 0.3;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(statueX, statueY);
      ctx.lineTo(statueX, statueY - 22);
      ctx.moveTo(statueX - 12, statueY - 16);
      ctx.lineTo(statueX + 12, statueY - 16);
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(statueX, statueY - 25, 3, 0, Math.PI * 2);
      ctx.fill();

      // 3. Moving River / Coastal Turquoise Water Strip
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h * 0.65);
      waterGrad.addColorStop(0, '#0284c7');
      waterGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, horizonY, w, h * 0.12);

      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.8;
      for (let r = 0; r < 10; r++) {
        const rx = ((r * 120 + elapsedSec * 42) % (w + 80)) - 40;
        const ry = horizonY + 10 + (r % 3) * (h * 0.03);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + 18, ry - 4, rx + 36, ry);
        ctx.stroke();
      }

      // 4. Green Meadow, Flowers & Swaying Palm Trees
      const grassY = h * 0.63;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(0, grassY, w, h - grassY);

      // Swaying palm trees & roadside values signs
      const sway = Math.sin(elapsedSec * 2.1) * 6;
      [0.12, 0.88].forEach((pxNorm) => {
        const px = w * pxNorm;
        const py = grassY + 14;
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + sway * 0.5, py - 34, px + sway, py - 64);
        ctx.stroke();

        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 4;
        for (let f = -2; f <= 2; f++) {
          ctx.beginPath();
          ctx.moveTo(px + sway, py - 64);
          ctx.quadraticCurveTo(
            px + sway + f * 14,
            py - 76,
            px + sway + f * 24,
            py - 54 + Math.abs(f) * 4,
          );
          ctx.stroke();
        }
      });

      // Colorful meadow flowers
      const flowerColors = ['#f43f5e', '#facc15', '#a855f7', '#fb923c'];
      for (let fl = 0; fl < 14; fl++) {
        ctx.fillStyle = flowerColors[fl % flowerColors.length];
        const fx = (fl * (w / 14) + 18) % w;
        const fy = grassY + 8 + (fl % 2) * 8;
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Perspective 3D Highway Road + Zebra Crosswalk for Life Protection
      const roadTopW = w * 0.24;
      const roadBotW = w * 0.86;
      const roadTopY = grassY;
      const roadBotY = h;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTopW / 2, roadTopY);
      ctx.lineTo(w / 2 + roadTopW / 2, roadTopY);
      ctx.lineTo(w / 2 + roadBotW / 2, roadBotY);
      ctx.lineTo(w / 2 - roadBotW / 2, roadBotY);
      ctx.closePath();
      ctx.fill();

      // Red/white circuit kerbs
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTopW / 2, roadTopY);
      ctx.lineTo(w / 2 - roadBotW / 2, roadBotY);
      ctx.moveTo(w / 2 + roadTopW / 2, roadTopY);
      ctx.lineTo(w / 2 + roadBotW / 2, roadBotY);
      ctx.stroke();

      // Animated dashed center line
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 16]);
      ctx.lineDashOffset = -elapsedSec * 70;
      ctx.beginPath();
      ctx.moveTo(w / 2, roadTopY);
      ctx.lineTo(w / 2, roadBotY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Golden Finish / Values Archway
      const archLeft = w / 2 - roadTopW * 0.62;
      const archRight = w / 2 + roadTopW * 0.62;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(archLeft, roadTopY + 12);
      ctx.lineTo(archLeft, roadTopY - 38);
      ctx.lineTo(archRight, roadTopY - 38);
      ctx.lineTo(archRight, roadTopY + 12);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(archLeft - 8, roadTopY - 54, archRight - archLeft + 16, 20);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(activeEpisode.valueBanner.toUpperCase(), w / 2, roadTopY - 40);

      // 6. Hero 3D-Styled Vehicle + Smiling Avatar + Overhead Value Tag
      const bounce = Math.sin(elapsedSec * 7) * 1.8;
      const carCenterX = w / 2 + Math.sin(elapsedSec * 1.1) * (w * 0.08);
      const carCenterY = h * 0.8 + bounce;

      // Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      ctx.ellipse(carCenterX, carCenterY + 26, 66, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(carCenterX - 58, carCenterY + 4, 18, 24);
      ctx.fillRect(carCenterX + 40, carCenterY + 4, 18, 24);

      // Main 3D Vehicle Body
      ctx.fillStyle = activeEpisode.accentHex;
      ctx.beginPath();
      ctx.roundRect(carCenterX - 52, carCenterY - 14, 104, 34, 12);
      ctx.fill();

      // Cabin & Smiling 3D Avatar Head
      ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
      ctx.beginPath();
      ctx.roundRect(carCenterX - 32, carCenterY - 34, 64, 22, 8);
      ctx.fill();

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(carCenterX, carCenterY - 26, 9, 0, Math.PI * 2);
      ctx.fill();

      // Value Plate on Rear Bumper
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(carCenterX - 38, carCenterY - 3, 76, 15);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(activeEpisode.pillarBadge, carCenterX, carCenterY + 8);

      // Overhead Floating Name + Shield Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.beginPath();
      ctx.roundRect(carCenterX - 88, carCenterY - 64, 176, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(activeEpisode.vehicleLabel, carCenterX, carCenterY - 49);

      // 7. Top Episode Pill & Bottom Subtitle Scrim
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.beginPath();
      ctx.roundRect(16, 14, Math.min(w - 32, 370), 30, 8);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${activeEpisode.numberLabel} · ${activeEpisode.pillarBadge} · Ubicación 0% Expuesta`,
        28,
        33,
      );

      // Subtitle bar at bottom
      const caption = activeEpisode.captions[bucket] || activeEpisode.captions[0];
      ctx.fillStyle = 'rgba(9, 13, 22, 0.86)';
      ctx.fillRect(0, h - 58, w, 58);
      ctx.fillStyle = '#f8fafc';
      ctx.font = videoAspectRatio === '9:16' ? 'bold 13px sans-serif' : 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(caption, w / 2, h - 24, w - 36);

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [activeEpisode, episodePlaying, videoAspectRatio]);

  // =========================================================================
  // PHOTO UPLOAD HANDLER (STRIPS 100% EXIF GPS METADATA BEFORE SERVER SEND)
  // =========================================================================
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoGenError(null);
    try {
      const cleaned = await stripImageExifAndSanitizeToJpeg(file, 1280);
      setSanitizedPhoto({
        ...cleaned,
        sourceLabel: 'Foto personal sanitizada (0% GPS / 0% EXIF)',
      });
      setExifCleanedNotice(
        'Escudo Activo: Todos los metadatos ocultos EXIF/GPS fueron eliminados en tu dispositivo antes de usar la imagen.',
      );
    } catch (err) {
      setVideoGenError(
        err instanceof Error ? err.message : 'No se pudo procesar la imagen seleccionada.',
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleUseOfficialCoverArt = async () => {
    setVideoGenError(null);
    try {
      const cleaned = await stripImageExifAndSanitizeToJpeg(coverArtUrl, 1280);
      setSanitizedPhoto({
        ...cleaned,
        sourceLabel: 'Carátula Oficial 3D de Juego de 3D de Carros',
      });
      setExifCleanedNotice('Carátula oficial cargada para animar en video del juego y valores.');
    } catch {
      setVideoGenError('No se pudo preparar la carátula en este momento.');
    }
  };

  // =========================================================================
  // MICROPHONE AUDIO TRANSCRIPTION (gemini-3.5-transcribe via /api/audio/transcribe)
  // =========================================================================
  const handleToggleTranscribeRecording = async () => {
    setTranscribeError(null);
    if (isRecordingTranscribe) {
      mediaRecorderRef.current?.stop();
      setIsRecordingTranscribe(false);
      return;
    }

    if (!isOnline) {
      setTranscribeError(
        'Activa "Conexión a Internet Global" para transcribir tu voz con el servidor seguro.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) {
          audioChunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 200) return;

        setIsTranscribingAudio(true);
        try {
          const buf = await blob.arrayBuffer();
          const audioBase64 = arrayBufferToBase64(buf);
          const resp = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });
          const data = (await resp.json()) as {
            ok?: boolean;
            transcript?: string;
            error?: string;
          };
          if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'No se pudo transcribir el audio.');
          }
          const safeText = scrubLocationAndSensitiveText(data.transcript || '', 260);
          setLastTranscribedText(safeText);
          if (safeText) {
            setCustomVideoPrompt(safeText);
          }
        } catch (err) {
          setTranscribeError(
            err instanceof Error ? err.message : 'Error al transcribir el mensaje de voz.',
          );
        } finally {
          setIsTranscribingAudio(false);
        }
      };

      recorder.start();
      setIsRecordingTranscribe(true);
    } catch {
      setTranscribeError(
        'Permite el uso del micrófono en tu navegador para dictar tu mensaje de valores.',
      );
    }
  };

  // =========================================================================
  // GENERATE GAME & VALUES VIDEO (gemini-omni-1.1-flash via /api/videos/generate)
  // =========================================================================
  const handleGenerateValuesVideo = async () => {
    if (!isOnline) {
      setVideoGenError(
        'Estás en Modalidad Local (Sin Internet). Disfruta arriba los 4 Episodios Animados Locales o activa Conexión Global para generar un nuevo video MP4.',
      );
      return;
    }

    setIsGeneratingVideo(true);
    setVideoGenError(null);

    try {
      const safePrompt = scrubLocationAndSensitiveText(customVideoPrompt, 260);
      const resp = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId: selectedThemeId,
          prompt: safePrompt,
          aspectRatio: videoAspectRatio,
          imageBase64: sanitizedPhoto?.base64Data,
          imageMimeType: sanitizedPhoto?.mimeType,
        }),
      });

      const data = (await resp.json()) as {
        ok?: boolean;
        videoBase64?: string;
        mimeType?: string;
        aspectRatio?: VideoAspectRatio;
        error?: string;
      };

      if (!resp.ok || !data.ok || !data.videoBase64) {
        throw new Error(data.error || 'No se pudo generar el video en este momento.');
      }

      const binary = atob(data.videoBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'video/mp4' });
      const nextUrl = URL.createObjectURL(blob);

      const themeMeta =
        LOCAL_GAME_VALUES_EPISODES.find((ep) => ep.id === selectedThemeId) ||
        LOCAL_GAME_VALUES_EPISODES[0];

      setGeneratedVideo((prev) => {
        if (prev?.objectUrl) {
          URL.revokeObjectURL(prev.objectUrl);
        }
        return {
          objectUrl: nextUrl,
          aspectRatio: data.aspectRatio || videoAspectRatio,
          themeTitle: themeMeta.title,
        };
      });
    } catch (err) {
      setVideoGenError(
        err instanceof Error ? err.message : 'Ocurrió un inconveniente al generar el video.',
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // =========================================================================
  // REAL-TIME VOICE COPILOT (gemini-3.8-live via /ws-live)
  // =========================================================================
  const stopLiveVoiceSession = useCallback(() => {
    liveReadyRef.current = false;
    setLiveConnected(false);
    setLiveConnecting(false);

    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {
        // Ignore close error
      }
      liveWsRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (captureAudioCtxRef.current) {
      void captureAudioCtxRef.current.close().catch(() => {});
      captureAudioCtxRef.current = null;
    }

    activePlaybackNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Ignore already stopped source
      }
    });
    activePlaybackNodesRef.current.clear();

    if (playbackAudioCtxRef.current) {
      void playbackAudioCtxRef.current.close().catch(() => {});
      playbackAudioCtxRef.current = null;
    }
    nextPlaybackTimeRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      stopLiveVoiceSession();
      if (chimeCtxRef.current) {
        void chimeCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopLiveVoiceSession]);

  const startLiveVoiceSession = async () => {
    setLiveError(null);
    if (!isOnline) {
      setLiveError(
        'Activa "Conexión a Internet Global" para conversar en vivo con el Copiloto de Valores y Vida.',
      );
      return;
    }

    setLiveConnecting(true);
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = micStream;

      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackAudioCtxRef.current = playbackCtx;
      nextPlaybackTimeRef.current = 0;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws-live`);
      liveWsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data)) as {
            ready?: boolean;
            audio?: string;
            interrupted?: boolean;
            inputTranscript?: string;
            outputTranscript?: string;
            error?: string;
          };

          if (msg.error) {
            setLiveError(msg.error);
            stopLiveVoiceSession();
            return;
          }

          if (msg.ready) {
            liveReadyRef.current = true;
            setLiveConnecting(false);
            setLiveConnected(true);
          }

          if (msg.interrupted) {
            activePlaybackNodesRef.current.forEach((node) => {
              try {
                node.stop();
              } catch {
                // Ignore
              }
            });
            activePlaybackNodesRef.current.clear();
            if (playbackAudioCtxRef.current) {
              nextPlaybackTimeRef.current = playbackAudioCtxRef.current.currentTime;
            }
          }

          if (msg.inputTranscript) {
            const safeIn = scrubLocationAndSensitiveText(msg.inputTranscript, 220);
            if (safeIn) {
              setLiveTranscripts((prev) => [
                ...prev.slice(-7),
                { role: 'jugador', text: safeIn },
              ]);
            }
          }

          if (msg.outputTranscript) {
            const safeOut = scrubLocationAndSensitiveText(msg.outputTranscript, 280);
            if (safeOut) {
              setLiveTranscripts((prev) => [
                ...prev.slice(-7),
                { role: 'copiloto', text: safeOut },
              ]);
            }
          }

          if (msg.audio && playbackAudioCtxRef.current) {
            const pCtx = playbackAudioCtxRef.current;
            if (pCtx.state === 'suspended') {
              void pCtx.resume();
            }
            const pcm16 = base64ToInt16Array(msg.audio);
            if (pcm16.length > 0) {
              const audioBuffer = pCtx.createBuffer(1, pcm16.length, 24000);
              const channel = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channel[i] = pcm16[i] / 32768;
              }
              const source = pCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(pCtx.destination);
              const startAt = Math.max(pCtx.currentTime, nextPlaybackTimeRef.current);
              nextPlaybackTimeRef.current = startAt + audioBuffer.duration;
              activePlaybackNodesRef.current.add(source);
              source.onended = () => {
                activePlaybackNodesRef.current.delete(source);
              };
              source.start(startAt);
            }
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        setLiveError('Se cerró la conexión de voz. Intenta iniciar nuevamente.');
        stopLiveVoiceSession();
      };

      ws.onclose = () => {
        stopLiveVoiceSession();
      };

      // Capture 16kHz PCM audio from microphone and stream only when liveReadyRef.current === true
      const captureCtx = new AudioContext({ sampleRate: 16000 });
      captureAudioCtxRef.current = captureCtx;
      const micSource = captureCtx.createMediaStreamSource(micStream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (audioEvt) => {
        if (!liveReadyRef.current || !liveWsRef.current || liveWsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        const floatSamples = audioEvt.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(floatSamples.length);
        for (let i = 0; i < floatSamples.length; i++) {
          const s = Math.max(-1, Math.min(1, floatSamples[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const base64Audio = arrayBufferToBase64(pcm16.buffer);
        liveWsRef.current.send(JSON.stringify({ audio: base64Audio }));
      };

      micSource.connect(processor);
      processor.connect(captureCtx.destination);
    } catch {
      setLiveError(
        'No se pudo acceder al micrófono. Verifica el permiso de micrófono del navegador.',
      );
      stopLiveVoiceSession();
    }
  };

  return (
    <div id="videos-valores" className="space-y-6">
      {/* STRICT ZERO-LOCATION & ANTI-CRACKER PRIVACY BANNER */}
      <div className="bg-emerald-950 text-emerald-50 border-2 border-emerald-500/70 rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">
              Escudo Permanente Anti-Ubicación, Anti-Terceros y Anti-Crackers Activo
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              Tu Ubicación Física Real Nunca Se Lee, Nunca Se Guarda y Nunca Se Comparte
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              API de Geolocalización GPS bloqueada por código (<strong>0% GPS</strong>), protección
              contra fugas de IP por WebRTC (<strong>0% P2P STUN</strong>), identificadores efímeros
              anónimos en salas multijugador y limpieza automática del <strong>100% de metadatos EXIF/GPS</strong> en
              cualquier imagen antes de animarla.
            </p>
          </div>
        </div>
        <div className="px-3.5 py-2 rounded-xl bg-emerald-900/90 border border-emerald-400/50 text-xs font-bold text-emerald-200 whitespace-nowrap shrink-0 self-start md:self-center">
          Ubicación Real: 100% Blindada
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PART A: CURATED ANIMATED GAME VIDEOS ON VALUES, PROTECTION & LIFE     */}
      {/* ===================================================================== */}
      <div className="bg-white border border-sky-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
              <Film className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Cinemáticas Interactivas del Videojuego · Disponibles Con o Sin Internet</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-slate-900">
              Videos del Juego: Valores, Protección y Cuidado de la Vida
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Todos los episodios están inspirados en las pistas escénicas 3D, los vehículos con
              avatares, el respeto mutuo, la protección integral y el valor sagrado de la vida.
            </p>
          </div>

          {/* Aspect Ratio Switcher (16:9 Landscape / 9:16 Portrait) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-sky-100/80 border border-sky-200 shrink-0 self-start">
            <button
              type="button"
              onClick={() => setVideoAspectRatio('16:9')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                videoAspectRatio === '16:9'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-sky-800'
              }`}
            >
              Horizontal 16:9
            </button>
            <button
              type="button"
              onClick={() => setVideoAspectRatio('9:16')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                videoAspectRatio === '9:16'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-sky-800'
              }`}
            >
              Vertical 9:16
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Animated Game Video Player Viewport */}
          <div className="lg:col-span-7 flex flex-col items-center space-y-3">
            <div
              className={`relative rounded-2xl overflow-hidden border-2 border-sky-300 bg-slate-950 shadow-lg ${
                videoAspectRatio === '9:16'
                  ? 'w-[min(320px,86vw)] aspect-[9/16]'
                  : 'w-full aspect-video'
              }`}
            >
              <canvas ref={canvasRef} className="w-full h-full block object-cover" />
            </div>

            <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEpisodePlaying((p) => !p)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {episodePlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pausar Video</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Reproducir</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !episodeChimeMuted;
                    setEpisodeChimeMuted(nextMuted);
                    if (!nextMuted) {
                      setTimeout(triggerGentleValuesChime, 60);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-sky-100 border border-sky-200 text-slate-800 font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {episodeChimeMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                      <span>Activar Tonos</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>Tonos Activos</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-slate-700 font-medium truncate">
                Escena {activeCaptionIndex + 1}/3 · <strong>{activeEpisode.title}</strong>
              </div>
            </div>
          </div>

          {/* 4 Curated Game/Values/Life Episodes Selector */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-bold text-slate-700 px-1">
              Selecciona un episodio sobre el juego, los valores, la protección y la vida:
            </div>
            {LOCAL_GAME_VALUES_EPISODES.map((ep, idx) => {
              const isSelected = idx === selectedEpisodeIdx;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    setSelectedEpisodeIdx(idx);
                    setSelectedThemeId(ep.id);
                    setEpisodePlaying(true);
                    triggerGentleValuesChime();
                  }}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-sky-50 border-sky-600 shadow-sm'
                      : 'bg-white border-sky-200/80 hover:border-sky-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-sky-700">{ep.numberLabel}</span>
                    <span className="font-semibold text-emerald-700">{ep.pillarBadge}</span>
                  </div>
                  <div className="font-display text-base font-bold text-slate-900">{ep.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ep.summary}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PART B: GENERATE / ANIMATE PHOTO INTO VIDEO (gemini-omni-1.1-flash)   */}
      {/*         + MICROPHONE AUDIO TRANSCRIPTION (gemini-3.5-transcribe)      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-sky-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Estudio Cinematográfico MP4 del Juego · Valores, Protección y Vida</span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                Anima una Imagen o Escena en Video MP4 (16:9 o 9:16)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Sube una foto (limpiada al 100% de datos EXIF/GPS en tu equipo) o usa la carátula
                3D del juego, dicta o escribe tu mensaje de valores y genera un video dedicado a la
                protección y al cuidado de la vida.
              </p>
            </div>

            {/* Step 1: Optional Image Source (EXIF-stripped) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                1. Imagen base opcional (con limpieza total anti-rastreo EXIF/GPS):
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-sm">
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span>Subir Foto Limpia (Sin GPS)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleUseOfficialCoverArt()}
                  className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-slate-900 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Usar Carátula 3D del Juego
                </button>

                {sanitizedPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setSanitizedPhoto(null);
                      setExifCleanedNotice(null);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>

              {exifCleanedNotice && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{exifCleanedNotice}</span>
                </div>
              )}

              {sanitizedPhoto && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                  <img
                    src={sanitizedPhoto.previewDataUrl}
                    alt="Vista previa limpia sin metadatos EXIF"
                    className="w-16 h-12 object-cover rounded-lg border border-sky-300 shrink-0"
                  />
                  <div className="min-w-0 text-xs">
                    <div className="font-bold text-slate-900 truncate">
                      {sanitizedPhoto.sourceLabel}
                    </div>
                    <div className="text-emerald-700 font-medium">
                      Píxeles limpios verificados · 0 coordenadas GPS
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Values Theme + Voice Transcription Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="values-theme-select"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  2. Enfoque de Valores y Vida:
                </label>
                <select
                  id="values-theme-select"
                  value={selectedThemeId}
                  onChange={(e) => setSelectedThemeId(e.target.value as CuratedThemeId)}
                  className="w-full px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="proteccion_vida">Protección Vial y Cuidado de la Vida</option>
                  <option value="respeto_inclusion">Empatía, Inclusión y Apoyo Mutuo</option>
                  <option value="hermandad_sin_fronteras">
                    Hermandad Intercultural · Todos Ganan
                  </option>
                  <option value="juegos_y_vida_sana">
                    Juegos Tradicionales y Alegría por la Vida
                  </option>
                </select>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-800 mb-1">
                  3. Formato de Pantalla:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('16:9')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      videoAspectRatio === '16:9'
                        ? 'bg-sky-600 border-sky-700 text-white'
                        : 'bg-sky-50 border-sky-200 text-slate-700'
                    }`}
                  >
                    16:9 Paisaje
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('9:16')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      videoAspectRatio === '9:16'
                        ? 'bg-sky-600 border-sky-700 text-white'
                        : 'bg-sky-50 border-sky-200 text-slate-700'
                    }`}
                  >
                    9:16 Retrato
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Prompt + Microphone Transcription */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="values-video-prompt"
                  className="text-xs font-bold text-slate-800"
                >
                  4. Mensaje del video (puedes escribirlo o dictarlo con tu voz):
                </label>

                <button
                  type="button"
                  onClick={() => void handleToggleTranscribeRecording()}
                  disabled={isTranscribingAudio}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isRecordingTranscribe
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300'
                  }`}
                >
                  {isRecordingTranscribe ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Detener y Transcribir</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-sky-700" />
                      <span>
                        {isTranscribingAudio ? 'Transcribiendo voz...' : 'Dictar por Voz'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="values-video-prompt"
                rows={3}
                maxLength={260}
                value={customVideoPrompt}
                onChange={(e) => setCustomVideoPrompt(e.target.value)}
                placeholder="Describe una escena del juego relacionada con los valores, la protección y el respeto a la vida..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />

              {lastTranscribedText && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-slate-700">
                  <strong className="text-sky-800">Transcripción de voz limpia:</strong>{' '}
                  {lastTranscribedText}
                </div>
              )}

              {transcribeError && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-950">
                  {transcribeError}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-sky-100">
            {videoGenError && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950">
                {videoGenError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleGenerateValuesVideo()}
              disabled={isGeneratingVideo}
              className="w-full py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                {isGeneratingVideo
                  ? 'Generando Video del Juego y Valores (puede tardar ~30–60 s)...'
                  : `Generar Video MP4 (${videoAspectRatio}) de Valores y Vida`}
              </span>
            </button>

            {generatedVideo && (
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-emerald-800 truncate">
                    Video MP4 listo: {generatedVideo.themeTitle}
                  </span>
                  <a
                    href={generatedVideo.objectUrl}
                    download={`video_valores_vida_${generatedVideo.aspectRatio.replace(':', 'x')}.mp4`}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar MP4</span>
                  </a>
                </div>
                <div className="flex justify-center bg-slate-950 rounded-2xl p-2 border border-sky-300">
                  <video
                    src={generatedVideo.objectUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className={`rounded-xl ${
                      generatedVideo.aspectRatio === '9:16'
                        ? 'max-h-[420px] aspect-[9/16]'
                        : 'w-full aspect-video'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* PART C: REAL-TIME VOICE COPILOT (gemini-3.8-live)                   */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 bg-white border border-sky-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <Heart className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Conversación de Voz en Tiempo Real · Cero Rastreo</span>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                Copiloto de Voz: Valores, Protección y Vida
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Habla por voz sobre las pistas 3D, los juegos tradicionales, el apoyo respetuoso a
                personas con discapacidad, la convivencia intercultural y cómo proteger siempre la
                vida y tu privacidad.
              </p>
            </div>

            <div className="rounded-2xl bg-sky-50/90 border border-sky-200 p-4 space-y-2 text-xs text-slate-700">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Regla Estricta del Copiloto:</span>
              </div>
              <p className="leading-relaxed">
                El Copiloto jamás solicita ni almacena direcciones, ubicaciones ni datos personales.
                Cualquier coordenada o número sensible se filtra automáticamente en servidor y
                cliente.
              </p>
            </div>

            {/* Live Transcript Window */}
            <div className="rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 p-4 min-h-[190px] max-h-[250px] overflow-y-auto space-y-2.5 text-xs">
              {liveTranscripts.length === 0 ? (
                <div className="text-slate-400 leading-relaxed">
                  {liveConnected
                    ? 'Micrófono activo: habla ahora con el Copiloto sobre el juego, los valores y el cuidado de la vida...'
                    : 'Pulsa "Iniciar Conversación por Voz" para platicar en vivo con el Copiloto de Valores y Vida.'}
                </div>
              ) : (
                liveTranscripts.map((entry, idx) => (
                  <div
                    key={`live_tr_${idx}`}
                    className={`p-2.5 rounded-xl ${
                      entry.role === 'copiloto'
                        ? 'bg-sky-950/80 border border-sky-700/60 text-sky-100'
                        : 'bg-slate-900 border border-slate-700 text-amber-200'
                    }`}
                  >
                    <span className="font-bold uppercase text-[10px] tracking-wide block mb-0.5">
                      {entry.role === 'copiloto' ? 'Copiloto de Valores:' : 'Tú:'}
                    </span>
                    <span>{entry.text}</span>
                  </div>
                ))
              )}
            </div>

            {liveError && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950">
                {liveError}
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-sky-100">
            {liveConnected || liveConnecting ? (
              <button
                type="button"
                onClick={stopLiveVoiceSession}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4 shrink-0" />
                <span>
                  {liveConnecting ? 'Conectando voz segura...' : 'Finalizar Conversación de Voz'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startLiveVoiceSession()}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>Iniciar Conversación por Voz en Vivo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
