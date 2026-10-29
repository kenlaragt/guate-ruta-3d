import { AwardDeliveryRecord } from '../types/game';

export const REAL_PEOPLE_ASSETS = {
  pedestriansSheetUrl: new URL(
    '../assets/images/people_pedestrians_real_1793073040945.jpg',
    import.meta.url,
  ).href,
  grandTrophyShowcaseUrl: new URL(
    '../assets/images/trophy_trio_crown_1793069073260.jpg',
    import.meta.url,
  ).href,
};

export const GRAND_FINALE_PRESENTER = 'Jurado Oficial de Campeones';
export const GRAND_FINALE_AWARD_TITLE = 'Gran Trofeo Súper Oro con Diamantes';

export const PEDESTRIAN_UV_SLICES: Array<{ uMin: number; uMax: number }> = [
  { uMin: 0.14, uMax: 0.26 },
  { uMin: 0.25, uMax: 0.37 },
  { uMin: 0.36, uMax: 0.55 },
  { uMin: 0.56, uMax: 0.78 },
];

export interface CheckpointPresenterPlan {
  checkpointNumber: number;
  totalCheckpoints: number;
  isGrandFinale: boolean;
  presenterName: string;
  presenterRole: string;
  awardTitle: string;
  awardKind: AwardDeliveryRecord['awardKind'];
  photoUrl: string;
  photoCropSlot: number;
}

const SAFE_STAGE_COMMITTEES = [
  'Comité Deportivo de Pista',
  'Podio Oficial de Ruta',
  'Comisarios de Velocidad',
  'Equipo de Cronometraje',
];

export function getCheckpointAwardPlan(
  _mapId: string,
  mapOrderIndex: number,
  checkpointZeroIdx: number,
  totalCheckpoints: number,
): CheckpointPresenterPlan {
  const safeTotal = Math.max(1, totalCheckpoints);
  const normIdx = ((checkpointZeroIdx % safeTotal) + safeTotal) % safeTotal;
  const isFinalCheckpoint = normIdx === safeTotal - 1;

  if (isFinalCheckpoint) {
    return {
      checkpointNumber: normIdx + 1,
      totalCheckpoints: safeTotal,
      isGrandFinale: true,
      presenterName: GRAND_FINALE_PRESENTER,
      presenterRole: 'Entrega Oficial del Gran Trofeo Final',
      awardTitle: GRAND_FINALE_AWARD_TITLE,
      awardKind: 'SUPER_GOLD_DIAMONDS',
      photoUrl: REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl,
      photoCropSlot: 0,
    };
  }

  const stageTitle =
    SAFE_STAGE_COMMITTEES[(mapOrderIndex + normIdx) % SAFE_STAGE_COMMITTEES.length];

  const awardCycle: Array<{
    title: string;
    kind: AwardDeliveryRecord['awardKind'];
  }> = [
    { title: 'Medalla de Bronce de Velocidad', kind: 'MEDAL_BRONZE' },
    { title: 'Medalla de Plata y Copa de Ruta', kind: 'MEDAL_SILVER' },
    { title: 'Trofeo Dorado de Circuito', kind: 'TROPHY_GOLD' },
  ];
  const chosenAward = awardCycle[(normIdx + mapOrderIndex) % awardCycle.length];

  return {
    checkpointNumber: normIdx + 1,
    totalCheckpoints: safeTotal,
    isGrandFinale: false,
    presenterName: `${stageTitle} #${normIdx + 1}`,
    presenterRole: `Meta ${normIdx + 1} de ${safeTotal}`,
    awardTitle: chosenAward.title,
    awardKind: chosenAward.kind,
    photoUrl: REAL_PEOPLE_ASSETS.grandTrophyShowcaseUrl,
    photoCropSlot: normIdx % 4,
  };
}
