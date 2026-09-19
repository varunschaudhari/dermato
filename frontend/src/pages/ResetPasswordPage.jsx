import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { resetPassword } from '../services/api'
import { useToast } from '../context/ToastContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import AuthLayout from '../components/ui/AuthLayout'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      toast.success('Password reset. Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password">

        <Card>
          {!token ? (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              This reset link is missing its token. Request a new one from the{' '}
              <Link to="/forgot-password" className="font-medium underline">forgot password</Link> page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label htmlFor="reset-password" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} fullWidth>
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
            </form>
          )}
        </Card>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        <Link to="/login" className="text-brand-700 dark:text-brand-400 font-medium">Back to sign in</Link>
      </p>
    </AuthLayout>
  )
}
