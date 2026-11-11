import React from 'react';

// The yellow local mode floating indicator was removed per user request:
// "ademas no debe aparecer como bototn extra la modalidad activa local queaparece en amarillo ensima solo carga por gusto la pantalla"
export const OfflineIndicator: React.FC<{
  forceOfflineMode?: boolean;
  onSwitchToOnline?: () => void;
}> = () => {
  return null;
};
