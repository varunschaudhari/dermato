import { Stethoscope } from 'lucide-react'

/**
 * Shared shell for the auth screens (login, register, forgot/reset password):
 * soft brand backdrop, gradient logo mark, display-serif title.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center px-1">
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-brand-400/20 dark:bg-brand-500/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30 flex items-center justify-center mb-4">
            <Stethoscope className="w-7 h-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 text-center">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 text-center">{subtitle}</p>}
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300">Privacy</a>
          {' · '}
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 dark:hover:text-gray-300">Terms</a>
        </p>
      </div>
    </div>
  )
}
