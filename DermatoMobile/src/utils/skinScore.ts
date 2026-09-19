import { Severity, SessionOut } from '../api/client';

// Mirrors frontend/src/utils/skinScore.js exactly — same formula, same
// thresholds, so the score patients see matches across web and mobile.
const SEVERITY_POINTS: Record<string, number> = { mild: 100, moderate: 60, severe: 20 };

export function computeSkinScoreFromSeverities(severities: Record<string, Severity | undefined>): number | null {
  const values = Object.values(severities).filter(Boolean) as string[];
  if (values.length === 0) return null;
  const total = values.reduce((sum, level) => sum + (SEVERITY_POINTS[level] ?? 60), 0);
  return Math.round(total / values.length);
}

export function computeSkinScoreFromSession(session?: SessionOut): number | null {
  if (!session) return null;
  return computeSkinScoreFromSeverities({
    acne: session.acne_severity,
    pigmentation: session.pigmentation_severity,
    wrinkle: session.wrinkle_severity,
    pore: session.pore_severity,
  });
}

export function scoreMeta(score: number | null): { label: string; color: string } {
  if (score == null) return { label: 'No data', color: '#9ca3af' };
  if (score >= 85) return { label: 'Excellent', color: '#059669' };
  if (score >= 65) return { label: 'Good', color: '#0d9488' };
  if (score >= 40) return { label: 'Fair', color: '#d97706' };
  return { label: 'Needs Attention', color: '#dc2626' };
}
