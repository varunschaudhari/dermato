import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react'
import { subscribeToast } from '../lib/toastBus'

const ToastContext = createContext(null)

const ICONS = { success: CheckCircle2, error: AlertOctagon, info: Info }
const STYLES = {
  success: 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-100',
  error: 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-gray-800 dark:text-gray-100',
  info: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100',
}
const ICON_COLOR = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-brand-600 dark:text-brand-400',
}

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(({ type = 'info', message, duration = 4500 }) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, type, message }])
    const timer = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, timer)
  }, [dismiss])

  useEffect(() => subscribeToast(push), [push])

  const value = {
    success: (message) => push({ type: 'success', message }),
    error: (message) => push({ type: 'error', message }),
    info: (message) => push({ type: 'info', message }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[100] left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] sm:top-4 sm:left-auto sm:right-4 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm px-0"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-2.5 rounded-xl border shadow-lg px-4 py-3 text-sm animate-toast-in ${STYLES[t.type]}`}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${ICON_COLOR[t.type]}`} />
              <p className="flex-1 min-w-0">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
