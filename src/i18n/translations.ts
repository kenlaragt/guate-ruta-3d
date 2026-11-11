export type Language = 'es' | 'en';

export interface Translations {
  // Header
  playNow: string;
  donate: string;
  donateTooltip: string;
  downloadApk: string;
  languageSelect: string;
  navCover: string;
  navTracks: string;
  navGarage: string;
  navVideos: string;
  navTrophies: string;

  // Hero & Showcase
  heroTitlePrefix: string;
  heroTitleSuffix: string;
  heroSubtitle: string;
  enter3dTrack: string;
  selectedTrack: string;
  selectedVehicle: string;
  prevImage: string;
  nextImage: string;
  imageCount: string;

  // Quick Vehicle Selector
  quickVehicleTitle: string;
  quickVehicleDesc: string;
  openGarage: string;
  activeStatus: string;

  // Modality & Settings
  modalityTitle: string;
  localOffline: string;
  localOfflineDesc: string;
  onlineGlobal: string;
  onlineGlobalDesc: string;
  pilotAliasLabel: string;
  pilotAliasPlaceholder: string;
  playersModeLabel: string;
  player1Solo: string;
  player2Split: string;
  playerOnlineRoom: string;
  privacyShield: string;

  // In-Game Watermark Controls
  controlsSteer: string;
  controlsThrottle: string;
  controlsBrake: string;
  controlsNitro: string;
  controlsGear: string;
  controlsAuto: string;
  controlsManual: string;
  controlsSpeed: string;

  // In-Game Driving HUD
  hudFreeRoam: string;
  hudRace4Min: string;
  hudAddTime: string;
  hudToFinish: string;
  hudMedals: string;
  hudPilot: string;
  hudStreet: string;
  hudCheckpoints: string;
  hudReturnMenu: string;

  // Launch Modal
  modalStartTrackIn: string;
  modalChooseMode: string;
  modalFreeRoamTitle: string;
  modalFreeRoamDesc: string;
  modalFreeRoamButton: string;
  modalRaceTitle: string;
  modalRaceDesc: string;
  modalRaceButton: string;
  modalChooseVehicleForTrack: string;
  modalInstantSwitch: string;

