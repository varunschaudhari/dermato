import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { giveConsent } from '../../services/api'
import Button from './Button'
import Card from './Card'

export default function ConsentGate() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  if (!user || user.role !== 'patient' || user.consent_given_at) return null

  const handleAccept = async () => {
    setLoading(true)
    try {
      const { data } = await giveConsent()
      updateUser(data)
    } catch {
      toast.error('Could not record consent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Before you begin</h2>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3 mb-5">
          <p>
            Dermato uses AI-assisted image analysis to estimate skin condition severity and suggest
            general remedies. <strong className="text-gray-800 dark:text-gray-200">This is not a medical diagnosis.</strong>{' '}
            Always consult a licensed dermatologist for medical advice, diagnosis, or treatment.
          </p>
          <p>
            Photos you upload are stored securely and shared only with your assigned dermatologist and
            clinic staff. You can request a full export or deletion of your data at any time from your
            profile.
          </p>
        </div>
        <Button onClick={handleAccept} disabled={loading} fullWidth>
          {loading ? 'Saving...' : 'I Understand and Agree'}
        </Button>
      </Card>
    </div>
  )
}
