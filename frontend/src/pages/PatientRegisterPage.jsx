import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Calendar } from 'lucide-react'
import { registerPatient, getMe } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import AuthLayout from '../components/ui/AuthLayout'

const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive']

export default function PatientRegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', age: '', skin_type: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await registerPatient({ ...form, age: Number(form.age) })
      localStorage.setItem('token', data.access_token)
      const me = await getMe()
      login(data.access_token, me.data)
      navigate('/home')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Sign up to start tracking your skin health">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label htmlFor="pr-name" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Full name</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="pr-name"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="pr-email" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="pr-email"
                type="email"
                autoCapitalize="none"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="pr-password" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="pr-password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pr-age" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Age</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="pr-age"
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="pr-skin-type" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Skin type</label>
              <select
                id="pr-skin-type"
                required
                value={form.skin_type}
                onChange={(e) => setForm({ ...form, skin_type: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
              >
                <option value="" disabled>Select</option>
                {SKIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Card>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        Already have an account? <Link to="/login" className="text-brand-700 dark:text-brand-400 font-medium">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