  // Pasarela
  pasarelaTitle: string;
  pasarelaDesc: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  es: {
    playNow: 'Jugar Ahora',
    donate: 'Aporta / Donate',
    donateTooltip: 'Aportaciones y donaciones para el desarrollo de GuateRutas 3D',
    downloadApk: 'Descargar APK',
    languageSelect: 'Idioma: Español (ES)',
    navCover: 'Carátula',
    navTracks: 'Pistas 3D',
    navGarage: 'Garaje 3D',
    navVideos: 'Videos y Vida',
    navTrophies: 'Trofeos',

    heroTitlePrefix: 'GuateRutas 3D',
    heroTitleSuffix: 'y más allá',
    heroSubtitle: 'Juegos de 3D de Carros',
    enter3dTrack: '¡ENTRAR A LA PISTA 3D! →',
    selectedTrack: 'Pista seleccionada',
    selectedVehicle: 'Vehículo',
    prevImage: 'Imagen anterior',
    nextImage: 'Siguiente imagen',
    imageCount: 'de',

    quickVehicleTitle: 'Selección Rápida de Vehículo',
    quickVehicleDesc: 'Toca cualquier vehículo para seleccionarlo al instante sin pantallas lentas.',
    openGarage: 'Garaje 360°',
    activeStatus: 'ACTIVO',

    modalityTitle: 'Modalidad y Piloto',
    localOffline: 'Local (Sin Internet)',
    localOfflineDesc: '100% offline en tu dispositivo',
    onlineGlobal: 'Conexión Global',
    onlineGlobalDesc: 'Salas y Mapas Reales en vivo',
    pilotAliasLabel: 'Apodo de Piloto',
    pilotAliasPlaceholder: 'PilotoGT',
    playersModeLabel: 'Modo Jugadores',
    player1Solo: '1 Jugador Local',
    player2Split: '2 Jugadores Local',
    playerOnlineRoom: 'Sala Multijugador',
    privacyShield: 'Escudo Anti-Ubicación: 100% privado, sin acceso a GPS ni datos personales.',

    controlsSteer: 'Timón',
    controlsThrottle: 'GAS',
    controlsBrake: 'Freno',
    controlsNitro: 'Nitro',
    controlsGear: 'Marcha',
    controlsAuto: 'Automático',
    controlsManual: 'Mecánico',
    controlsSpeed: 'km/h',

    hudFreeRoam: 'Paseo Libre',
    hudRace4Min: 'Carrera 4:00',
    hudAddTime: 'Add Time',
    hudToFinish: 'a meta',
    hudMedals: 'Medallas',
    hudPilot: 'Piloto',
    hudStreet: 'Calle / Tramo',
    hudCheckpoints: 'Metas',
    hudReturnMenu: 'Volver al Menú',

    modalStartTrackIn: 'Iniciar Pista en',
    modalChooseMode: 'Elige tu Modalidad de Recorrido',
    modalFreeRoamTitle: 'Pasear Libre por Calles y Paisajes',
    modalFreeRoamDesc: 'Recorre libremente las calles y paisajes 3D del circuito a tu propio ritmo sin límite de tiempo.',
    modalFreeRoamButton: 'Salir a Pasear Libre →',
    modalRaceTitle: 'Carrera Add Time · 4 Minutos',
    modalRaceDesc: 'Participan otros carros y transportes en pista, con flechas guía 3D hacia la meta y medallas para todos.',
    modalRaceButton: '¡Iniciar Carrera 4:00 (Todos Ganan)! →',
    modalChooseVehicleForTrack: 'Elige tu Vehículo o Transporte para esta pista:',
    modalInstantSwitch: 'Toca para cambiar al instante',

    pasarelaTitle: 'Aportes, Donaciones y Consultoría',
    pasarelaDesc: 'Apoya el desarrollo continuo de GuateRutas 3D y la preservación digital de paisajes.',
  },
  en: {
    playNow: 'Play Now',
    donate: 'Aporta / Donate',
    donateTooltip: 'Contributions and donations for GuateRutas 3D development',
    downloadApk: 'Download APK',
    languageSelect: 'Language: English (EN)',
    navCover: 'Cover Art',
    navTracks: '3D Tracks',
    navGarage: '3D Garage',
    navVideos: 'Videos & Life',
    navTrophies: 'Trophies',

    heroTitlePrefix: 'GuateRutas 3D',
    heroTitleSuffix: 'and beyond',
    heroSubtitle: '3D Car Racing Games',
    enter3dTrack: 'ENTER 3D TRACK! →',
    selectedTrack: 'Selected Track',
    selectedVehicle: 'Vehicle',
    prevImage: 'Previous image',
    nextImage: 'Next image',
    imageCount: 'of',

    quickVehicleTitle: 'Quick Vehicle Selection',
    quickVehicleDesc: 'Tap any vehicle to switch instantly with zero lag.',
    openGarage: '360° Garage',
    activeStatus: 'ACTIVE',

    modalityTitle: 'Mode & Pilot',
    localOffline: 'Local (Offline)',
    localOfflineDesc: '100% offline on your device',
    onlineGlobal: 'Global Online',
    onlineGlobalDesc: 'Online Rooms & Live Real Maps',
    pilotAliasLabel: 'Driver Alias',
    pilotAliasPlaceholder: 'GTPilot',
    playersModeLabel: 'Players Mode',
    player1Solo: '1 Player Local',
    player2Split: '2 Players Split Screen',
    playerOnlineRoom: 'Multiplayer Room',
    privacyShield: 'Privacy Shield: 100% private, zero GPS tracking or personal data collection.',

    controlsSteer: 'Steering',
    controlsThrottle: 'GAS',
    controlsBrake: 'Brake',
    controlsNitro: 'Nitro',
    controlsGear: 'Gear',
    controlsAuto: 'Automatic',
    controlsManual: 'Manual',
    controlsSpeed: 'km/h',

    hudFreeRoam: 'Free Roam',
    hudRace4Min: '4:00 Race',
    hudAddTime: 'Add Time',
    hudToFinish: 'to finish',
    hudMedals: 'Medals',
    hudPilot: 'Driver',
    hudStreet: 'Street / Road',
    hudCheckpoints: 'Checkpoints',
    hudReturnMenu: 'Return to Menu',

    modalStartTrackIn: 'Start Track in',
    modalChooseMode: 'Choose Your Driving Mode',
    modalFreeRoamTitle: 'Free Roam on Streets & Landscapes',
    modalFreeRoamDesc: 'Explore the 3D streets and scenery at your own leisure with no time limit.',
    modalFreeRoamButton: 'Start Free Roam →',
    modalRaceTitle: '4:00 Min Add Time Race',
    modalRaceDesc: 'Race alongside active AI and remote transports with 3D guide arrows and medals for all.',
    modalRaceButton: 'Start 4:00 Race (All Win)! →',
    modalChooseVehicleForTrack: 'Choose your vehicle or transport for this track:',
    modalInstantSwitch: 'Tap to switch instantly',

    pasarelaTitle: 'Donations, Contributions & Consulting',
    pasarelaDesc: 'Support ongoing GuateRutas 3D development and digital cultural preservation.',
  },
};
