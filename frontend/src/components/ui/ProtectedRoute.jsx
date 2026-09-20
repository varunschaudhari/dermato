import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { homePathFor } from '../../utils/roleHome'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />

  return children
}
