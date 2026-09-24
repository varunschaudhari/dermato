import { Link } from 'react-router-dom'
import { AlertTriangle, Info, CheckCircle2, Bell, XCircle } from 'lucide-react'
import Button from './Button'

// One banner component for every "here's something worth your attention" spot
// in the app (priority nudges on Home, the results triage banner, overdue/
// recheck warnings, ...) — replaces several near-identical hand-rolled Cards
// that had drifted into slightly different markup for the same visual idea.
const VARIANTS = {
  warning: {
    classes: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    defaultIcon: AlertTriangle,
  },
  info: {
    classes: 'bg-brand-50/60 dark:bg-brand-900/20 border-brand-100 dark:border-brand-800 text-brand-800 dark:text-brand-300',
    defaultIcon: Info,
  },
  success: {
    classes: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-800 dark:text-green-300',
    defaultIcon: CheckCircle2,
  },
  neutral: {
    classes: 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300',
    defaultIcon: Bell,
  },
  error: {
    classes: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-400',
    defaultIcon: XCircle,
  },
}

export default function Alert({ variant = 'info', icon, title, footnote, actions, className = '' }) {
  const config = VARIANTS[variant]
  const Icon = icon || config.defaultIcon

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 sm:p-5 ${config.classes} ${className}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {footnote && <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{footnote}</p>}
        </div>
        {actions && actions.length > 0 && (
          <div className="flex gap-2 shrink-0">
            {actions.map((action) => (
              <Button
                key={action.to || action.label}
                as={action.to ? Link : 'button'}
                to={action.to}
                onClick={action.onClick}
                size="sm"
                variant="outline"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
