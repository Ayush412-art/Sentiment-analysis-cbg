import { AlertIcon } from './Icons';

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      role="alert"
    >
      <AlertIcon className="mt-0.5 shrink-0" width={18} height={18} />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium underline underline-offset-2 hover:text-rose-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}
