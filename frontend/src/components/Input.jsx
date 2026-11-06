import { forwardRef } from 'react';
import { clsx } from '../utils/clsx.js';

/**
 * Reusable Input component.
 */
const Input = forwardRef(function Input(
  { label, error, hint, icon, className = '', containerClassName = '', ...props },
  ref,
) {
  return (
    <div className={clsx('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-lg border bg-white text-sm text-gray-900 placeholder-gray-400',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500',
            icon ? 'pl-10 pr-3 py-2' : 'px-3 py-2',
            error
              ? 'border-red-400 focus-visible:ring-red-400'
              : 'border-gray-300',
            props.disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed',
            className,
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

export default Input;

