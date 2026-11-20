export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Inline card shown while the AI analyst works. Does not block the page. */
export function AnalysisLoading() {
  return (
    <div className="card p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-brand-700" />
        <div>
          <div className="text-sm font-medium text-slate-900">Analyzing customer feedback…</div>
          <div className="text-xs text-slate-500">
            Assessing sentiment, urgency and customer risk. This usually takes a few seconds.
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Generic block placeholder for page sections that are fetching data. */
export default function LoadingState({ rows = 3, label = 'Loading' }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  );
}
