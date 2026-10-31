import React, { useState } from 'react';
import { CheckCircle2, Download, Laptop, Play, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface OfflineInstallPromptModalProps {
  open: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallNow: () => Promise<boolean>;
  onUseLocalWithoutInstall: () => void;
  onClose: () => void;
}

export const OfflineInstallPromptModal: React.FC<OfflineInstallPromptModalProps> = ({
  open,
  isInstallable,
  isInstalled,
  isIOS,
  onInstallNow,
  onUseLocalWithoutInstall,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-sky-200 p-6 shadow-2xl space-y-4 text-left text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-sky-600">Modalidad Sin Internet</div>
            <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
              {isInstalled
                ? 'App Local Ya Instalada en tu Dispositivo'
                : '¿Instalar Juego de 3D de Carros para Uso Sin Internet?'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de instalación"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-sky-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-sky-950 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Al instalar la aplicación, todos los circuitos 3D, vehículos (carros, pickups, tuk
            tuks, camiones y bicicletas), sonidos y trofeos quedan listos en tu pantalla de inicio
            o escritorio para abrirlos cuando no tengas internet.
          </span>
        </div>

        {isInstalled ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950">
            Tu aplicación ya está instalada en modo local. Puedes manejar todos los circuitos 3D
            sin conexión en cualquier momento.
          </div>
        ) : isInstallable ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                void onInstallNow().then((accepted) => {
                  if (accepted) onClose();
                });
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 py-3 px-4 text-sm font-bold text-white shadow-md transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Sí, Instalar App Ahora (Sin Internet)</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-2.5 text-xs sm:text-sm text-slate-700 bg-sky-50/70 border border-sky-200 rounded-xl p-4">
            <div className="flex items-center gap-2 font-semibold text-sky-700">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Instalar en iPhone / iPad (Safari)</span>
            </div>
            <p>
              1. Toca el botón <strong>Compartir</strong> en la barra de Safari.
            </p>
            <p>
              2. Selecciona <strong>Agregar a pantalla de inicio</strong> para dejar la App
              instalada sin internet.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sky-700">
                <Laptop className="w-4 h-4 shrink-0" />
                <span>Instalar en Computadora (Chrome, Edge o Brave)</span>
              </div>
              <p className="leading-relaxed">
                Haz clic en el ícono <strong className="text-slate-900">Instalar aplicación</strong>{' '}
                en la barra de direcciones superior para guardarla en tu escritorio sin internet.
              </p>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sky-700">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Instalar en Android</span>
              </div>
              <p className="leading-relaxed">
                Abre el menú del navegador (⋮) y toca{' '}
                <strong className="text-slate-900">Instalar aplicación</strong> o{' '}
                <strong className="text-slate-900">Agregar a pantalla principal</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onUseLocalWithoutInstall();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 py-2.5 px-3 text-xs font-bold text-slate-950 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span>Usar Modalidad Local Sin Instalar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 py-2.5 px-4 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  onUseLocalWithoutInstall?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onUseLocalWithoutInstall,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            void install().then((accepted) => {
              if (!accepted) setShowGuideModal(true);
            });
          } else {
            setShowGuideModal(true);
          }
        }}
        className="flex items-center gap-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-sky-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 text-sky-600 shrink-0" />
        <span>
          {isInstallable
            ? 'Instalar App (Sin Internet)'
            : isIOS
              ? 'Instalar en iPhone / iPad'
              : 'Instalar App Local'}
        </span>
      </button>

      <OfflineInstallPromptModal
        open={showGuideModal}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onInstallNow={install}
        onUseLocalWithoutInstall={() => onUseLocalWithoutInstall?.()}
        onClose={() => setShowGuideModal(false)}
      />
    </>
  );
};
