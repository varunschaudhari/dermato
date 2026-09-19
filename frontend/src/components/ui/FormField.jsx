import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// One input component for every labeled field in the app — replaces the
// "icon absolutely positioned inside a relative wrapper" markup that was
// duplicated across Login, Register, Profile, and Appointments. Also the one
// place a password field gets a show/hide toggle, so every password input
// gets it for free instead of needing it wired up per page.
export default function FormField({
  label,
  labelRight,
  icon: Icon,
  type = 'text',
  error,
  className = '',
  as = 'input',
  children,
  ...inputProps
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && showPassword ? 'text' : type

  const fieldClasses = `w-full border ${
    error ? 'border-red-400 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'
  } dark:bg-gray-800 dark:text-gray-100 rounded-xl ${Icon ? 'pl-9' : 'pl-3'} ${
    isPassword ? 'pr-9' : 'pr-3'
  } py-2.5 text-sm focus:border-brand-500`

  return (
    <div className={className}>
      {(label || labelRight) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <label htmlFor={inputProps.id} className="block text-sm text-gray-600 dark:text-gray-400">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}
      <div className="relative">
        {Icon && <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
        {as === 'select' ? (
          <select {...inputProps} className={fieldClasses}>
            {children}
          </select>
        ) : (
          <input type={resolvedType} {...inputProps} className={fieldClasses} />
        )}
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}
