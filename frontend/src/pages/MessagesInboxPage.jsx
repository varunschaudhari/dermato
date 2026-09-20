import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Inbox } from 'lucide-react'
import { getMessagesInbox } from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Badge from '../components/ui/Badge'
import { SkeletonCard } from '../components/ui/Skeleton'
import QueryError from '../components/ui/QueryError'

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function MessagesInboxPage() {
  const navigate = useNavigate()

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: () => getMessagesInbox().then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Conversations across all your patients" />

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : isError ? (
        <QueryError message="Couldn't load your messages." onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="No patients yet" description="Messages with your patients will show up here." />
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card
              key={item.patient_id}
              className="p-4 cursor-pointer hover:shadow-md transition"
              onClick={() => navigate(`/progress/${item.patient_id}#messages`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/progress/${item.patient_id}#messages`)}
              aria-label={`Open conversation with ${item.patient_name}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.patient_name}</p>
                    {item.unread_count > 0 && <Badge color="brand">{item.unread_count} new</Badge>}
                  </div>
                  {item.last_message ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      <span className="font-medium">{item.last_sender_name}:</span> {item.last_message}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-0.5">No messages yet</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <MessageCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  {item.last_message_at && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(item.last_message_at)}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
