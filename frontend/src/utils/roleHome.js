export function homePathFor(user) {
  if (!user) return '/login'
  if (user.role === 'patient') return '/home'
  return '/'
}
