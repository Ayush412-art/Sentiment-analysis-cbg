import { formatDateTime, truncate } from '../utils/format';
import EmptyState from './EmptyState';
import SentimentBadge from './SentimentBadge';
import UrgencyBadge from './UrgencyBadge';

export default function RecentFeedback({ items, onSelect }) {
  return (
    <section className="card" aria-labelledby="recent-title">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id="recent-title" className="text-sm font-semibold text-slate-900">
          Recent Customer Feedback
        </h2>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No feedback analyzed yet"
          message="Analyzed customer feedback will appear here."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="block w-full px-5 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <p className="text-sm text-slate-800">{truncate(item.feedback, 110)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SentimentBadge value={item.sentiment} />
                  <UrgencyBadge value={item.urgency} />
                  <span className="text-xs text-slate-500">{item.topic}</span>
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(item.created_at)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
