export interface IncidentReason {
  id: string;
  label: string;
  icon: string;
}

/**
 * Preset reasons shown to the public reporter on the QR incident page.
 * Admin tabs show the free-text `reason` column, not this picker.
 */
export const INCIDENT_REASONS: IncidentReason[] = [
  {
    id: 'irregular_parking',
    label: 'Estacionada em local irregular / bloqueando passagem',
    icon: 'alert-triangle',
  },
  {
    id: 'flat_tire_abandonment',
    label: 'Pneu murcho / aparente abandono',
    icon: 'circle-slash',
  },
  {
    id: 'cable_outlet_misuse',
    label: 'Cabo solto ou tomada ocupada indevidamente',
    icon: 'plug-zap',
  },
  {
    id: 'fallen_damage_risk',
    label: 'Bike caída / avaria',
    icon: 'shield-alert',
  },
  {
    id: 'other',
    label: 'Outro motivo',
    icon: 'message-square',
  },
];
