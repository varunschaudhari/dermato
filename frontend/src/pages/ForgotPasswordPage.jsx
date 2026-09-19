import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, CheckCircle2 } from 'lucide-react'
import { forgotPassword } from '../services/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import AuthLayout from '../components/ui/AuthLayout'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
    } finally {
      // Always show the same confirmation, whether or not the email exists —
      // the backend intentionally doesn't reveal that either.
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link">

        <Card>
          {sent ? (
            <div className="text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-brand-600 mx-auto mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                If <span className="font-medium">{email}</span> is registered, a reset link is on its way.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} fullWidth>
                {loading ? 'Sending...' : 'Send reset link'}
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
