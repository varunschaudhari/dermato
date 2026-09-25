import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, FileEdit, GraduationCap } from 'lucide-react'
import { getRemedies, updateRemedy, getConditionEducation, updateConditionEducation } from '../services/api'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge, { SEVERITY } from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'

const CONDITION_LABELS = { acne: 'Acne', pigmentation: 'Pigmentation', wrinkle: 'Wrinkles', pore: 'Pores' }
const SEVERITIES = ['mild', 'moderate', 'severe']
const TYPE_OPTIONS = ['Home remedy', 'OTC Cosmeceutical', 'Referral']

function RemedyRow({ condition, severity, remedy, onSave, saving }) {
  const [type, setType] = useState(remedy?.type || TYPE_OPTIONS[0])
  const [examplesText, setExamplesText] = useState((remedy?.examples || []).join('\n'))
  const [durationWeeks, setDurationWeeks] = useState(remedy?.duration_weeks || '')
  const [howTo, setHowTo] = useState(remedy?.how_to || '')

  const handleSave = () => {
    onSave(condition, severity, {
      type,
      examples: examplesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      duration_weeks: durationWeeks.trim() === '' ? null : durationWeeks.trim(),
      how_to: howTo.trim() === '' ? null : howTo.trim(),
    })
  }

  const { color, icon } = SEVERITY[severity]

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
      <Badge color={color} icon={icon} className="mb-3">
        {severity}
      </Badge>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Examples (one per line)</label>
          <textarea
            rows={3}
            value={examplesText}
            onChange={(e) => setExamplesText(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Duration (weeks)</label>
          <input
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
            placeholder="e.g. 2-4"
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">How to use (shown to patients under the examples)</label>
        <textarea
          rows={2}
          value={howTo}
          onChange={(e) => setHowTo(e.target.value)}
          placeholder="e.g. Apply once daily, following the product label. Introduce one new product at a time."
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
        />
      </div>
      <div className="mt-3">
        <Button onClick={handleSave} size="sm" icon={Save} disabled={saving}>
          Save
        </Button>
      </div>
    </div>
  )
}

function EducationCard({ condition, education, onSave, saving }) {
  const [causes, setCauses] = useState(education?.causes || '')
  const [whatToExpect, setWhatToExpect] = useState(education?.what_to_expect || '')
  const [timeline, setTimeline] = useState(education?.timeline || '')
  const [severeGuidance, setSevereGuidance] = useState(education?.severe_guidance || '')

  const handleSave = () => {
    onSave(condition, {
      causes: causes.trim(),
      what_to_expect: whatToExpect.trim(),
      timeline: timeline.trim(),
      severe_guidance: severeGuidance.trim(),
    })
  }

  return (
    <Card>
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{CONDITION_LABELS[condition] || condition}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Causes</label>
          <textarea
            rows={3}
            value={causes}
            onChange={(e) => setCauses(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">What to expect</label>
          <textarea
            rows={3}
            value={whatToExpect}
            onChange={(e) => setWhatToExpect(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Timeline</label>
          <textarea
            rows={3}
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Severe-severity guidance (shown as an urgent banner to the patient)
          </label>
          <textarea
            rows={3}
            value={severeGuidance}
            onChange={(e) => setSevereGuidance(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
          />
        </div>
      </div>
      <div className="mt-3">
        <Button onClick={handleSave} size="sm" icon={Save} disabled={saving}>
          Save
        </Button>
      </div>
    </Card>
  )
}

export default function AdminContentPage() {
  const qc = useQueryClient()
  const toast = useToast()

  const { data: remedies = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['remedies'],
    queryFn: () => getRemedies().then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ condition, severity, data }) => updateRemedy(condition, severity, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries(['remedies'])
      toast.success(`Updated the ${variables.severity} ${variables.condition} remedy.`)
    },
    onError: () => toast.error('Could not save this remedy.'),
  })

  const handleSave = (condition, severity, data) => {
    updateMutation.mutate({ condition, severity, data })
  }

  const { data: education = [], isLoading: educationLoading, isError: educationError, refetch: refetchEducation } = useQuery({
    queryKey: ['condition-education'],
    queryFn: () => getConditionEducation().then((r) => r.data),
  })

  const updateEducationMutation = useMutation({
    mutationFn: ({ condition, data }) => updateConditionEducation(condition, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries(['condition-education'])
      toast.success(`Updated ${CONDITION_LABELS[variables.condition] || variables.condition} education content.`)
    },
    onError: () => toast.error('Could not save this content.'),
  })

  const handleSaveEducation = (condition, data) => {
    updateEducationMutation.mutate({ condition, data })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Content" subtitle="Edit the remedy recommendations shown to patients." />

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </div>
      ) : isError ? (
        <QueryError message="Couldn't load the remedy content." onRetry={refetch} />
      ) : remedies.length === 0 ? (
        <Card>
          <EmptyState icon={FileEdit} title="No remedy content yet" description="Remedy content will appear here once loaded." />
        </Card>
      ) : (
        <div className="space-y-4">
          {remedies.map((doc) => (
            <Card key={doc._id}>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{CONDITION_LABELS[doc._id] || doc._id}</h2>
              {SEVERITIES.map((severity) => (
                <RemedyRow
                  key={severity}
                  condition={doc._id}
                  severity={severity}
                  remedy={doc[severity]}
                  onSave={handleSave}
                  saving={updateMutation.isPending}
                />
              ))}
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-brand-600" />
          Condition education
        </h2>
        {educationLoading ? (
          <div className="space-y-4">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        ) : educationError ? (
          <QueryError message="Couldn't load education content." onRetry={refetchEducation} />
        ) : (
          <div className="space-y-4">
            {education.map((doc) => (
              <EducationCard
                key={doc._id}
                condition={doc._id}
                education={doc}
                onSave={handleSaveEducation}
                saving={updateEducationMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
