import {
  ScanFace, Users, ShieldCheck, TrendingUp, LayoutDashboard, CalendarClock, ClipboardList,
  MessageCircle, FileStack, Home, FileEdit,
} from 'lucide-react'

// `primary: true` items get their own bottom-nav tab on mobile; the rest are
// tucked into the bottom nav's "More" sheet. Sidebar (desktop) ignores the flag
// and always shows the full list, since it has room for it.
export function getNavLinks(user) {
  if (!user) return []

  if (user.role === 'patient') {
    const progressPath = `/progress/${user.patient_id}`
    return [
      { to: '/home', label: 'Home', icon: Home, primary: true },
      { to: '/', label: 'Analyze', icon: ScanFace, primary: true },
      { to: progressPath, label: 'Progress', icon: TrendingUp, primary: true },
      { to: `${progressPath}#messages`, label: 'Messages', icon: MessageCircle, primary: true },
      { to: `${progressPath}#treatment-plans`, label: 'Treatment', icon: ClipboardList },
      { to: '/appointments', label: 'Appointments', icon: CalendarClock },
    ]
  }

  return [
    ...(user.role === 'admin' ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true }] : []),
    ...(user.role === 'dermatologist' ? [{ to: '/worklist', label: 'Worklist', icon: LayoutDashboard, primary: true }] : []),
    { to: '/', label: 'Analyze', icon: ScanFace, primary: true },
    { to: '/patients', label: 'Patients', icon: Users, primary: true },
    { to: '/messages', label: 'Messages', icon: MessageCircle, primary: true },
    { to: '/appointments', label: 'Appointments', icon: CalendarClock },
    { to: '/reports', label: 'Reports', icon: FileStack },
    ...(user.role === 'admin'
      ? [
          { to: '/staff', label: 'Staff', icon: ShieldCheck },
          { to: '/content', label: 'Content', icon: FileEdit },
        ]
      : []),
  ]
}
