const ACCENTS = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  neutral: 'text-slate-700',
  negative: 'text-rose-700',
  warning: 'text-amber-700',
};

const BARS = {
  default: 'bg-brand-600',
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-rose-500',
  warning: 'bg-amber-500',
};

export default function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className="card relative overflow-hidden p-4 animate-fade-in">
      <span className={`absolute inset-y-0 left-0 w-1 ${BARS[tone]}`} aria-hidden="true" />
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${ACCENTS[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
