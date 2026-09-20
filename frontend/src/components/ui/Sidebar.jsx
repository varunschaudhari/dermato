import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Stethoscope, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getNavLinks } from '../../config/nav'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'

export default function Sidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const links = getNavLinks(user)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-screen sticky top-0 flex-col print:hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Stethoscope className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Dermato</span>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              pathname === to
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <Link
          to="/profile"
          className={`block px-3 py-2 rounded-xl transition ${
            pathname === '/profile'
              ? 'bg-brand-50 dark:bg-brand-900/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.full_name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user.role}</p>
        </Link>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-brand-700 dark:hover:text-brand-400 w-full transition"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
