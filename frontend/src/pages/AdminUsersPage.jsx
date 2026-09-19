import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, UserX, ShieldCheck } from 'lucide-react'
import { createUser, deactivateUser, listUsers } from '../services/api'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'dermatologist' })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (_, variables) => {
      qc.invalidateQueries(['users'])
      toast.success(`${variables.full_name} added as ${variables.role}.`)
      setShowForm(false)
      setForm({ full_name: '', email: '', password: '', role: 'dermatologist' })
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Could not create user'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      qc.invalidateQueries(['users'])
      toast.success('Account deactivated.')
    },
    onError: () => toast.error('Could not deactivate this account.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        action={
          <Button onClick={() => setShowForm(!showForm)} icon={UserPlus} size="sm">
            New Staff Account
          </Button>
        }
      />

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Full name</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:border-brand-500"
              >
                <option value="dermatologist">Dermatologist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit">Create Account</Button>
          </form>
        </Card>
      )}

      {users.length === 0 && !showForm ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="No staff accounts yet" description="Create the first dermatologist or admin account." />
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {u.full_name} <span className="text-xs text-gray-400 dark:text-gray-500">({u.email})</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color="brand">{u.role}</Badge>
                  {!u.is_active && <Badge color="red">deactivated</Badge>}
                </div>
              </div>
              {u.is_active && (
                <Button
                  onClick={() => deactivateMutation.mutate(u.id)}
                  variant="danger"
                  size="sm"
                  icon={UserX}
                  className="self-start sm:self-auto"
                >
                  Deactivate
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
