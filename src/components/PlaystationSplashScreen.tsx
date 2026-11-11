import React, { useEffect, useState } from 'react';

interface PlaystationSplashScreenProps {
  onDismiss: () => void;
}

export const PlaystationSplashScreen: React.FC<PlaystationSplashScreenProps> = ({ onDismiss }) => {
  const [phase, setPhase] = useState<'fade-in' | 'glow' | 'fade-out'>('fade-in');

  useEffect(() => {
    // Phase 1: Fade-in and scale up (0 - 1800ms)
    const glowTimer = setTimeout(() => {
      setPhase('glow');
    }, 700);

    // Phase 2: Fade-out transition after 2600ms
    const fadeOutTimer = setTimeout(() => {
      setPhase('fade-out');
    }, 2400);

    // Phase 3: Dismiss to main game after 2900ms
    const endTimer = setTimeout(() => {
      onDismiss();
    }, 2800);

    return () => {
      clearTimeout(glowTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(endTimer);
    };
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black select-none touch-none cursor-pointer transition-opacity duration-500 ${
        phase === 'fade-out' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #071e3d 0%, #030b17 55%, #000000 100%)',
      }}
    >
      {/* Background Soft PlayStation Blue Radial Pulse */}
      <div
        className={`pointer-events-none absolute w-[420px] h-[420px] rounded-full bg-sky-500/15 blur-[90px] transition-all duration-1000 ${
          phase === 'glow' ? 'scale-125 opacity-100' : 'scale-90 opacity-40'
        }`}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg space-y-6">
        {/* Animated 3D Livsform Lykke Emblem */}
        <div
          className={`relative w-40 h-40 sm:w-48 sm:h-48 transition-all duration-1000 transform ${
            phase === 'fade-in'
              ? 'opacity-0 scale-90 translate-y-2'
              : 'opacity-100 scale-100 translate-y-0'
          }`}
        >
          {/* Cyan/Blue Aura Ring behind logo */}
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl animate-pulse" />

          <img
            src="/assets/aistudio/logo_likke_icon_app_512_509_004d6cb8.png"
            alt="Logotipo Livsform Lykke"
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_25px_rgba(56,189,248,0.45)]"
          />
        </div>

        {/* PlayStation-Style Title & Subtitle Typography */}
        <div
          className={`space-y-2 transition-all duration-1000 delay-200 transform ${
            phase === 'fade-in' ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
          }`}
        >
          <h1 className="font-display tracking-[0.25em] text-2xl sm:text-3xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            LIVSFORM LYKKE
          </h1>

          <p className="font-display italic text-sm sm:text-base tracking-[0.18em] text-cyan-300 font-semibold drop-shadow">
            Tu Lugar Seguro
          </p>

          <p className="text-xs tracking-wider text-slate-400 font-medium">
            Psicología & Bienestar Humano · Armonía Danesa
          </p>
        </div>

        {/* Breathing Tap-to-Start Prompt */}
        <div
          className={`pt-6 transition-opacity duration-700 delay-500 ${
            phase === 'fade-in' ? 'opacity-0' : 'opacity-80'
          }`}
        >
          <span className="text-[11px] sm:text-xs tracking-widest text-slate-300/80 animate-pulse uppercase">
            ✦ Toca la pantalla para iniciar de inmediato ✦
          </span>
        </div>
      </div>
    </div>
  );
};
