import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, Mail, Phone, User as UserIcon } from 'lucide-react'
import { updateMe, changePassword } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import FormField from '../components/ui/FormField'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()

  const [profileForm, setProfileForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', email: user.email })
  const [profileError, setProfileError] = useState('')

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })
  const [passwordError, setPasswordError] = useState('')

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

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    profileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    passwordMutation.mutate(passwordForm)
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
          {profileError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{profileError}</p>
          )}
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

      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{passwordError}</p>
          )}
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
