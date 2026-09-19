import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { homePathFor } from '../../utils/roleHome'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />

  return children
}
