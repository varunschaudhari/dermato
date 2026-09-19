import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Stethoscope, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'

export default function TopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const initial = user.full_name?.charAt(0).toUpperCase() || '?'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 pt-safe print:hidden">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Dermato</span>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label={`Account menu for ${user.full_name}`}
              aria-expanded={open}
              className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-semibold text-sm flex items-center justify-center"
            >
              {initial}
            </button>
            {open && (
              <>
                <button
                  aria-label="Close menu"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-2 z-40">
                  <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.full_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 w-full"
                  >
                    <UserCircle className="w-4 h-4" />
                    Profile
                  </Link>
                  <ThemeToggle className="!py-1.5 !text-sm rounded-lg" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
