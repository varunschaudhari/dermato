import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, Calendar } from 'lucide-react'
import { registerPatient, getMe } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import FormField from '../components/ui/FormField'
import AuthLayout from '../components/ui/AuthLayout'

const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive']

export default function PatientRegisterPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', age: '', skin_type: '' })
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
          <FormField
            id="pr-name"
            label="Full name"
            icon={User}
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <FormField
            id="pr-phone"
            label="Mobile number"
            icon={Phone}
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <FormField
            id="pr-email"
            label="Email"
            icon={Mail}
            type="email"
            autoCapitalize="none"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <FormField
            id="pr-password"
            label="Password"
            icon={Lock}
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="pr-age"
              label="Age"
              icon={Calendar}
              type="number"
              min={1}
              max={120}
              required
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
            <FormField
              id="pr-skin-type"
              label="Skin type"
              as="select"
              required
              value={form.skin_type}
              onChange={(e) => setForm({ ...form, skin_type: e.target.value })}
            >
              <option value="" disabled>Select</option>
              {SKIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </FormField>
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
