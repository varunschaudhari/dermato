import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { getNotifications, markNotificationRead } from '../../services/api'

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications().then((r) => r.data),
    refetchInterval: 60000,
  })

  const readMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleClick = (n) => {
    if (!n.is_read) readMutation.mutate(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
      </button>
      {open && (
        <>
          <button
            aria-label="Close notifications"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-2 z-40 max-h-96 overflow-y-auto">
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex flex-col items-start gap-0.5 px-3 py-2 text-left text-sm w-full hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    n.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                    {n.message}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                </button>
              ))
            )}
            <button
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
              className="w-full text-center text-xs font-medium text-brand-600 dark:text-brand-400 border-t border-gray-100 dark:border-gray-800 mt-1 pt-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  )
}
