import { truncate } from '../utils/format';
import EmptyState from './EmptyState';
import RiskBadge from './RiskBadge';
import UrgencyBadge from './UrgencyBadge';

export default function PriorityIssues({ items, onSelect }) {
  return (
    <section className="card" aria-labelledby="priority-title">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id="priority-title" className="text-sm font-semibold text-slate-900">
          Priority Issues
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">High urgency or high customer risk</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No priority issues" message="No high urgency or high risk feedback at the moment." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="block w-full px-5 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900">{item.key_issue}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{truncate(item.feedback, 100)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <UrgencyBadge value={item.urgency} />
                  <RiskBadge value={item.customer_risk} />
                  <span className="text-xs text-slate-500">{item.topic}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
