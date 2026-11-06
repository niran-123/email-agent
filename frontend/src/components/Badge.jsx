import { clsx } from '../utils/clsx.js';

const VARIANTS = {
  success: 'bg-green-50 text-green-700 border border-green-200',
  error:   'bg-red-50 text-red-700 border border-red-200',
  warning: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  info:    'bg-blue-50 text-blue-700 border border-blue-200',
  neutral: 'bg-gray-100 text-gray-600 border border-gray-200',
};

/**
 * Reusable Badge component.
 * @param {'success'|'error'|'warning'|'info'|'neutral'} [variant]
 */
export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

