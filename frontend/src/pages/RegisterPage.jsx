import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock } from 'lucide-react'
import { register } from '../services/api'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import AuthLayout from '../components/ui/AuthLayout'

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create a dermatologist account">

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label htmlFor="register-name" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Full name</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-name"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="register-email" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="register-password" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Creating account...' : 'Register'}
            </Button>
          </form>
        </Card>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        Already have an account? <Link to="/login" className="text-brand-700 dark:text-brand-400 font-medium">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
