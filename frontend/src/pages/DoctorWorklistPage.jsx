import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserX, AlarmClockOff, MessageCircle, CalendarClock, UserCheck, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { getOverdueRecheck, getMessagesInbox, getPatients, getAppointments, assignDoctor } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Alert from '../components/ui/Alert'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import LastUpdated from '../components/ui/LastUpdated'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'

const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

// Priority order mirrors PatientHomePage's getPriorityAlert: the single most
// pressing thing first, rather than showing every section's banner at once.
function getPriorityAlert({ unclaimedCount, overdueCount, unreadCount }) {
  if (unclaimedCount > 0) {
    return {
      key: 'unclaimed',
      variant: 'warning',
      icon: UserX,
      title: `${unclaimedCount} unclaimed patient${unclaimedCount === 1 ? '' : 's'} waiting.`,
    }
  }
  if (overdueCount > 0) {
    return {
      key: 'overdue',
      variant: 'warning',
      icon: AlarmClockOff,
      title: `${overdueCount} recheck${overdueCount === 1 ? '' : 's'} overdue.`,
    }
  }
  if (unreadCount > 0) {
    return {
      key: 'messages',
      variant: 'info',
      icon: MessageCircle,
      title: `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}.`,
    }
  }
  return null
}

function ClaimButton({ patient }) {
  const qc = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => assignDoctor(patient.id, undefined),
    onSuccess: () => {
      qc.invalidateQueries(['patients'])
      toast.success(`${patient.name} claimed.`)
    },
    onError: () => toast.error('Could not claim patient.'),
  })

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium shrink-0"
    >
      <UserCheck className="w-3.5 h-3.5" />
      Claim
    </button>
  )
}

export default function DoctorWorklistPage() {
  const { data: overdueRecheck = [], isLoading: overdueLoading, isError: overdueError, refetch: refetchOverdue, dataUpdatedAt } = useQuery({
    queryKey: ['overdue-recheck'],
    queryFn: () => getOverdueRecheck().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: messagesInbox = [], isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: () => getMessagesInbox().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: patients = [], isLoading: patientsLoading, isError: patientsError, refetch: refetchPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients().then((r) => r.data),
  })

  const { data: appointments = [], isLoading: appointmentsLoading, isError: appointmentsError, refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => getAppointments().then((r) => r.data),
  })

  const isLoading = overdueLoading || messagesLoading || patientsLoading || appointmentsLoading
  const isError = overdueError || messagesError || patientsError || appointmentsError
  const retryAll = () => {
    refetchOverdue()
    refetchMessages()
    refetchPatients()
    refetchAppointments()
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Worklist" subtitle="Today's priorities" />
        <QueryError message="Couldn't load your worklist." onRetry={retryAll} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Worklist" subtitle="Today's priorities" />
        <div className="grid grid-cols-3 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <SkeletonCard lines={5} />
      </div>
    )
  }

  const unclaimedPatients = patients.filter((p) => !p.assigned_doctor_id)
  const unreadMessages = [...messagesInbox]
    .filter((m) => m.unread_count > 0)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
  const todaysAppointments = appointments
    .filter((a) => a.status === 'scheduled' && isToday(a.scheduled_at))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))

  const priorityAlert = getPriorityAlert({
    unclaimedCount: unclaimedPatients.length,
    overdueCount: overdueRecheck.length,
    unreadCount: unreadMessages.length,
  })

  const allCaughtUp =
    unclaimedPatients.length === 0 && overdueRecheck.length === 0 && unreadMessages.length === 0 && todaysAppointments.length === 0

  return (
    <div className="space-y-6">
      <PageHeader title="Worklist" subtitle="Today's priorities" action={<LastUpdated timestamp={dataUpdatedAt} />} />

      {priorityAlert && <Alert variant={priorityAlert.variant} icon={priorityAlert.icon} title={priorityAlert.title} />}

      {allCaughtUp ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="You're all caught up" description="No unclaimed patients, overdue rechecks, or unread messages." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Link to="/patients">
              <Card className="hover:shadow-md transition flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    <AnimatedNumber value={unclaimedPatients.length} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unclaimed</p>
                </div>
              </Card>
            </Link>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlarmClockOff className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <AnimatedNumber value={overdueRecheck.length} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Overdue Rechecks</p>
              </div>
            </Card>
            <Link to="/messages">
              <Card className="hover:shadow-md transition flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    <AnimatedNumber value={unreadMessages.length} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unread Messages</p>
                </div>
              </Card>
            </Link>
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
                      {o.patient_name} — {CONDITION_LABELS[o.condition] || o.condition}
                    </span>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {o.days_overdue} day{o.days_overdue === 1 ? '' : 's'} overdue
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {unclaimedPatients.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-600" />
                Unclaimed Patients
              </h2>
              <div className="space-y-2">
                {unclaimedPatients.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <Link to={`/progress/${p.id}`} className="text-sm text-gray-700 dark:text-gray-300 hover:text-brand-700 dark:hover:text-brand-400">
                      {p.name} <span className="text-gray-400 dark:text-gray-500">· Age {p.age}</span>
                    </Link>
                    <ClaimButton patient={p} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {unreadMessages.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-brand-600" />
                Needs a Reply
              </h2>
              <div className="space-y-2">
                {unreadMessages.map((m) => (
                  <Link
                    key={m.patient_id}
                    to={`/progress/${m.patient_id}#messages`}
                    className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded-lg transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.patient_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.last_message}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {todaysAppointments.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-brand-600" />
                Today's Appointments
              </h2>
              <div className="space-y-2">
                {todaysAppointments.map((a) => (
                  <Link
                    key={a.id}
                    to={`/progress/${a.patient_id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded-lg transition"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{a.patient_name}</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {new Date(a.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
