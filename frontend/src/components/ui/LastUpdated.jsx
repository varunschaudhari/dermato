import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function LastUpdated({ timestamp, className = '' }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  if (!timestamp) {
    return null
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  const label = seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 ${className}`}>
      <RefreshCw className="w-3 h-3" />
      Updated {label}
    </span>
  )
}
