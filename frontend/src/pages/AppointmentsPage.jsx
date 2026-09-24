import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, CalendarX, CalendarCheck, Clock, CalendarClock } from 'lucide-react'
import {
  getAppointments,
  getAvailableDoctors,
  getDoctorBusyTimes,
  getAvailableSlots,
  createAppointment,
  updateAppointmentStatus,
  getPatients,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import FormField from '../components/ui/FormField'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import LastUpdated from '../components/ui/LastUpdated'
import QueryError from '../components/ui/QueryError'
import Alert from '../components/ui/Alert'

const STATUS_META = {
  scheduled: { color: 'brand', icon: CalendarClock },
  completed: { color: 'green', icon: CalendarCheck },
  cancelled: { color: 'gray', icon: CalendarX },
}

function BookingForm({ isPatient, patientId }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ patient_id: patientId || '', doctor_id: '', date: '', time: '', reason: '' })
  const [error, setError] = useState('')

  const { data: doctors = [] } = useQuery({
    queryKey: ['available-doctors'],
    queryFn: () => getAvailableDoctors().then((r) => r.data),
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients().then((r) => r.data),
    enabled: !isPatient,
  })

  const { data: busyTimes = [] } = useQuery({
    queryKey: ['doctor-busy-times', form.doctor_id, form.date],
    queryFn: () => getDoctorBusyTimes(form.doctor_id, form.date).then((r) => r.data),
    enabled: !!form.doctor_id && !!form.date,
  })

  const { data: slotsData } = useQuery({
    queryKey: ['available-slots', form.doctor_id, form.date],
    queryFn: () => getAvailableSlots(form.doctor_id, form.date).then((r) => r.data),
    enabled: !!form.doctor_id && !!form.date,
  })
  const slotsConfigured = slotsData?.configured
  const slots = slotsData?.slots || []

  const mutation = useMutation({
    mutationFn: (payload) => createAppointment(payload),
    onSuccess: () => {
      qc.invalidateQueries(['appointments'])
      toast.success('Appointment booked.')
      setForm({ patient_id: patientId || '', doctor_id: '', date: '', time: '', reason: '' })
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not book appointment'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.patient_id || !form.doctor_id || !form.date || !form.time) return
    mutation.mutate({
      patient_id: Number(form.patient_id),
      doctor_id: Number(form.doctor_id),
      scheduled_at: new Date(`${form.date}T${form.time}`).toISOString(),
      reason: form.reason || null,
    })
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <CalendarPlus className="w-5 h-5 text-brand-600" />
        Book an Appointment
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error" title={error} />}

        {!isPatient && (
          <FormField
            label="Patient"
            as="select"
            value={form.patient_id}
            onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
            required
          >
            <option value="">Select a patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </FormField>
        )}

        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Dermatologist</label>
          <div className="flex flex-wrap gap-2">
            {doctors.map((d) => {
              const active = String(form.doctor_id) === String(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setForm({ ...form, doctor_id: d.id, time: '' })}
                  className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition-colors ${
                    active
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400'
                  }`}
                >
                  {d.avatar_url ? (
                    <img src={d.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                        active ? 'bg-white/20 text-white' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      }`}
                    >
                      {(d.full_name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-left">
                    <span className="block leading-tight">{d.full_name}</span>
                    {d.specialization && (
                      <span className={`block text-[11px] leading-tight ${active ? 'text-white/80' : 'text-gray-400'}`}>
                        {d.specialization}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <FormField
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })}
          min={new Date().toISOString().split('T')[0]}
          required
        />

        {form.doctor_id && form.date && slotsConfigured && (
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Available times</label>
            {slots.length === 0 ? (
              <p className="text-xs text-gray-400">No open slots that day — try another date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((t) => {
                  const timeValue = new Date(t).toTimeString().slice(0, 5)
                  const active = form.time === timeValue
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, time: timeValue })}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        active
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400'
                      }`}
                    >
                      {new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {form.doctor_id && form.date && slotsData && !slotsConfigured && (
          <>
            <FormField
              label="Time"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              required
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
              This doctor hasn't set up available hours yet — pick any time.
            </p>
            {busyTimes.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2">
                Already booked that day:{' '}
                {busyTimes
                  .map((t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
                  .join(', ')}
              </p>
            )}
          </>
        )}

        {(!form.doctor_id || !form.date) && (
          <FormField label="Time" type="time" value={form.time} disabled />
        )}

        <FormField
          label="Reason (optional)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="e.g. Follow-up on acne treatment"
        />

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Booking...' : 'Book Appointment'}
        </Button>
      </form>
    </Card>
  )
}

export default function AppointmentsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const isPatient = user.role === 'patient'
  const isStaff = !isPatient

  const { data: appointments = [], isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => getAppointments().then((r) => r.data),
    refetchInterval: 30000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAppointmentStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries(['appointments'])
      toast.success('Appointment updated.')
    },
    onError: () => toast.error('Could not update appointment.'),
  })

  const sorted = [...appointments].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
  const upcoming = sorted.filter((a) => a.status === 'scheduled')
  const past = sorted.filter((a) => a.status !== 'scheduled')

  const renderAppointment = (appt) => {
    const meta = STATUS_META[appt.status] || STATUS_META.scheduled
    return (
      <div key={appt.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {isPatient ? `Dr. ${appt.doctor_name}` : appt.patient_name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            {new Date(appt.scheduled_at).toLocaleString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </p>
          {appt.reason && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{appt.reason}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge color={meta.color} icon={meta.icon}>{appt.status}</Badge>
          {appt.status === 'scheduled' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMutation.mutate({ id: appt.id, status: 'cancelled' })}
              >
                Cancel
              </Button>
              {isStaff && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => statusMutation.mutate({ id: appt.id, status: 'completed' })}
                >
                  Mark Completed
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Schedule and manage dermatology visits"
        action={<LastUpdated timestamp={dataUpdatedAt} />}
      />

      <BookingForm isPatient={isPatient} patientId={isPatient ? user.patient_id : null} />

      {isLoading ? (
        <>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </>
      ) : isError ? (
        <QueryError message="Couldn't load appointments." onRetry={refetch} />
      ) : (
        <>
          <Card>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Upcoming</h2>
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No upcoming appointments" />
            ) : (
              <div className="space-y-3">{upcoming.map(renderAppointment)}</div>
            )}
          </Card>

          {past.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Past</h2>
              <div className="space-y-3">{past.map(renderAppointment)}</div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
