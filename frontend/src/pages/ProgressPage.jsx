import { useState, useEffect } from 'react'
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactCompareImage from 'react-compare-image'
import { TrendingUp, History, Images, Inbox, FileText, MessageSquarePlus, MessageSquare, ClipboardList, ArrowDownRight, ArrowUpRight, ArrowRight, Minus, Download, Trash2, FileStack, Gauge, GalleryHorizontal, Share2 } from 'lucide-react'
import { getPatient, getPatientSessions, getTreatmentPlans, updateDoctorNote, updateTreatmentAdherence, updateSkinHistory, exportPatientData, deletePatient } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { computeSkinScoreFromSession, scoreMeta } from '../utils/skinScore'
import { computeTreatmentProgress } from '../utils/treatmentProgress'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BRAND_TEAL, CONDITION_COLORS } from '../lib/colors'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Badge, { SEVERITY } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import MessageThread from '../components/ui/MessageThread'
import Tabs from '../components/ui/Tabs'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import LastUpdated from '../components/ui/LastUpdated'

const SEVERITY_NUM = { mild: 1, moderate: 2, severe: 3 }
const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }
const HASH_TAB = { 'treatment-plans': 'treatment', messages: 'messages' }

const OUTCOME_META = {
  improved: { color: 'green', icon: ArrowDownRight, label: 'Improved' },
  unchanged: { color: 'gray', icon: Minus, label: 'Unchanged' },
  worsened: { color: 'red', icon: ArrowUpRight, label: 'Worsened' },
}

const ADHERENCE_LABELS = {
  followed: 'You said: Followed it',
  partial: 'You said: Partially followed it',
  not_followed: "You said: Didn't follow it",
}

function AdherenceCheckIn({ plan, patientId }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (adherence) => updateTreatmentAdherence(patientId, plan.id, adherence),
    onSuccess: () => qc.invalidateQueries(['treatment-plans', patientId]),
  })

  if (plan.adherence) {
    return <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{ADHERENCE_LABELS[plan.adherence]}</p>
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Did you follow this treatment?</p>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={() => mutation.mutate('followed')} disabled={mutation.isPending}>
          Yes
        </Button>
        <Button size="sm" variant="outline" onClick={() => mutation.mutate('partial')} disabled={mutation.isPending}>
          Partially
        </Button>
        <Button size="sm" variant="outline" onClick={() => mutation.mutate('not_followed')} disabled={mutation.isPending}>
          No
        </Button>
      </div>
    </div>
  )
}

