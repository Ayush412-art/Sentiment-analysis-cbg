const TONES = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  negative: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  high: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  medium: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

const DOTS = {
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-rose-500',
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

export default function Badge({ tone = 'neutral', size = 'sm', children }) {
  const sizing = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${sizing} ${TONES[tone] || TONES.neutral}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone] || DOTS.neutral}`} aria-hidden="true" />
      {children}
    </span>
  );
}
