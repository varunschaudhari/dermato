import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api'
import { timeAgo } from '../utils/timeAgo'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'full'],
    queryFn: () => getNotifications(200).then((r) => r.data),
  })

  const readMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleClick = (n) => {
    if (!n.is_read) readMutation.mutate(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Full history of updates about your patients"
        action={
          unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={CheckCheck}
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              Mark all read
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : isError ? (
        <QueryError message="Couldn't load notifications." onRetry={refetch} />
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState icon={Bell} title="No notifications yet" description="You're all caught up." />
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex items-start justify-between gap-3 ${n.link ? 'cursor-pointer hover:shadow-md transition' : ''}`}
              onClick={() => handleClick(n)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(n)}
              aria-label={`View notification: ${n.message}`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1.5" />}
                <p className={`text-sm ${n.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                  {n.message}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{timeAgo(n.created_at)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
