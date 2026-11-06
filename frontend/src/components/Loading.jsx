import { clsx } from '../utils/clsx.js';

/**
 * Loading spinner / skeleton component.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {'spinner'|'dots'} [props.variant]
 */
export default function Loading({ label = 'Loading…', size = 'md', variant = 'spinner', className = '' }) {
  const spinnerSize = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];

  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 py-10', className)}>
      {variant === 'spinner' ? (
        <svg
          className={clsx('animate-spin text-brand-500', spinnerSize)}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}

