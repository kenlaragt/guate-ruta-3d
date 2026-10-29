export type SessionMode = 'SOLO' | 'SPLIT_2P' | 'ONLINE_MULTI';

export type TransmissionType = 'AT' | 'MT';

export type GearLabel = 'R' | 'N' | '1' | '2' | '3' | '4' | '5' | '6';

export type CameraMode = 'COCKPIT' | 'CHASE' | 'AERIAL';

export type RealWorldVisualMode = 'REAL_HYBRID_3D' | 'REAL_ROADMAP_3D' | 'SYNTHETIC_3D';

export type StreetViewHudMode = 'HIDDEN' | 'COPILOT_PIP' | 'WINDSHIELD_360';

export type TimeOfDay = 'DAY' | 'GOLDEN' | 'NIGHT';

export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY';

export type CarModelId =
  | 'byd_f'
  | 'toyota_corolla'
  | 'toyota_supra'
  | 'toyota_gt'
  | 'lamborghini'
  | 'tesla'
  | 'nissan_calsonic'
  | 'nissan_sentra'
  | 'pickup'
  | 'tuk_tuk'
  | 'bicicleta'
  | 'camion';

export type BodyStyle =
  | 'compact_hatch'
  | 'sedan'
  | 'sport_coupe'
  | 'gt_boxer'
  | 'supercar_wedge'
  | 'ev_fastback'
  | 'gtr_race'
  | 'sport_sedan'
  | 'pickup_truck'
  | 'tuk_tuk'
  | 'bicycle'
  | 'heavy_truck';

export interface CarSpec {
  id: CarModelId;
  brand: string;
  name: string;
  yearTag: string;
  bodyStyle: BodyStyle;
  horsepower: number;
  topSpeedKmh: number;
  accelFactor: number;
  handlingGrip: number;
  redlineRpm: number;
  idleRpm: number;
  maxForwardGears: 6;
  defaultPaint: string;
  accentHex: string;
  liveryNumber?: string;
  drivetrain: 'FWD' | 'RWD' | 'AWD';
  engineTone:
    | 'ev'
    | 'inline4'
    | 'inline6_turbo'
    | 'v10_scream'
    | 'rb26_race'
    | 'tuktuk_2stroke'
    | 'bicycle_chain'
    | 'diesel_truck';
  summary: string;
}

export type RegionGroup = 'GUATEMALA' | 'PAISES_MUNDO' | 'PISTAS_CIRCUITO';

export type HouseStyle =
  | 'colonial_gt'
  | 'campus_gt'
  | 'latin_residential'
  | 'caribbean_island'
  | 'modernist_brasilia'
  | 'european_classic'
  | 'north_american'
  | 'coastal_southern';

export type RoadSurface = 'cobblestone' | 'asphalt' | 'campus_paver' | 'boulevard';

export interface RoadNode2D {
  x: number;
  z: number;
}

export interface RoadSegmentSpec {
  id: string;
  name: string;
  points: RoadNode2D[];
  width: number;
  lanes: number;
  surface: RoadSurface;
  isMainArtery?: boolean;
}

export interface LandmarkSpec {
  id: string;
  name: string;
  kind:
    | 'arch_catalina'
    | 'stone_bridge'
    | 'university_hall'
    | 'campus_skybridge'
    | 'monument_spire'
    | 'modern_congress'
    | 'coastal_lighthouse'
    | 'central_plaza'
    | 'zoo_gate'
    | 'race_grandstand';
  x: number;
  z: number;
  rotationY?: number;
}

export interface MountainPeakSpec {
  name: string;
  x: number;
  z: number;
  height: number;
  radius: number;
  hasPlume?: boolean;
}

export interface AdaptedPlacePhotoItem {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  authorName?: string;
  authorUri?: string;
  fromGooglePlaces?: boolean;
}

export interface AwardDeliveryRecord {
  id: string;
  mapId: string;
  mapName: string;
  checkpointNumber: number;
  totalCheckpoints: number;
  isGrandFinale: boolean;
  presenterName: string;
  presenterRole: string;
  awardTitle: string;
  awardKind: 'MEDAL_BRONZE' | 'MEDAL_SILVER' | 'TROPHY_GOLD' | 'SUPER_GOLD_DIAMONDS';
  photoUrl: string;
  photoCropSlot?: number;
  timestamp: number;
}

export interface WorldMapSpec {
  id: string;
  name: string;
  regionLabel: string;
  country: string;
  countryCode: string;
  group: RegionGroup;
  centerLat: number;
  centerLon: number;
  gmpProhibitedTerritory?: boolean;
  /** True when this destination is a Zoo / Safari reserve with full animal enclosures */
  isZooSafari?: boolean;
  /** True when this destination is a closed-loop motorsport racing circuit */
  isClosedCircuit?: boolean;
  /** Text query for Google Maps Places API (New) to fetch real town & street photography */
  placesPhotoQueries: string[];
  /** Curated high-resolution adapted town photography asset */
  adaptedPhotoUrl: string;
  adaptedPhotoCaption: string;
  includeCampusWalkways?: boolean;
  houseStyle: HouseStyle;
  groundTint: string;
  skyTintDay: string;
  foliageType: 'jacaranda' | 'pine' | 'palm' | 'oak_ravine' | 'cypress';
  hasCoastalWater?: boolean;
  waterSide?: 'south' | 'east' | 'west' | 'north';
  description: string;
  roads: RoadSegmentSpec[];
  landmarks: LandmarkSpec[];
  peaks: MountainPeakSpec[];
  checkpoints: RoadNode2D[];
  spawn: { x: number; z: number; heading: number };
}

export interface RemoteOnlinePlayer {
  playerId: string;
  alias: string;
  carId: CarModelId;
  paintHex: string;
  x: number;
  z: number;
  heading: number;
  steerAngle: number;
  speedKmh: number;
  gear: string;
  checkpoints: number;
}

export interface PlayerHudTelemetry {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  gear: GearLabel;
  transmission: TransmissionType;
  steerDegrees: number;
  throttle: number;
  brake: number;
  streetName: string;
  lat: number;
  lon: number;
  x: number;
  z: number;
  heading: number;
  checkpointsCollected: number;
  totalCheckpoints: number;
  lapTimeSec: number;
  nitroPct: number;
  currentPresenterName?: string;
  currentAwardTitle?: string;
  p2SpeedKmh?: number;
  p2Gear?: GearLabel;
  p2Rpm?: number;
  p2StreetName?: string;
}
