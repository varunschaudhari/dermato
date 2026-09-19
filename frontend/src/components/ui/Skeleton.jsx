export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`} />
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={i === 0 ? 'h-4 w-1/3' : i === lines - 1 ? 'h-4 w-1/2' : 'h-4 w-full'} />
      ))}
    </div>
  )
}
