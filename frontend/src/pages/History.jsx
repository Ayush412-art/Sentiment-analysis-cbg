
import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import FeedbackDetails from '../components/FeedbackDetails';
import Header from '../components/Header';
import LoadingState from '../components/LoadingState';
import RiskBadge from '../components/RiskBadge';
import SentimentBadge from '../components/SentimentBadge';
import UrgencyBadge from '../components/UrgencyBadge';
import { useAsync } from '../hooks/useAsync';
import { deleteFeedback, getHistory } from '../services/api';
import { formatDate, truncate } from '../utils/format';

const selectClass =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30';

export default function History({ onNavigate, onMenuClick }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [urgency, setUrgency] = useState('');
  const [risk, setRisk] = useState('');
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, loading, error, reload } = useAsync(
    () => getHistory({ search, sentiment, urgency, risk }),
    [search, sentiment, urgency, risk]
  );

  const filtersActive = Boolean(search || sentiment || urgency || risk);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSentiment('');
    setUrgency('');
    setRisk('');
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Delete this analysis? This cannot be undone.')) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteFeedback(item.id);
      setSelected(null);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const rows = data || [];

  return (
    <>
      <Header
        title="History"
        subtitle="All analyzed customer feedback"
        onMenuClick={onMenuClick}
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="history-search" className="sr-only">
              Search feedback
            </label>
            <input
              id="history-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search feedback, topic or issue…"
              className={`${selectClass} w-full placeholder:text-slate-400`}
            />
          </div>
          <select aria-label="Filter by sentiment" className={selectClass} value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
            <option value="">All sentiment</option>
            <option>Positive</option>
            <option>Neutral</option>
            <option>Negative</option>
          </select>
          <select aria-label="Filter by urgency" className={selectClass} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">All urgency</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <select aria-label="Filter by customer risk" className={selectClass} value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">All risk</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand-700 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <ErrorMessage message={actionError} />
        </div>
      )}
      {error && <ErrorMessage message={error} onRetry={reload} />}

      {!error && (
        <div className="card overflow-hidden">
          {loading && !data ? (
            <div className="p-5">
              <LoadingState rows={6} label="Loading history" />
            </div>
          ) : rows.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="No matching feedback"
                message="Try adjusting your search or filters."
                action={
                  <button type="button" className="btn-secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No feedback analyzed yet"
                message="Analyzed customer feedback will be stored here."
                action={
                  <button type="button" className="btn-primary" onClick={() => onNavigate('analyze')}>
                    Analyze Feedback
                  </button>
                }
              />
            )
          ) : (
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Feedback</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Sentiment</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Topic</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Urgency</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Risk</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-800">{truncate(row.feedback, 80)}</td>
                      <td className="px-4 py-3"><SentimentBadge value={row.sentiment} /></td>
                      <td className="px-4 py-3 text-slate-700">{row.topic}</td>
                      <td className="px-4 py-3"><UrgencyBadge value={row.urgency} /></td>
                      <td className="px-4 py-3"><RiskBadge value={row.customer_risk} /></td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">{truncate(row.recommended_action, 70)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(row);
                          }}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
              {rows.length} {rows.length === 1 ? 'record' : 'records'}
            </div>
          )}
        </div>
      )}

      <FeedbackDetails
        item={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </>
  );
}
