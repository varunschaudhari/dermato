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

// The handful of hex values every screen's StyleSheet otherwise repeats
// independently (grepped: the brand teal alone appears ~50 times across
// screen files). Not a full spacing/token system — just these six, so a
// future rebrand or dark-mode pass touches one file instead of nine.
export const COLORS = {
  teal: '#0d9488',
  tealSoft: '#f0fdfa',
  mutedGray: '#9ca3af',
  heading: '#111827',
  border: '#f3f4f6',
  secondaryText: '#6b7280',
  divider: '#e5e7eb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#059669',
};

// Same rationale as COLORS above -- a small shared scale so new screens (and
// the shared components in src/components/) don't each invent their own
// spacing/radius numbers, without rewriting every existing screen's
// already-working StyleSheet.
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const RADIUS = { sm: 8, md: 12, lg: 14, xl: 20, pill: 999 };
