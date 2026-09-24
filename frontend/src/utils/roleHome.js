export function homePathFor(user) {
  if (!user) return '/login'
  if (user.role === 'patient') return '/home'
  if (user.role === 'dermatologist') return '/worklist'
  return '/'
}
