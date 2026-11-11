import React, { useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Code,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Key,
  Layers,
  Package,
  ShieldCheck,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidBundleModalProps {
  open: boolean;
  onClose: () => void;
}

export const AndroidBundleModal: React.FC<AndroidBundleModalProps> = ({ open, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<
    'DOWNLOAD' | 'ACTIONS' | 'MANIFEST_XML' | 'DIRECT_INSTALL' | 'KEYSTORE'
  >('DOWNLOAD');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const sharedAppUrl = 'https://ais-pre-2ll7lii4dwwvirhke3mxoh-894683888544.us-east1.run.app';
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(sharedAppUrl)}`;

  const gradleAssembleCmd = './gradlew assembleRelease';
  const gradleBundleCmd = './gradlew bundleRelease';
  const keystoreGenCmd =
    'keytool -genkey -v -keystore release.keystore -alias guaterutas -keyalg RSA -keysize 2048 -validity 10000';

  const buildDataPropertiesContent = `# Build Data Properties - GuateRutas 3D y más allá
appMetadataVersion=1.1
androidGradlePluginVersion=8.2.2
applicationId=com.guaterutas3d.app
versionCode=1
versionName=1.0.0
compileSdkVersion=34
targetSdkVersion=34
minSdkVersion=24
buildType=release
buildTimestamp=2026-11-11T03:12:00Z
appName=GuateRutas 3D y más allá — Juegos de 3D de Carros
privacyShield=NO_GPS_TRACKING_ENFORCED
bundleFormat=aab_and_apk
developer=KAAMT EALMT
service=LivsForm Lykke`;

  const manifestXmlSnippet = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.guaterutas3d.app">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />

    <application
        android:allowBackup="true"
        android:fullBackupContent="@xml/backup_rules"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:hardwareAccelerated="true"
        android:theme="@style/Theme.GuateRutas3D.Fullscreen">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="sensorLandscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name="com.example.ui.activities.PantallaWebPagoActivity" android:label="Pasarela de Pago Segura" />
        <activity android:name="com.example.ui.activities.CodigoActivacionActivity" android:label="Activar Club Ilimitado" />
        <activity android:name="com.example.ui.activities.MenuPrincipalActivity" android:label="Menú Principal" />
    </application>
</manifest>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white border-2 border-sky-300 shadow-2xl overflow-hidden my-4 text-slate-900 flex flex-col max-h-[92vh]">
        {/* Header con estilo Gran Turismo 3 (Azul Cielo, Cromo y Esquina Roja) */}
        <div className="relative bg-gradient-to-r from-[#0d4792] via-[#1c74d8] to-[#5ec0fa] px-6 py-4 text-white">
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-red-600 to-transparent pointer-events-none"
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25 shadow-inner">
                <Smartphone className="w-6 h-6 text-sky-100" />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-amber-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span>Android Studio · AGP 8.2.2 · AppMetadata 1.1</span>
                </div>
                <h3 className="font-display italic text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-sm">
                  Centro de Ensamblado, APK y Android App Bundle
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-white/20 overflow-x-auto text-xs font-semibold scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('DOWNLOAD')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'DOWNLOAD'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar APK y Archivos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ACTIONS')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'ACTIONS'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Android Studio Build</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANIFEST_XML')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'MANIFEST_XML'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>AndroidManifest &amp; XML</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DIRECT_INSTALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'DIRECT_INSTALL'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>WebAPK Móvil</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('KEYSTORE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'KEYSTORE'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Keystore y Firma</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700">
          {/* TAB 1: DESCARGA DIRECTA DE APK Y ARCHIVOS DE COMPILACIÓN */}
          {activeTab === 'DOWNLOAD' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-sky-500/15 border-2 border-amber-400/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-slate-900 text-base">
                      Descarga de Binarios y Paquetes Android
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Listo para Instalar
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Descarga el instalador APK completo del videojuego con los circuitos 3D
                  integrados, compatibilidad 100% sin conexión y aceleración WebGL:
                </p>

                {/* Primary APK Download Action Button */}
                <div className="pt-1 flex flex-col sm:flex-row gap-3">
                  <a
                    href="/downloads/GuateRutas3D-v1.0.apk"
                    download="GuateRutas3D-v1.0.apk"
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-center"
                  >
                    <Download className="w-5 h-5 text-emerald-100" />
                    <span>DESCARGAR APK (GuateRutas3D-v1.0.apk · 13.3 MB)</span>
                  </a>

                  <a
                    href="/downloads/GuateRutas3D-AndroidStudio.zip"
                    download="GuateRutas3D-AndroidStudio.zip"
                    className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <FileCode className="w-4 h-4 text-sky-400" />
                    <span>Descargar Proyecto Android Studio (.zip)</span>
                  </a>
                </div>
              </div>

              {/* Build Data Properties Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <span>Propiedades de Compilación (build-data.properties)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/build-data.properties"
                      download="build-data.properties"
                      className="text-xs font-semibold text-sky-700 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar .properties</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      appMetadataVersion
                    </div>
                    <div className="font-mono font-bold text-sky-800 text-sm">1.1</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      AGP Version
                    </div>
                    <div className="font-mono font-bold text-sky-800 text-sm">8.2.2</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      Compile / Target SDK
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm">34 (Android 14)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                      Min SDK
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm">24 (Android 7+)</div>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-3 rounded-xl bg-slate-950 text-sky-300 font-mono text-[11px] overflow-x-auto max-h-36 border border-slate-800">
                    {buildDataPropertiesContent}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildDataPropertiesContent, 'buildData')}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'buildData' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAS 4 ACCIONES DE ANDROID STUDIO */}
          {activeTab === 'ACTIONS' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong>El proyecto nativo está configurado en <code className="font-mono bg-sky-100 px-1 py-0.5 rounded">./android</code></strong>{' '}
                  con soporte completo para aceleración por hardware WebGL, pantalla completa inmersiva y las 4 opciones oficiales del menú de Android Studio.
                </div>
              </div>

              {/* 1. Assemble Project */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 hover:border-sky-300 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-[11px]">1</span>
                    <span className="font-mono text-sky-700">Build &gt; Assemble Project</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Listo</span>
                </div>
                <p className="text-slate-600 text-xs">
                  Compila todo el proyecto, enlaza los assets del juego 3D y genera los binarios de depuración y producción.
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-sky-300 font-mono text-[11px] px-3 py-2 rounded-xl">
                  <span>./gradlew assemble</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('./gradlew assemble', 'assemble')}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'assemble' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Generate APK(s) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 hover:border-sky-300 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-[11px]">2</span>
                    <span className="font-mono text-sky-700">Build &gt; Generate Bundle(s) / APK(s) &gt; Generate APK(s)</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">Instalador Directo</span>
                </div>
                <p className="text-slate-600 text-xs">
                  Genera el paquete instalable <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">.apk</code> para instalar en cualquier teléfono o tablet Android.
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-sky-300 font-mono text-[11px] px-3 py-2 rounded-xl">
                  <span>{gradleAssembleCmd}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gradleAssembleCmd, 'apk')}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'apk' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Generate Bundle(s) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 hover:border-sky-300 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-[11px]">3</span>
                    <span className="font-mono text-sky-700">Build &gt; Generate Bundle(s) / APK(s) &gt; Generate Bundle(s)</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Google Play AAB</span>
                </div>
                <p className="text-slate-600 text-xs">
                  Genera el paquete optimizado <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">.aab</code> (Android App Bundle) para la consola de Google Play Store.
                </p>
                <div className="flex items-center justify-between bg-slate-900 text-sky-300 font-mono text-[11px] px-3 py-2 rounded-xl">
                  <span>{gradleBundleCmd}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gradleBundleCmd, 'bundle')}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'bundle' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Generate Signed App Bundle or APK */}
              <div className="p-4 rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50/50 to-sky-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[11px]">4</span>
                    <span className="font-mono text-red-700">Build &gt; Generate Signed App Bundle or APK</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">Firma de Release</span>
                </div>
                <p className="text-slate-600 text-xs">
                  Firma el archivo final con tu clave privada (Keystore) para subirlo a Google Play Console.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('KEYSTORE')}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configurar Keystore y Firma</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ANDROIDMANIFEST.XML Y REGLAS DE RESPALDO/EXTRACCIÓN */}
          {activeTab === 'MANIFEST_XML' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex items-start gap-3">
                <FileCode className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong>AndroidManifest.xml y reglas XML configuradas</strong> con las actividades
                  de la pasarela de pagos, activación de club, menú principal, reglas de respaldo
                  seguro (<code className="font-mono bg-sky-100 px-1 py-0.5 rounded">backup_rules.xml</code>)
                  y extracción (<code className="font-mono bg-sky-100 px-1 py-0.5 rounded">data_extraction_rules.xml</code>).
                </div>
              </div>

              {/* XML Files Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900">backup_rules.xml</div>
                  <div className="text-[11px] text-slate-500 font-mono">&lt;full-backup-content&gt;</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900">data_extraction_rules.xml</div>
                  <div className="text-[11px] text-slate-500 font-mono">&lt;cloud-backup&gt;</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900">image_share_filepaths.xml</div>
                  <div className="text-[11px] text-slate-500 font-mono">image_provider_images</div>
                </div>
              </div>

              {/* AndroidManifest.xml preview */}
              <div className="relative">
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                  {manifestXmlSnippet}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(manifestXmlSnippet, 'manifestXml')}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedKey === 'manifestXml' ? 'Copiado' : 'Copiar XML'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: INSTALACIÓN WEBAPK / PWABUILDER */}
          {activeTab === 'DIRECT_INSTALL' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 space-y-3">
                <div className="flex items-center gap-2.5 font-bold text-sky-950">
                  <Smartphone className="w-5 h-5 text-sky-600" />
                  <span className="text-base">Instalación Automática WebAPK (En tu Teléfono Android)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  En Android, el navegador convierte automáticamente esta aplicación en un{' '}
                  <strong>APK nativo firmado por Google (WebAPK)</strong> con icono en el menú de
                  aplicaciones, soporte sin internet y ejecución a pantalla completa.
                </p>
                {isInstalled ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-semibold text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>¡La aplicación ya está instalada como APK local en este dispositivo!</span>
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={() => {
                      void install().then((accepted) => {
                        if (accepted) onClose();
                      });
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar APK Ahora en este Dispositivo</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1">
                    <div className="font-semibold">Para instalar directamente desde el navegador en Android:</div>
                    <ol className="list-decimal pl-4 space-y-0.5 text-slate-700">
                      <li>Abre el menú de opciones (los tres puntos verticales <strong>⋮</strong> arriba a la derecha).</li>
                      <li>Toca <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong>.</li>
                      <li>Android compilará e instalará el APK en tu dispositivo en segundos.</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* PWABuilder Cloud APK */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-sky-600" />
                    <span>Generador en la Nube PWABuilder (Google Bubblewrap)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">1 Clic</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  PWABuilder genera el paquete firmado <strong>.aab</strong> y <strong>.apk</strong> listo
                  para publicar en Google Play Store sin necesidad de tener Android Studio en tu máquina.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={pwaBuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Abrir Generador PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sharedAppUrl, 'sharedUrl')}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'sharedUrl' ? 'URL Copiada' : 'Copiar URL de la App'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KEYSTORE Y FIRMA DE PRODUCCIÓN */}
          {activeTab === 'KEYSTORE' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <Key className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  Para publicar en <strong>Google Play Console</strong> o generar un <strong>APK firmado de distribución</strong>, Android requiere una clave criptográfica (Keystore).
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-xs">Comando para generar tu clave Keystore privada:</div>
                <div className="flex items-center justify-between bg-slate-950 text-amber-300 font-mono text-[11px] p-3 rounded-xl border border-slate-800">
                  <span className="overflow-x-auto select-all">{keystoreGenCmd}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(keystoreGenCmd, 'keystoreCmd')}
                    className="text-slate-400 hover:text-white flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'keystoreCmd' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-700">
                <div className="font-bold text-slate-900">En Android Studio:</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Ve a <strong>Build &gt; Generate Signed App Bundle or APK</strong>.</li>
                  <li>Selecciona <strong>Android App Bundle (.aab)</strong> para Google Play o <strong>APK</strong> para instalación directa.</li>
                  <li>Selecciona tu archivo <code className="font-mono text-sky-700">release.keystore</code> y escribe tu contraseña.</li>
                  <li>Elige el destino de salida y haz clic en <strong>Finish</strong>.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Escudo de Privacidad Activo · Cero Rastreo GPS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors cursor-pointer shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
