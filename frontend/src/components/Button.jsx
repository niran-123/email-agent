import { clsx } from '../utils/clsx.js';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400',
  outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50',
};

const SIZES = {
  xs: 'px-2.5 py-1 text-xs rounded',
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
};

/**
 * Reusable Button component.
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'outline'|'danger'|'ghost'} [props.variant]
 * @param {'xs'|'sm'|'md'|'lg'} [props.size]
 * @param {React.ReactNode} [props.icon] - Icon rendered before the label.
 * @param {React.ReactNode} [props.iconRight] - Icon rendered after the label.
 * @param {boolean} [props.loading] - Shows a spinner and disables the button.
 * @param {string} [props.as] - Custom element/component to render (e.g. Link).
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  className = '',
  as: Component = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <Component
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-150 cursor-pointer select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        VARIANTS[variant],
        SIZES[size],
        isDisabled && 'pointer-events-none',
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
      {!loading && iconRight}
    </Component>
  );
}

