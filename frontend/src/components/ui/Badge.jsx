import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react'

const COLORS = {
  brand: 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

// Severity is never conveyed by color alone — an icon carries the meaning too,
// so the badge still reads correctly for colorblind users or on a bad screen.
export const SEVERITY = {
  mild: { color: 'green', icon: CheckCircle2 },
  moderate: { color: 'amber', icon: AlertTriangle },
  severe: { color: 'red', icon: AlertOctagon },
}

export default function Badge({ color = 'gray', icon: Icon, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-wide px-2.5 py-1 rounded-full capitalize ${COLORS[color]} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  )
}
