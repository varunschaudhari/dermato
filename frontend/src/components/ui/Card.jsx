export default function Card({ className = '', interactive = false, hero = false, children, ...rest }) {
  const surface = hero
    ? 'card-hero shadow-md'
    : 'bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800'
  return (
    <div
      className={`${surface} rounded-2xl p-5 sm:p-6 ${interactive ? 'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
