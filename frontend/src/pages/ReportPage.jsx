import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Stethoscope, ArrowLeft, ArrowUpCircle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { getSession, getPatient, getTreatmentPlans } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge, { SEVERITY } from '../components/ui/Badge'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'

const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }

const OUTCOME_META = {
  improved: { color: 'green', icon: ArrowDownRight, label: 'Improved' },
  unchanged: { color: 'gray', icon: Minus, label: 'Unchanged' },
  worsened: { color: 'red', icon: ArrowUpRight, label: 'Worsened' },
}

export default function ReportPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId).then((r) => r.data),
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', session?.patient_id],
    queryFn: () => getPatient(session.patient_id).then((r) => r.data),
    enabled: !!session,
  })

  const { data: treatmentPlans = [] } = useQuery({
    queryKey: ['treatment-plans', session?.patient_id],
    queryFn: () => getTreatmentPlans(session.patient_id).then((r) => r.data),
    enabled: !!session,
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <SkeletonCard lines={8} />
      </div>
    )
  }

  if (isError || !session) {
    return <QueryError message="Couldn't load this report." />
  }

  const conditions = Object.keys(CONDITION_LABELS).filter((c) => session[`${c}_severity`])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button icon={Printer} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <Card className="print:!bg-white print:shadow-none print:border-0">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-100 dark:border-gray-800 print:!border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 print:!text-gray-900">Dermato Skin Analysis Report</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400">
              Generated {new Date().toLocaleDateString()} · Session captured {new Date(session.captured_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {patient && (
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-gray-400 dark:text-gray-500 print:!text-gray-400 text-xs">Patient</p>
              <p className="font-medium text-gray-800 dark:text-gray-200 print:!text-gray-800">{patient.name} (Age {patient.age}, {patient.skin_type} skin)</p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-gray-500 print:!text-gray-400 text-xs">Dermatologist</p>
              <p className="font-medium text-gray-800 dark:text-gray-200 print:!text-gray-800">{patient.assigned_doctor?.full_name || 'Not yet assigned'}</p>
            </div>
          </div>
        )}

        <img
          src={session.image_url}
          alt="Analyzed skin"
          className="w-full max-h-80 object-contain rounded-xl bg-gray-50 dark:bg-gray-800 print:!bg-gray-50 mb-6"
        />

        <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Severity Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {conditions.map((c) => {
            const level = session[`${c}_severity`]
            const meta = SEVERITY[level]
            return (
              <div key={c} className="text-center bg-gray-50 dark:bg-gray-800 print:!bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 print:!text-gray-500 mb-1">{CONDITION_LABELS[c]}</p>
                <Badge color={meta?.color} icon={meta?.icon}>{level}</Badge>
              </div>
            )
          })}
        </div>

        {session.recommendations && (
          <>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Recommendations</h2>
            <div className="space-y-3 mb-6">
              {conditions.map((c) => {
                const rec = session.recommendations[c]
                if (!rec) return null
                return (
                  <div key={c} className="text-sm">
                    <p className="font-medium text-gray-800 dark:text-gray-200 print:!text-gray-800 flex items-center gap-1.5">
                      {CONDITION_LABELS[c]} — <span className="text-gray-500 dark:text-gray-400 print:!text-gray-500 font-normal">{rec.type}</span>
                      {rec.escalated && <Badge color="amber" icon={ArrowUpCircle}>Escalated</Badge>}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 print:!text-gray-600">{rec.examples.join(', ')}</p>
                    {rec.duration_weeks && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400">Duration: {rec.duration_weeks} weeks</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {treatmentPlans.length > 0 && (
          <>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Treatment History</h2>
            <div className="space-y-2 mb-6">
              {[...treatmentPlans].reverse().map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400 print:!text-gray-600">
                  <span>
                    <span className="font-medium">{CONDITION_LABELS[p.condition]}</span> — {p.remedy_type} from{' '}
                    {new Date(p.started_at).toLocaleDateString()}
                  </span>
                  {p.status === 'active' ? (
                    <Badge color="brand">Active</Badge>
                  ) : (
                    (() => {
                      const meta = OUTCOME_META[p.outcome] || OUTCOME_META.unchanged
                      return <Badge color={meta.color} icon={meta.icon}>{meta.label}</Badge>
                    })()
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {session.doctor_note && (
          <>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-2">Doctor's Note</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 print:!text-gray-600 bg-brand-50 dark:bg-brand-900/20 print:!bg-brand-50 rounded-xl p-3 mb-6">{session.doctor_note}</p>
          </>
        )}

        <div className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400 border-t border-gray-100 dark:border-gray-800 print:!border-gray-100 pt-4 space-y-1">
          <p className="font-medium text-gray-500 dark:text-gray-400 print:!text-gray-500">
            Analyzed with the Dermato Weighted Severity Index (WSI)
            {session.model_powered ? ' + AI detection models' : ' — classical computer vision'}
          </p>
          <p className="italic">
            {session.recommendations?.disclaimer || 'For informational use only. Please consult a dermatologist for medical advice.'}
          </p>
        </div>
      </Card>
    </div>
  )
}
