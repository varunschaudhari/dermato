import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getNavLinks } from '../../config/nav'

export default function BottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [showMore, setShowMore] = useState(false)

  if (!user) return null

  const links = getNavLinks(user)
  const primaryLinks = links.filter((l) => l.primary)
  const overflowLinks = links.filter((l) => !l.primary)
  const overflowActive = overflowLinks.some((l) => l.to === pathname)
  const columnCount = primaryLinks.length + (overflowLinks.length > 0 ? 1 : 0)

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 pb-safe z-40 print:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {primaryLinks.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-0.5 text-xs font-medium transition ${
                  active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                <span className="text-center leading-tight break-words">{label}</span>
              </Link>
            )
          })}
          {overflowLinks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              aria-label="More"
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-0.5 text-xs font-medium transition ${
                overflowActive ? 'text-brand-700 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <MoreHorizontal className="w-5 h-5 shrink-0" strokeWidth={overflowActive ? 2.4 : 2} />
              <span className="text-center leading-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {showMore && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowMore(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">More</p>
            <div className="space-y-1">
              {overflowLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                    pathname === to
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
