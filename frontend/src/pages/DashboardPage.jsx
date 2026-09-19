import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Activity, CalendarClock, UserX, AlarmClockOff, ClipboardList, TrendingUp,
  ArrowDownRight, ArrowUpRight, Minus,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getAnalyticsSummary, getOverdueRecheck } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { SkeletonCard } from '../components/ui/Skeleton'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import LastUpdated from '../components/ui/LastUpdated'

const STAT_CARDS = [
  { key: 'total_patients', label: 'Total Patients', icon: Users },
  { key: 'total_sessions', label: 'Total Sessions', icon: Activity },
  { key: 'sessions_this_week', label: 'Sessions This Week', icon: CalendarClock },
  { key: 'unassigned_patients', label: 'Unassigned Patients', icon: UserX },
]

const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }

const SEVERITY_COLORS = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }

const OUTCOME_META = {
  improved: { color: 'green', icon: ArrowDownRight, label: 'Improved' },
  unchanged: { color: 'gray', icon: Minus, label: 'Unchanged' },
  worsened: { color: 'red', icon: ArrowUpRight, label: 'Worsened' },
}

const PROGRESS_META = {
  improving: { label: 'Improving', classes: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
  stable: { label: 'Stable', classes: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  worsening: { label: 'Worsening', classes: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
}

export default function DashboardPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => getAnalyticsSummary().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: overdueRecheck = [] } = useQuery({
    queryKey: ['overdue-recheck'],
    queryFn: () => getOverdueRecheck().then((r) => r.data),
    refetchInterval: 30000,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" subtitle="Practice overview" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
        <SkeletonCard lines={6} className="h-72" />
      </div>
    )
  }

  const chartData = Object.entries(data.severity_distribution).map(([condition, counts]) => ({
    condition: condition.charAt(0).toUpperCase() + condition.slice(1),
    mild: counts.mild ?? 0,
    moderate: counts.moderate ?? 0,
    severe: counts.severe ?? 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Practice overview across all patients"
        action={<LastUpdated timestamp={dataUpdatedAt} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                <AnimatedNumber value={data[key]} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </Card>
        ))}
        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlarmClockOff className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <AnimatedNumber value={overdueRecheck.length} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Overdue Rechecks</p>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Severity Distribution by Condition</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="condition" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="mild" stackId="a" fill={SEVERITY_COLORS.mild} />
            <Bar dataKey="moderate" stackId="a" fill={SEVERITY_COLORS.moderate} />
            <Bar dataKey="severe" stackId="a" fill={SEVERITY_COLORS.severe} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-600" />
            Treatment Summary
          </h2>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            <AnimatedNumber value={data.treatment_summary.active_plans} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Active treatment plans</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(OUTCOME_META).map(([key, meta]) => (
              <Badge key={key} color={meta.color} icon={meta.icon}>
                {data.treatment_summary.outcome_distribution[key] ?? 0} {meta.label}
              </Badge>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Progress Summary
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Patients with 2+ sessions, comparing their first visit to their latest
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PROGRESS_META).map(([key, meta]) => (
              <div key={key} className={`text-center rounded-xl py-3 ${meta.classes}`}>
                <p className="text-2xl font-bold">
                  <AnimatedNumber value={data.progress_summary[key]} className="text-2xl font-bold" />
                </p>
                <p className="text-xs">{meta.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {overdueRecheck.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlarmClockOff className="w-5 h-5 text-amber-600" />
            Overdue for Recheck
          </h2>
          <div className="space-y-2">
            {overdueRecheck.map((o) => (
              <Link
                key={`${o.patient_id}-${o.condition}`}
                to={`/progress/${o.patient_id}`}
                className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded-lg transition"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {o.patient_name} — {CONDITION_LABELS[o.condition]}
                </span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {o.days_overdue} day{o.days_overdue === 1 ? '' : 's'} overdue
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Doctor Caseloads</h2>
        {data.doctor_caseloads.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No dermatologists on staff yet.</p>
        ) : (
          <div className="space-y-2">
            {data.doctor_caseloads.map((d) => (
              <div key={d.doctor_name} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-300">{d.doctor_name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.patient_count} patients</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
