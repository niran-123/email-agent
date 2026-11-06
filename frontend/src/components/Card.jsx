import { clsx } from '../utils/clsx.js';

/**
 * Reusable Card container.
 */
export default function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        padding && 'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

