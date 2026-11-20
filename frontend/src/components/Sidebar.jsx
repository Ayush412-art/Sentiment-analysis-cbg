import { AnalyzeIcon, CloseIcon, DashboardIcon, HistoryIcon, InsightsIcon, SparkIcon } from './Icons';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'analyze', label: 'Analyze Feedback', icon: AnalyzeIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'insights', label: 'Insights', icon: InsightsIcon },
];

export default function Sidebar({ current, onNavigate, open, onClose }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
              <AnalyzeIcon width={18} height={18} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              sentiment analysis project
            </span>
          </div>
          <button
            type="button"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = current === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={active ? 'text-brand-700' : 'text-slate-400'} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5">
            
            <div className="leading-tight">
             
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
