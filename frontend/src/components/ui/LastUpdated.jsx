import { useEffect, useState } from 'react'

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
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
      Synced {label}
    </span>
  )
}
