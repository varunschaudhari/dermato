import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-50 disabled:hover:bg-brand-600',
  outline:
    'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-400 text-gray-700 dark:text-gray-300 disabled:opacity-50',
  ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50',
  danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50',
}

const SIZES = {
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
}

const Button = forwardRef(function Button(
  { as: Component = 'button', variant = 'primary', size = 'md', icon: Icon, fullWidth, className = '', children, ...rest },
  ref
) {
  return (
    <Component
      ref={ref}
      className={`inline-flex items-center justify-center font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </Component>
  )
})

export default Button
