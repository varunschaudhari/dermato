// Small icon buttons rather than underline tabs — active tab is a solid
// dark/light-inverted fill (same pattern as the primary button), so tab state
// reads as an on/off toggle rather than competing with the brand teal used
// for actual calls to action.
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl border transition whitespace-nowrap ${
              isActive
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={`font-mono text-[10px] rounded-full px-1.5 py-0.5 leading-none ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-gray-900/10 dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
