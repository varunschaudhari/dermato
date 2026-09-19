import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import {
  ScanFace, TrendingUp, CalendarClock, Gauge, ArrowUpRight, ArrowDownRight,
  ClipboardList, Bell, ChevronRight, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPatient, getPatientSessions, getTreatmentPlans, getAppointments, getNotifications } from '../services/api'
import { computeSkinScoreFromSession, scoreMeta } from '../utils/skinScore'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import LastUpdated from '../components/ui/LastUpdated'

const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }

// Figures out the single most relevant thing for the patient to see right now,
// in priority order: overdue recheck > imminent appointment > unread notification.
function getPriorityAlert({ plans, upcomingAppointment, notifications }) {
  const overduePlan = plans.find(
    (p) => p.status === 'active' && p.expected_recheck_at && new Date(p.expected_recheck_at) < new Date()
  )
  if (overduePlan) {
    const label = CONDITION_LABELS[overduePlan.condition] || overduePlan.condition
    return {
      key: 'overdue',
      variant: 'warning',
      title: `Your ${label} recheck is overdue — run a new analysis or book a follow-up.`,
      actions: [
        { to: '/', label: 'New Analysis' },
        { to: '/appointments', label: 'Book Follow-up' },
      ],
    }
  }

  if (upcomingAppointment) {
    const hoursAway = (new Date(upcomingAppointment.scheduled_at) - new Date()) / (1000 * 60 * 60)
    if (hoursAway <= 48) {
      return {
        key: 'appointment',
        variant: 'info',
        icon: CalendarClock,
        title: `Appointment with Dr. ${upcomingAppointment.doctor_name} on ${new Date(upcomingAppointment.scheduled_at).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })}.`,
        actions: [{ to: '/appointments', label: 'View details' }],
      }
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length
  if (unreadCount > 0) {
    return {
      key: 'notifications',
      variant: 'neutral',
      icon: Bell,
      title: `You have ${unreadCount} unread update${unreadCount === 1 ? '' : 's'} — tap to view.`,
      actions: [{ to: '/notifications', label: 'View' }],
    }
  }

  return null
}

// Last 8 visits' skin score, rendered as a plain line with no axes/tooltip —
// a glance-able trend inside the hero, not a substitute for the full chart
// on the Progress page (which ScoreTrend there already covers in depth).
function HeroSparkline({ sessions }) {
  const points = sessions.slice(-8).map((s) => ({ score: computeSkinScoreFromSession(s) })).filter((p) => p.score != null)
  if (points.length < 2) return null
  return (
    <div className="h-10 w-24 sm:w-28 shrink-0 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="score" stroke="#fff" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function PatientHomePage() {
  const { user } = useAuth()
  const patientId = user.patient_id

  const { data: patient } = useQuery({
    queryKey: ['patient', String(patientId)],
    queryFn: () => getPatient(patientId).then((r) => r.data),
    enabled: !!patientId,
  })

  const { data: sessions = [], isLoading: sessionsLoading, dataUpdatedAt: sessionsUpdatedAt } = useQuery({
    queryKey: ['sessions', String(patientId)],
    queryFn: () => getPatientSessions(patientId).then((r) => r.data),
    enabled: !!patientId,
    refetchInterval: 30000,
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['treatment-plans', String(patientId)],
    queryFn: () => getTreatmentPlans(patientId).then((r) => r.data),
    enabled: !!patientId,
    refetchInterval: 30000,
  })

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => getAppointments().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'home'],
    queryFn: () => getNotifications(5).then((r) => r.data),
  })

  const latestSession = sessions[sessions.length - 1]
  const previousSession = sessions[sessions.length - 2]
  const score = computeSkinScoreFromSession(latestSession)
  const previousScore = computeSkinScoreFromSession(previousSession)
  const delta = score != null && previousScore != null ? score - previousScore : null
  const meta = scoreMeta(score)

  const activePlans = plans.filter((p) => p.status === 'active')
  const upcomingAppointment = appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]

  const priorityAlert = getPriorityAlert({ plans, upcomingAppointment, notifications })

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${patient?.name ? `, ${patient.name.split(' ')[0]}` : ''}`}
        subtitle="Here's where your skin journey stands today."
        action={<LastUpdated timestamp={sessionsUpdatedAt} />}
      />

      {priorityAlert && <Alert {...priorityAlert} />}

      <div className="grid sm:grid-cols-3 gap-3">
        <Button as={Link} to="/" icon={ScanFace} className="justify-center py-4">
          New Analysis
        </Button>
        <Button as={Link} to={`/progress/${patientId}`} variant="outline" icon={TrendingUp} className="justify-center py-4">
          View Progress
        </Button>
        <Button as={Link} to="/appointments" variant="outline" icon={CalendarClock} className="justify-center py-4">
          Book Appointment
        </Button>
      </div>

      {sessionsLoading ? (
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <div className="grid sm:grid-cols-2 gap-4">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      ) : (
        <>
          {sessions.length === 0 ? (
            <Card>
              <EmptyState
                icon={Sparkles}
                title="Start your first analysis"
                description="Take or upload a photo to get your skin health score and personalized recommendations."
              />
            </Card>
          ) : (
            <Card hero>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-1 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4" /> Skin Health Score
                  </p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber value={score} className="font-display text-5xl font-semibold tabular-nums" />
                    <span className="text-sm text-white/60">/ 100</span>
                  </div>
                  <span className="inline-block mt-2 text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1">{meta.label}</span>
                </div>
                <HeroSparkline sessions={sessions} />
                {delta != null && delta !== 0 && (
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${delta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {delta > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {delta > 0 ? '+' : ''}{delta} since last visit
                  </div>
                )}
                <Button
                  as={Link}
                  to={`/progress/${patientId}`}
                  variant="ghost"
                  size="sm"
                  icon={ChevronRight}
                  className="text-white/80 hover:bg-white/10 hover:text-white"
                >
                  See full trend
                </Button>
              </div>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-brand-600" />
                Active Treatments
              </h2>
              {activePlans.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">No active treatment plans right now.</p>
              ) : (
                <div className="space-y-2">
                  {activePlans.map((p) => {
                    const overdue = p.expected_recheck_at && new Date(p.expected_recheck_at) < new Date()
                    return (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-700 dark:text-gray-300">{CONDITION_LABELS[p.condition] || p.condition}</span>
                          {p.expected_recheck_at && (
                            <p className={`text-xs mt-0.5 ${overdue ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                              {overdue ? 'Recheck overdue since ' : 'Recheck due '}
                              {new Date(p.expected_recheck_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <Badge color="brand">{p.remedy_type}</Badge>
                      </div>
                    )
                  })}
                  <Link
                    to={`/progress/${patientId}#treatment-plans`}
                    className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium mt-1 hover:text-brand-800 dark:hover:text-brand-300"
                  >
                    View details <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-brand-600" />
                Next Appointment
              </h2>
              {upcomingAppointment ? (
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Dr. {upcomingAppointment.doctor_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(upcomingAppointment.scheduled_at).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">No upcoming appointments scheduled.</p>
              )}
              <Link
                to="/appointments"
                className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium mt-2 hover:text-brand-800 dark:hover:text-brand-300"
              >
                Manage appointments <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" />
              Recent Updates
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Nothing new — you're all caught up.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-2 text-sm py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <span className={n.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200 font-medium'}>
                      {n.message}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