function TreatmentPlans({ plans, patientId, isPatient }) {
  if (plans.length === 0) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title="No treatment plans yet" description="Plans appear here once a recommendation is issued from an analysis." />
      </Card>
    )
  }

  const byCondition = {}
  for (const p of plans) {
    ;(byCondition[p.condition] ??= []).push(p)
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-brand-600" />
        Treatment Plans
      </h2>
      <div className="space-y-5">
        {Object.entries(byCondition).map(([condition, condPlans]) => {
          const sorted = [...condPlans].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
          const active = sorted.find((p) => p.status === 'active')
          const history = sorted.filter((p) => p.status !== 'active')
          const overdue = active?.expected_recheck_at && new Date(active.expected_recheck_at) < new Date()
          const progress = active ? computeTreatmentProgress(active) : null

          return (
            <div key={condition}>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">{CONDITION_LABELS[condition]}</p>

              {active && (
                <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-3 mb-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{active.remedy_type}:</span> {active.remedy_text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Started {new Date(active.started_at).toLocaleDateString()}
                    {active.expected_recheck_at && (
                      <>
                        {' · '}
                        <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          {overdue ? 'Recheck overdue since ' : 'Recheck due by '}
                          {new Date(active.expected_recheck_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </p>
                  {progress && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${progress.pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                        Day {progress.elapsedDays} of {progress.totalDays}
                      </span>
                    </div>
                  )}
                  {isPatient && <AdherenceCheckIn plan={active} patientId={patientId} />}
                </div>
              )}

              {history.length > 0 && (
                <div className="space-y-1.5">
                  {history.map((p) => {
                    const meta = OUTCOME_META[p.outcome] || OUTCOME_META.unchanged
                    return (
                      <div key={p.id} className="text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center justify-between gap-2">
                          <span>{p.remedy_type} from {new Date(p.started_at).toLocaleDateString()}</span>
                          <Badge color={meta.color} icon={meta.icon}>{meta.label}</Badge>
                        </div>
                        {p.severity_at_start && p.outcome_severity && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge color={SEVERITY[p.severity_at_start]?.color} icon={SEVERITY[p.severity_at_start]?.icon}>
                              {p.severity_at_start}
                            </Badge>
                            <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                            <Badge color={SEVERITY[p.outcome_severity]?.color} icon={SEVERITY[p.outcome_severity]?.icon}>
                              {p.outcome_severity}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const SKIN_HISTORY_FIELDS = [
  ['allergies', 'Allergies'],
  ['current_products', 'Current skincare products'],
  ['known_conditions', 'Known conditions'],
  ['medications', 'Medications'],
]

function SkinHistory({ patient, canEdit }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const history = patient.skin_history || {}
  const [form, setForm] = useState({
    allergies: history.allergies || '',
    current_products: history.current_products || '',
    known_conditions: history.known_conditions || '',
    medications: history.medications || '',
  })

  const mutation = useMutation({
    mutationFn: (data) => updateSkinHistory(patient.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['patient', String(patient.id)])
      toast.success('Skin history saved.')
      setEditing(false)
    },
    onError: () => toast.error('Could not save skin history.'),
  })

  const hasAny = SKIN_HISTORY_FIELDS.some(([key]) => history[key])

  if (!canEdit && !hasAny) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-600" />
          Skin History
        </h2>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {SKIN_HISTORY_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:border-brand-500"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : hasAny ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {SKIN_HISTORY_FIELDS.map(([key, label]) => (
            <div key={key}>
              <dt className="text-xs text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className="text-gray-700 dark:text-gray-300">{history[key] || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">No skin history recorded yet.</p>
      )}
    </Card>
  )
}

function ScoreTrend({ sessions }) {
  const scored = sessions.map((s, i) => ({
    session: `Visit ${i + 1}`,
    score: computeSkinScoreFromSession(s),
  }))
  const latest = scored[scored.length - 1]?.score
  const first = scored[0]?.score
  const delta = latest != null && first != null && scored.length > 1 ? latest - first : null
  const meta = scoreMeta(latest)

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <Gauge className="w-5 h-5 text-brand-600" />
        Skin Health Score
      </h2>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <AnimatedNumber value={latest} className="text-4xl font-bold text-gray-900 dark:text-gray-100" />
        <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
        {delta != null && delta !== 0 && (
          <span className={`text-sm font-medium ${delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta} since first visit
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={scored}>
          <XAxis dataKey="session" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke={BRAND_TEAL} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

function PhotoTimeline({ sessions }) {
  if (sessions.length === 0) return null
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <GalleryHorizontal className="w-5 h-5 text-brand-600" />
        Photo Timeline
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {sessions.map((s) => {
          const score = computeSkinScoreFromSession(s)
          return (
            <Link key={s.id} to={`/report/${s.id}`} className="shrink-0 w-28 text-center group">
              <div className="relative">
                <img
                  src={s.image_url}
                  alt={new Date(s.captured_at).toLocaleDateString()}
                  className="w-28 h-28 object-cover rounded-xl border border-gray-200 dark:border-gray-700 group-hover:border-brand-400 transition"
                />
                {score != null && (
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {score}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {new Date(s.captured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

function ShareProgressButton({ patient, sessions }) {
  const handleShare = () => {
    const first = computeSkinScoreFromSession(sessions[0])
    const latest = computeSkinScoreFromSession(sessions[sessions.length - 1])
    if (first == null || latest == null) return

    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, 1080, 1080)
    grad.addColorStop(0, BRAND_TEAL)
    grad.addColorStop(1, '#134e4a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1080, 1080)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px sans-serif'
    ctx.fillText('Dermato', 540, 150)

    ctx.font = '32px sans-serif'
    ctx.fillText(`${patient.name}'s Skin Journey`, 540, 220)

    ctx.font = 'bold 220px sans-serif'
    ctx.fillText(String(latest), 540, 560)

    ctx.font = '36px sans-serif'
    ctx.fillText('Skin Health Score', 540, 620)

    const delta = latest - first
    ctx.font = 'bold 44px sans-serif'
    ctx.fillStyle = delta >= 0 ? '#86efac' : '#fca5a5'
    ctx.fillText(`${delta >= 0 ? '+' : ''}${delta} points since first visit`, 540, 720)

    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '24px sans-serif'
    ctx.fillText(
      `${new Date(sessions[0].captured_at).toLocaleDateString()} → ${new Date(sessions[sessions.length - 1].captured_at).toLocaleDateString()}`,
      540,
      780
    )

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = 'italic 20px sans-serif'
    ctx.fillText('AI-assisted skin analysis · for informational use only', 540, 1020)

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-skin-progress.png'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <Button variant="outline" size="sm" icon={Share2} onClick={handleShare}>
      Share Progress
    </Button>
  )
}

function SummaryStrip({ sessions, activeTreatmentCount }) {
  const latest = sessions[sessions.length - 1]
  const score = computeSkinScoreFromSession(latest)
  const meta = scoreMeta(score)

  if (!latest) {
    return (
      <Card className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">No analysis recorded yet.</p>
        {activeTreatmentCount > 0 && (
          <Badge color="brand" icon={ClipboardList}>
            {activeTreatmentCount} active treatment{activeTreatmentCount === 1 ? '' : 's'}
          </Badge>
        )}
      </Card>
    )
  }

  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="flex items-baseline gap-2 pr-4 sm:border-r border-gray-100 dark:border-gray-800">
        <AnimatedNumber value={score} className="text-2xl font-bold text-gray-900 dark:text-gray-100" />
        <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(CONDITION_LABELS).map(([key, label]) => {
          const level = latest[`${key}_severity`]
          if (!level) return null
          const s = SEVERITY[level] ?? SEVERITY.mild
          return (
            <Badge key={key} color={s.color} icon={s.icon}>
              {label}: {level}
            </Badge>
          )
        })}
      </div>
      {activeTreatmentCount > 0 && (
        <Badge color="gray" icon={ClipboardList} className="sm:ml-auto">
          {activeTreatmentCount} active treatment{activeTreatmentCount === 1 ? '' : 's'}
        </Badge>
      )}
    </Card>
  )
}

function DoctorNote({ session, canEdit, patientId }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(session.doctor_note || '')

  const mutation = useMutation({
    mutationFn: (text) => updateDoctorNote(session.id, text),
    onSuccess: () => {
      qc.invalidateQueries(['sessions', patientId])
      toast.success('Note saved.')
      setEditing(false)
    },
    onError: () => toast.error('Could not save note. Please try again.'),
  })

  if (!canEdit) {
    return session.doctor_note ? (
      <p className="text-xs text-gray-600 dark:text-gray-400 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2 mt-2">
        <span className="font-medium">Doctor's note:</span> {session.doctor_note}
      </p>
    ) : null
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:border-brand-500"
          placeholder="Add a note for this patient..."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => mutation.mutate(note)} disabled={mutation.isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return session.doctor_note ? (
    <button
      onClick={() => setEditing(true)}
      className="text-xs text-gray-600 dark:text-gray-400 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2 mt-2 text-left w-full hover:bg-brand-100 dark:hover:bg-brand-900/40 transition"
    >
      <span className="font-medium">Doctor's note:</span> {session.doctor_note}
    </button>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium mt-2"
    >
      <MessageSquarePlus className="w-3.5 h-3.5" />
      Add note
    </button>
  )
}

export default function ProgressPage() {
  const { patientId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const canEditNotes = user.role === 'admin' || user.role === 'dermatologist'
  const canEditHistory = canEditNotes || user.role === 'patient'
  const isAdmin = user.role === 'admin'

  const { data: patient, isError: patientError, refetch: refetchPatient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId).then((r) => r.data),
  })

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
    dataUpdatedAt: sessionsUpdatedAt,
  } = useQuery({
    queryKey: ['sessions', patientId],
    queryFn: () => getPatientSessions(patientId).then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: plans = [], isError: plansError, refetch: refetchPlans } = useQuery({
    queryKey: ['treatment-plans', patientId],
    queryFn: () => getTreatmentPlans(patientId).then((r) => r.data),
    refetchInterval: 30000,
  })

  const hasError = sessionsError || patientError || plansError
  const retryAll = () => {
    refetchSessions()
    refetchPatient()
    refetchPlans()
  }
  const activeTreatmentCount = plans.filter((p) => p.status === 'active').length

  const [activeTab, setActiveTab] = useState(() => HASH_TAB[location.hash.slice(1)] || 'overview')

  useEffect(() => {
    const target = HASH_TAB[location.hash.slice(1)]
    if (target) setActiveTab(target)
  }, [location.hash])

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [activeTab, location.hash])

  const TABS = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'history', label: 'History', icon: History, badge: sessions.length },
    { key: 'treatment', label: 'Treatment', icon: ClipboardList, badge: activeTreatmentCount },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
  ]

  // WSI (Weighted Severity Index, 0-1) is the real continuous score; older
  // sessions captured before WSI existed fall back to a band-derived proxy
  // (mild/moderate/severe -> 0/0.5/1) so the trend line stays unbroken.
  const bandScore = (severity) => {
    const num = SEVERITY_NUM[severity]
    return num != null ? (num - 1) / 2 : null
  }

  const chartData = sessions.map((s, i) => ({
    session: `Session ${i + 1}`,
    acne: s.acne_wsi ?? bandScore(s.acne_severity),
    pigmentation: s.pigmentation_wsi ?? bandScore(s.pigmentation_severity),
    wrinkle: s.wrinkle_wsi ?? bandScore(s.wrinkle_severity),
    pore: bandScore(s.pore_severity),
  }))

  const compareFirstScore = computeSkinScoreFromSession(sessions[sessions.length - 2])
  const compareLastScore = computeSkinScoreFromSession(sessions[sessions.length - 1])
  const compareDelta = compareFirstScore != null && compareLastScore != null ? compareLastScore - compareFirstScore : null

  const deleteMutation = useMutation({
    mutationFn: () => deletePatient(patientId),
    onSuccess: () => {
      toast.success(`${patient?.name || 'Patient'} deleted.`)
      navigate('/patients')
    },
    onError: () => toast.error('Could not delete patient.'),
  })

  const handleExport = async () => {
    try {
      const { data } = await exportPatientData(patientId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patient-${patientId}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded.')
    } catch {
      toast.error('Could not export patient data.')
    }
  }

  const handleDelete = () => {
    if (window.confirm(`Permanently delete ${patient?.name || 'this patient'} and all their data? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Tracking"
        subtitle={
          patient && (
            <>
              Dermatologist:{' '}
              {patient.assigned_doctor ? (
                <span className="font-medium text-gray-700 dark:text-gray-300">{patient.assigned_doctor.full_name}</span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">Not yet assigned</span>
              )}
            </>
          )
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to={`/patients/${patientId}/chart`} variant="outline" size="sm" icon={FileStack}>
              Full Chart
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
              Export Data
            </Button>
            {patient && sessions.length >= 2 && <ShareProgressButton patient={patient} sessions={sessions} />}
            {isAdmin && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Delete Patient
              </Button>
            )}
          </div>
        }
      />

      <div className="flex justify-end -mt-3">
        <LastUpdated timestamp={sessionsUpdatedAt} />
      </div>

      {sessionsLoading ? (
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      ) : hasError ? (
        <QueryError message="Couldn't load this patient's progress." onRetry={retryAll} />
      ) : (
        <>
          <SummaryStrip sessions={sessions} activeTreatmentCount={activeTreatmentCount} />

          <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}>
          {activeTab === 'overview' && (
            sessions.length === 0 ? (
              <Card>
                <EmptyState icon={Inbox} title="No sessions recorded yet" description="Run an analysis to start tracking progress." />
              </Card>
            ) : (
              <>
                <ScoreTrend sessions={sessions} />

                <PhotoTimeline sessions={sessions} />

                {sessions.length >= 2 && (
                  <Card>
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Images className="w-5 h-5 text-brand-600" />
                      Before vs. After
                    </h2>
                    <div className="relative">
                      {compareDelta != null && compareDelta !== 0 && (
                        <div
                          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold px-3 py-1.5 rounded-full border shadow-sm bg-white dark:bg-gray-900 ${
                            compareDelta > 0
                              ? 'text-green-600 dark:text-green-400 border-green-500'
                              : 'text-red-600 dark:text-red-400 border-red-500'
                          }`}
                        >
                          {compareDelta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {compareDelta > 0 ? '+' : ''}{compareDelta} pts
                          <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            since previous visit
                          </span>
                        </div>
                      )}
                      <ReactCompareImage
                        leftImage={sessions[sessions.length - 2].image_url}
                        rightImage={sessions[sessions.length - 1].image_url}
                        leftImageLabel="Previous visit"
                        rightImageLabel="Latest visit"
                      />
                    </div>
                  </Card>
                )}
              </>
            )
          )}

          {activeTab === 'history' && (
            sessions.length === 0 ? (
              <Card>
                <EmptyState icon={Inbox} title="No sessions recorded yet" description="Run an analysis to start tracking progress." />
              </Card>
            ) : (
              <>
                <Card>
                  <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-brand-600" />
                    Severity Over Time
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Weighted Severity Index per visit — lower is better</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                      <XAxis dataKey="session" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => ({ 0: 'Mild', 0.5: 'Moderate', 1: 'Severe' })[v]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => (value == null ? '—' : value.toFixed(2))} />
                      <Legend />
                      {/* Colors are the validated 4-slot categorical order (blue/orange/aqua/yellow) —
                          run through the colorblind-safety checker rather than picked by eye. */}
                      <Line type="monotone" dataKey="acne" stroke={CONDITION_COLORS.acne} strokeWidth={2} />
                      <Line type="monotone" dataKey="pigmentation" stroke={CONDITION_COLORS.pigmentation} strokeWidth={2} />
                      <Line type="monotone" dataKey="wrinkle" stroke={CONDITION_COLORS.wrinkle} strokeWidth={2} />
                      <Line type="monotone" dataKey="pore" stroke={CONDITION_COLORS.pore} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-brand-600" />
                    Session History
                  </h2>
                  <div className="space-y-4">
                    {[...sessions].reverse().map((s) => (
                      <div key={s.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {new Date(s.captured_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                          <Button as={Link} to={`/report/${s.id}`} variant="ghost" size="sm" icon={FileText}>
                            View Report
                          </Button>
                        </div>
                        {s.images && Object.keys(s.images).length > 1 && (
                          <div className="flex gap-2 mb-2">
                            {Object.entries(s.images).map(([angle, url]) => (
                              <div key={angle} className="text-center">
                                <img
                                  src={url}
                                  alt={`${angle} angle`}
                                  className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                />
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize mt-0.5">{angle}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(CONDITION_LABELS).map(([key, label]) => {
                            const level = s[`${key}_severity`]
                            if (!level) return null
                            const meta = SEVERITY[level]
                            const wsi = s[`${key}_wsi`]
                            return (
                              <Badge key={key} color={meta?.color} icon={meta?.icon}>
                                {label}: {level}
                                {wsi != null && <span className="font-mono tabular-nums opacity-70"> · {wsi.toFixed(2)}</span>}
                              </Badge>
                            )
                          })}
                        </div>
                        {Object.keys(CONDITION_LABELS).some((key) => s[`${key}_flag`]) && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(CONDITION_LABELS).map(([key, label]) => {
                              const flag = s[`${key}_flag`]
                              if (!flag) return null
                              return (
                                <p key={key} className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                                  <span className="font-medium">{label}:</span> {flag}
                                </p>
                              )
                            })}
                          </div>
                        )}
                        <DoctorNote session={s} canEdit={canEditNotes} patientId={patientId} />
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )
          )}

          {activeTab === 'treatment' && (
            <>
              <div id="treatment-plans">
                <TreatmentPlans plans={plans} patientId={patientId} isPatient={user.role === 'patient'} />
              </div>
              {patient && <SkinHistory patient={patient} canEdit={canEditHistory} />}
            </>
          )}

          {activeTab === 'messages' && (
            <div id="messages">
              <MessageThread patientId={patientId} />
            </div>
          )}
          </Tabs>
        </>
      )}
    </div>
  )
}
