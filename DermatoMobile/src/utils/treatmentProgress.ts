import { TreatmentPlanOut } from '../api/client';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface TreatmentProgress {
  totalDays: number;
  elapsedDays: number;
  pct: number;
  overdue: boolean;
}

// Mirrors frontend/src/utils/treatmentProgress.js exactly. Returns null for non-active
// plans or plans with no expected_recheck_at (Referral-type recommendations have no
// duration_weeks, so there's no recheck window to show progress against).
export function computeTreatmentProgress(plan: TreatmentPlanOut): TreatmentProgress | null {
  if (plan.status !== 'active' || !plan.expected_recheck_at) return null;

  const start = new Date(plan.started_at);
  const end = new Date(plan.expected_recheck_at);
  const now = new Date();
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
  const elapsedDays = Math.round((now.getTime() - start.getTime()) / MS_PER_DAY);

  return {
    totalDays,
    elapsedDays: Math.min(Math.max(elapsedDays, 0), totalDays),
    pct: Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)),
    overdue: now > end,
  };
}
