import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { login as loginApi, getMe } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { homePathFor } from '../utils/roleHome'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import AuthLayout from '../components/ui/AuthLayout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await loginApi(email, password)
      localStorage.setItem('token', data.access_token)
      const me = await getMe()
      login(data.access_token, me.data)
      navigate(homePathFor(me.data))
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Dermato account">

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label htmlFor="login-email" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-sm text-gray-600 dark:text-gray-400">Password</label>
                <Link to="/forgot-password" className="text-xs text-brand-700 dark:text-brand-400 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Card>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        New patient? <Link to="/patient-register" className="text-brand-700 dark:text-brand-400 font-medium">Create an account</Link>
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Dermatologist? <Link to="/register" className="text-brand-700 dark:text-brand-400 font-medium">Register here</Link>
      </p>
    </AuthLayout>
  )
}
