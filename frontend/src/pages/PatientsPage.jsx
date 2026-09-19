import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserPlus, KeyRound, UserCheck, ChevronRight, Users, Upload, X, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getPatients, createPatient, createPatientAccount, listUsers, assignDoctor, importPatientsCsv } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'

function CreateAccountForm({ patient, onClose }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => createPatientAccount(patient.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['patients'])
      toast.success(`Login created for ${patient.name}.`)
      onClose()
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not create login'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-3"
    >
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Login email for {patient.name}</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Temporary password</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Create Login</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}

function DoctorAssignment({ patient }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()

  const { data: dermatologists = [] } = useQuery({
    queryKey: ['dermatologists'],
    queryFn: () => listUsers().then((r) => r.data.filter((u) => u.role === 'dermatologist')),
    enabled: user.role === 'admin',
  })

  const assignMutation = useMutation({
    mutationFn: (doctorId) => assignDoctor(patient.id, doctorId),
    onSuccess: () => {
      qc.invalidateQueries(['patients'])
      toast.success(`${patient.name} assigned.`)
    },
    onError: () => toast.error('Could not update doctor assignment.'),
  })

  if (user.role === 'admin') {
    return (
      <select
        value={patient.assigned_doctor_id ?? ''}
        onChange={(e) => assignMutation.mutate(e.target.value ? Number(e.target.value) : null)}
        onClick={(e) => e.stopPropagation()}
        className="text-xs border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1.5 focus:border-brand-500"
      >
        <option value="">Unassigned</option>
        {dermatologists.map((d) => (
          <option key={d.id} value={d.id}>{d.full_name}</option>
        ))}
      </select>
    )
  }

  // dermatologist view
  if (patient.assigned_doctor_id === user.id) {
    return <Badge color="green">Your patient</Badge>
  }
  if (patient.assigned_doctor_id) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">Dr. {patient.assigned_doctor?.full_name}</span>
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        assignMutation.mutate(undefined)
      }}
      className="inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
    >
      <UserCheck className="w-3.5 h-3.5" />
      Claim Patient
    </button>
  )
}

export default function PatientsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', age: '', skin_type: '' })
  const [showForm, setShowForm] = useState(false)
  const [accountFormFor, setAccountFormFor] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const csvInputRef = useRef(null)

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (_, variables) => {
      qc.invalidateQueries(['patients'])
      toast.success(`${variables.name} added.`)
      setShowForm(false)
      setForm({ name: '', age: '', skin_type: '' })
    },
    onError: () => toast.error('Could not add patient. Please try again.'),
  })

  const importMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return importPatientsCsv(formData)
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['patients'])
      setImportResult(data)
      if (data.created.length > 0) toast.success(`Imported ${data.created.length} patient(s).`)
      if (data.errors.length > 0 && data.created.length === 0) toast.error('No rows could be imported.')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Could not import CSV.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({ ...form, age: parseInt(form.age) })
  }

  const handleCsvChange = (e) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) importMutation.mutate(selected)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => csvInputRef.current?.click()}
              icon={Upload}
              size="sm"
              variant="outline"
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? 'Importing…' : 'Import CSV'}
            </Button>
            <Button onClick={() => setShowForm(!showForm)} icon={UserPlus} size="sm">
              New Patient
            </Button>
          </div>
        }
      />
      <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />

      {importResult && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Imported {importResult.created.length} patient(s)
                {importResult.errors.length > 0 && `, ${importResult.errors.length} row(s) skipped`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {importResult.errors.map((err) => (
                    <li key={err.row} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Row {err.row}: {err.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              aria-label="Dismiss import summary"
              onClick={() => setImportResult(null)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {['name', 'age', 'skin_type'].map((field) => (
              <div key={field}>
                <label className="block text-sm text-gray-600 dark:text-gray-400 capitalize mb-1">{field.replace('_', ' ')}</label>
                <input
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                />
              </div>
            ))}
            <Button type="submit">Save Patient</Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : patients.length === 0 && !showForm ? (
        <Card>
          <EmptyState icon={Users} title="No patients yet" description="Add your first patient to get started." />
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="cursor-pointer flex-1 min-w-0" onClick={() => navigate(`/progress/${p.id}`)}>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Age {p.age} · {p.skin_type}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <DoctorAssignment patient={p} />
                  <button
                    onClick={() => setAccountFormFor(accountFormFor === p.id ? null : p.id)}
                    className="inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Create Login
                  </button>
                  <button
                    onClick={() => navigate(`/progress/${p.id}`)}
                    className="inline-flex items-center gap-0.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-700 dark:hover:text-brand-400 font-medium ml-auto sm:ml-0"
                  >
                    Progress
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {accountFormFor === p.id && (
                <CreateAccountForm patient={p} onClose={() => setAccountFormFor(null)} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
