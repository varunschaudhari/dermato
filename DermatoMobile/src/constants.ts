export const CONDITION_LABELS: Record<string, string> = {
  acne: 'Acne',
  pigmentation: 'Pigmentation',
  wrinkle: 'Wrinkles',
  pore: 'Pores',
};

export const SEVERITY_META: Record<string, { color: string; bg: string; label: string }> = {
  mild: { color: '#059669', bg: '#d1fae5', label: 'Mild' },
  moderate: { color: '#d97706', bg: '#fef3c7', label: 'Moderate' },
  severe: { color: '#dc2626', bg: '#fee2e2', label: 'Severe' },
};
