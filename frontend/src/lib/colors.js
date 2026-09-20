// Single source of truth for hex color values used outside Tailwind's class
// system — Recharts, Canvas, and inline SVG all need raw hex/rgb, so they
// can't consume the `brand`/`gray` scale defined in tailwind.config.js.
// Keep these in sync with that file's `brand` scale and with
// DermatoMobile/src/constants.ts, which mirrors CONDITION_COLORS,
// SEVERITY_COLORS, and DETECTION_COLORS for cross-platform consistency.

export const BRAND_TEAL = '#0d9488'

// Colors are the validated 4-slot categorical order (blue/orange/aqua/yellow)
// used everywhere these conditions get charted — same order, run through a
// colorblind-safety checker rather than picked by eye.
export const CONDITION_COLORS = {
  acne: '#eb6834',
  wrinkle: '#2a78d6',
  pigmentation: '#eda100',
  pore: '#1baf7a',
}

// Mirrors DermatoMobile/src/constants.ts's SEVERITY_META colors, so a chart
// bar and a mobile badge for the same severity always read as the same hue.
export const SEVERITY_COLORS = {
  mild: '#059669',
  moderate: '#d97706',
  severe: '#dc2626',
}

// Classical-CV overlay / ML detection-box colors, mirrored exactly in
// DermatoMobile/src/screens/ResultsScreen.tsx's OVERLAY_META/CATEGORY_COLOR.
export const DETECTION_COLORS = {
  acne: '#ef4444',
  pigmentation: '#a855f7',
  wrinkle: '#0ea5e9',
  pore: '#d97706',
  other: '#9ca3af',
}
