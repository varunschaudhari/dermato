// A single composite 0-100 "Skin Health Score" rolled up from the four
// per-condition severities, so patients have one number to track instead of
// four separate badges. Purely derived from data already on the session —
// no backend field, so the formula can be tuned without a migration.
const SEVERITY_POINTS = { mild: 100, moderate: 60, severe: 20 }

export function computeSkinScoreFromSeverities(severities) {
  const values = Object.values(severities || {}).filter(Boolean)
  if (values.length === 0) return null
  const total = values.reduce((sum, level) => sum + (SEVERITY_POINTS[level] ?? 60), 0)
  return Math.round(total / values.length)
}

export function computeSkinScoreFromSession(session) {
  if (!session) return null
  return computeSkinScoreFromSeverities({
    acne: session.acne_severity,
    pigmentation: session.pigmentation_severity,
    wrinkle: session.wrinkle_severity,
    pore: session.pore_severity,
  })
}

export function scoreMeta(score) {
  if (score == null) return { label: 'No data', color: 'text-gray-400 dark:text-gray-500' }
  if (score >= 85) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' }
  if (score >= 65) return { label: 'Good', color: 'text-brand-600 dark:text-brand-400' }
  if (score >= 40) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400' }
  return { label: 'Needs Attention', color: 'text-red-600 dark:text-red-400' }
}
