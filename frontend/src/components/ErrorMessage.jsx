import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button.jsx';

/**
 * Inline error message with optional retry action.
 */
export default function ErrorMessage({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex gap-4">
      <div className="flex-shrink-0 text-red-500 mt-0.5">
        <AlertCircle size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">{title}</p>
        {message && <p className="text-sm text-red-600 mt-1">{message}</p>}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw size={14} />}
            className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
          >
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

