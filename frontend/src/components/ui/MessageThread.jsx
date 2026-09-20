import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send } from 'lucide-react'
import { getMessages, sendMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Card from './Card'
import Button from './Button'
import { SkeletonLine } from './Skeleton'
import QueryError from './QueryError'

export default function MessageThread({ patientId }) {
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [body, setBody] = useState('')

  const { data: messages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['messages', patientId],
    queryFn: () => getMessages(patientId).then((r) => r.data),
    refetchInterval: 30000,
  })

  const mutation = useMutation({
    mutationFn: (text) => sendMessage(patientId, text),
    onSuccess: () => {
      qc.invalidateQueries(['messages', patientId])
      setBody('')
    },
    onError: () => toast.error('Could not send message. Please try again.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!body.trim()) return
    mutation.mutate(body)
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-brand-600" />
        Messages
      </h2>

      <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-1">
        {isLoading ? (
          <div className="space-y-2 py-1">
            <SkeletonLine className="h-10 w-2/3" />
            <SkeletonLine className="h-10 w-1/2 ml-auto" />
            <SkeletonLine className="h-10 w-2/3" />
          </div>
        ) : isError ? (
          <QueryError message="Couldn't load messages." onRetry={refetch} />
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            No messages yet — start the conversation.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                  }`}
                >
                  {!mine && <p className="text-xs font-semibold mb-0.5 opacity-70">{m.sender_name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}>
                    {new Date(m.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:border-brand-500"
        />
        <Button type="submit" size="sm" icon={Send} disabled={mutation.isPending || !body.trim()}>
          Send
        </Button>
      </form>
    </Card>
  )
}
