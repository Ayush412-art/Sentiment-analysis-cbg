import { useState } from 'react';
import ErrorMessage from '../components/ErrorMessage';
import FeedbackDetails from '../components/FeedbackDetails';
import Header from '../components/Header';
import LoadingState from '../components/LoadingState';
import PriorityIssues from '../components/PriorityIssues';
import RecentFeedback from '../components/RecentFeedback';
import SentimentChart from '../components/SentimentChart';
import StatCard from '../components/StatCard';
import { useAsync } from '../hooks/useAsync';
import { getHistory, getSummary } from '../services/api';

export default function Dashboard({ onNavigate, onMenuClick }) {
  const [selected, setSelected] = useState(null);
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, recent] = await Promise.all([getSummary(), getHistory({ limit: 6 })]);
    return { summary, recent };
  }, []);

  const summary = data?.summary;

  return (
    <>
      <Header
        title="Customer sentiment analysis (made in TCS)"
        subtitle="AI-powered insights from customer feedback"
        onMenuClick={onMenuClick}
        actions={
          <button type="button" className="btn-primary" onClick={() => onNavigate('analyze')}>
            Analyze Feedback
          </button>
        }
      />

      {error && <ErrorMessage message={error} onRetry={reload} />}

      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <LoadingState rows={4} label="Loading dashboard" />
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total Feedback" value={summary.total} />
            <StatCard label="Positive" value={summary.positive} tone="positive" hint={`${summary.positive_pct}% of total`} />
            <StatCard label="Neutral" value={summary.neutral} tone="neutral" hint={`${summary.neutral_pct}% of total`} />
            <StatCard label="Negative" value={summary.negative} tone="negative" hint={`${summary.negative_pct}% of total`} />
            <StatCard label="High Urgency" value={summary.high_urgency} tone="warning" />
            <StatCard label="High Risk" value={summary.high_risk} tone="negative" />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="card p-5 lg:col-span-2" aria-labelledby="sent-title">
              <h2 id="sent-title" className="mb-4 text-sm font-semibold text-slate-900">
                Customer Sentiment
              </h2>
              <SentimentChart
                positive={summary.positive}
                neutral={summary.neutral}
                negative={summary.negative}
              />
            </section>
            <div className="lg:col-span-3">
              <PriorityIssues items={summary.priority_issues || []} onSelect={setSelected} />
            </div>
          </div>

          <RecentFeedback items={data.recent} onSelect={setSelected} />
        </div>
      )}

      <FeedbackDetails item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
