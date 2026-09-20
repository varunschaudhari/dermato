import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Stethoscope, ArrowLeft, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { getPatient, getPatientSessions, getTreatmentPlans } from '../services/api'
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

const SKIN_HISTORY_FIELDS = [
  ['allergies', 'Allergies'],
  ['current_products', 'Current skincare products'],
  ['known_conditions', 'Known conditions'],
  ['medications', 'Medications'],
]

export default function PatientChartPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId).then((r) => r.data),
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', patientId],
    queryFn: () => getPatientSessions(patientId).then((r) => r.data),
    enabled: !!patient,
  })

  const { data: treatmentPlans = [] } = useQuery({
    queryKey: ['treatment-plans', patientId],
    queryFn: () => getTreatmentPlans(patientId).then((r) => r.data),
    enabled: !!patient,
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    )
  }

  if (isError || !patient) {
    return <QueryError message="Couldn't load this patient's chart." />
  }

  const history = patient.skin_history || {}
  const hasHistory = SKIN_HISTORY_FIELDS.some(([key]) => history[key])

  const plansByCondition = {}
  for (const p of treatmentPlans) {
    ;(plansByCondition[p.condition] ??= []).push(p)
  }

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
            <p className="font-bold text-gray-900 dark:text-gray-100 print:!text-gray-900">Dermato Patient Chart</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400">
              Generated {new Date().toLocaleDateString()} · {sessions.length} recorded visit{sessions.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

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

        {hasHistory && (
          <>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Skin History</h2>
            <dl className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {SKIN_HISTORY_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400">{label}</dt>
                  <dd className="text-gray-700 dark:text-gray-300 print:!text-gray-700">{history[key] || '—'}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {treatmentPlans.length > 0 && (
          <>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Treatment History</h2>
            <div className="space-y-4 mb-6">
              {Object.entries(plansByCondition).map(([condition, plans]) => (
                <div key={condition}>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-1.5">{CONDITION_LABELS[condition]}</p>
                  <div className="space-y-1.5">
                    {[...plans].reverse().map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400 print:!text-gray-600">
                        <span>{p.remedy_type} from {new Date(p.started_at).toLocaleDateString()}</span>
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
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="font-semibold text-gray-800 dark:text-gray-200 print:!text-gray-800 mb-3">Visit History</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-4 mb-6">
            {[...sessions].reverse().map((s) => {
              const conditions = Object.keys(CONDITION_LABELS).filter((c) => s[`${c}_severity`])
              return (
                <div key={s.id} className="border border-gray-100 dark:border-gray-800 print:!border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 print:!text-gray-700">
                      {new Date(s.captured_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {conditions.map((c) => {
                      const meta = SEVERITY[s[`${c}_severity`]]
                      return (
                        <Badge key={c} color={meta?.color} icon={meta?.icon}>
                          {CONDITION_LABELS[c]}: {s[`${c}_severity`]}
                        </Badge>
                      )
                    })}
                  </div>
                  {s.doctor_note && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 print:!text-gray-600 bg-brand-50 dark:bg-brand-900/20 print:!bg-brand-50 rounded-lg px-2.5 py-1.5">
                      {s.doctor_note}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 print:!text-gray-400 italic border-t border-gray-100 dark:border-gray-800 print:!border-gray-100 pt-4">
          For informational use only. Please consult a dermatologist for medical advice.
        </p>
      </Card>
    </div>
  )
}
