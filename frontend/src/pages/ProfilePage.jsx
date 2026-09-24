import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Mail, Phone, User as UserIcon } from 'lucide-react'
import { updateMe, changePassword, uploadAvatar, updateWorkingHours } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import FormField from '../components/ui/FormField'
import Alert from '../components/ui/Alert'

const WORKING_DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const isDoctor = user.role === 'dermatologist'

  const [profileForm, setProfileForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', email: user.email })
  const [profileError, setProfileError] = useState('')

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })
  const [passwordError, setPasswordError] = useState('')

  const [doctorForm, setDoctorForm] = useState({
    specialization: user.specialization || '',
    credentials: user.credentials || '',
    bio: user.bio || '',
  })
  const [doctorError, setDoctorError] = useState('')

  const [hoursForm, setHoursForm] = useState(() => {
    const initial = {}
    WORKING_DAYS.forEach(({ key }) => {
      initial[key] = user.working_hours?.[key] || null
    })
    return initial
  })
  const [hoursError, setHoursError] = useState('')

  const profileMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (res) => {
      updateUser(res.data)
      setProfileError('')
      toast.success('Profile updated.')
    },
    onError: (err) => setProfileError(err.response?.data?.detail || 'Could not update profile'),
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordForm({ current_password: '', new_password: '' })
      setPasswordError('')
      toast.success('Password updated.')
    },
    onError: (err) => setPasswordError(err.response?.data?.detail || 'Could not update password'),
  })

  const doctorMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (res) => {
      updateUser(res.data)
      setDoctorError('')
      toast.success('Doctor profile updated.')
    },
    onError: (err) => setDoctorError(err.response?.data?.detail || 'Could not update doctor profile'),
  })

  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (res) => {
      updateUser(res.data)
      toast.success('Photo updated.')
    },
    onError: () => toast.error('Could not upload photo.'),
  })

  const hoursMutation = useMutation({
    mutationFn: updateWorkingHours,
    onSuccess: (res) => {
      updateUser(res.data)
      setHoursError('')
      toast.success('Working hours updated.')
    },
    onError: (err) => setHoursError(err.response?.data?.detail || 'Could not update working hours'),
  })

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    profileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    passwordMutation.mutate(passwordForm)
  }

  const handleDoctorSubmit = (e) => {
    e.preventDefault()
    doctorMutation.mutate(doctorForm)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) avatarMutation.mutate(file)
  }

  const toggleWorkingDay = (key) => {
    setHoursForm((prev) => ({ ...prev, [key]: prev[key] ? null : { start: '09:00', end: '17:00' } }))
  }

  const setWorkingDayTime = (key, field, value) => {
    setHoursForm((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const handleHoursSubmit = (e) => {
    e.preventDefault()
    const working_hours = {}
    Object.entries(hoursForm).forEach(([key, window]) => {
      if (window) working_hours[key] = window
    })
    hoursMutation.mutate(working_hours)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader title="My Profile" subtitle="Manage your account details and password" />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Account details</h2>
          <Badge color="brand">{user.role}</Badge>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileError && <Alert variant="error" title={profileError} />}
          <FormField
            label="Full name"
            icon={UserIcon}
            required
            value={profileForm.full_name}
            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
          />
          <FormField
            label="Mobile number"
            icon={Phone}
            type="tel"
            required
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
          />
          <FormField
            label="Email"
            icon={Mail}
            type="email"
            required
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
          />
          <Button type="submit" disabled={profileMutation.isPending} size="sm">
            {profileMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Card>

      {isDoctor && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Doctor profile</h2>
          <div className="flex items-center gap-4 mb-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <UserIcon className="w-7 h-7" />
              </div>
            )}
            <label className="text-sm cursor-pointer text-brand-600 dark:text-brand-400 font-medium hover:underline">
              {avatarMutation.isPending ? 'Uploading...' : 'Change photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={avatarMutation.isPending}
              />
            </label>
          </div>
          <form onSubmit={handleDoctorSubmit} className="space-y-4">
            {doctorError && <Alert variant="error" title={doctorError} />}
            <FormField
              label="Specialization"
              value={doctorForm.specialization}
              onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
              placeholder="e.g. Cosmetic Dermatology"
            />
            <FormField
              label="Credentials"
              value={doctorForm.credentials}
              onChange={(e) => setDoctorForm({ ...doctorForm, credentials: e.target.value })}
              placeholder="e.g. MBBS, MD Dermatology"
            />
            <FormField
              label="Bio"
              as="textarea"
              rows={4}
              value={doctorForm.bio}
              onChange={(e) => setDoctorForm({ ...doctorForm, bio: e.target.value })}
              placeholder="A short introduction patients will see when choosing a doctor."
            />
            <Button type="submit" disabled={doctorMutation.isPending} size="sm">
              {doctorMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Card>
      )}

      {isDoctor && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Working hours</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Patients only see bookable slots inside these hours.
          </p>
          <form onSubmit={handleHoursSubmit} className="space-y-3">
            {hoursError && <Alert variant="error" title={hoursError} />}
            {WORKING_DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-28 shrink-0 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={!!hoursForm[key]}
                    onChange={() => toggleWorkingDay(key)}
                    className="rounded border-gray-300 dark:border-gray-700"
                  />
                  {label}
                </label>
                {hoursForm[key] ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hoursForm[key].start}
                      onChange={(e) => setWorkingDayTime(key, 'start', e.target.value)}
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                      type="time"
                      value={hoursForm[key].end}
                      onChange={(e) => setWorkingDayTime(key, 'end', e.target.value)}
                      className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Unavailable</span>
                )}
              </div>
            ))}
            <Button type="submit" disabled={hoursMutation.isPending} size="sm" className="mt-2">
              {hoursMutation.isPending ? 'Saving...' : 'Save working hours'}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && <Alert variant="error" title={passwordError} />}
          <FormField
            label="Current password"
            icon={KeyRound}
            type="password"
            required
            value={passwordForm.current_password}
            onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
          />
          <FormField
            label="New password"
            icon={KeyRound}
            type="password"
            required
            minLength={8}
            value={passwordForm.new_password}
            onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
          />
          <Button type="submit" disabled={passwordMutation.isPending} size="sm">
            {passwordMutation.isPending ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
