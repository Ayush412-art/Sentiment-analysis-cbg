import { useState } from 'react';
import BarListChart from '../components/BarListChart';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import FeedbackDetails from '../components/FeedbackDetails';
import Header from '../components/Header';
import { SparkIcon } from '../components/Icons';
import LoadingState, { Spinner } from '../components/LoadingState';
import RiskBadge from '../components/RiskBadge';
import SentimentChart from '../components/SentimentChart';
import UrgencyBadge from '../components/UrgencyBadge';
import { useAsync } from '../hooks/useAsync';
import { getAiInsight, getHistory, getSummary } from '../services/api';
import { truncate } from '../utils/format';

const MIN_RECORDS = 5; // matches MIN_RECORDS_FOR_INSIGHT on the backend

function Panel({ title, subtitle, children }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function IssueList({ items, onSelect, emptyText }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="-mx-2 divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="block w-full rounded px-2 py-2.5 text-left hover:bg-slate-50"
          >
            <div className="text-sm font-medium text-slate-900">{item.key_issue}</div>
            <div className="mt-0.5 text-xs text-slate-500">{truncate(item.feedback, 90)}</div>
            <div className="mt-1.5 flex gap-2">
              <UrgencyBadge value={item.urgency} />
              <RiskBadge value={item.customer_risk} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AiBusinessInsight({ totalRecords }) {
  const [state, setState] = useState({ loading: false, error: null, result: null });

  const generate = async () => {
    setState({ loading: true, error: null, result: null });
    try {
      const res = await getAiInsight();
      setState({ loading: false, error: null, result: res });
    } catch (err) {
      setState({ loading: false, error: err.message, result: null });
    }
  };

  const insight = state.result?.data;

  return (
    <section className="card p-5" aria-labelledby="ai-insight-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-insight-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <SparkIcon width={16} height={16} className="text-brand-700" />
            AI Business Insight
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            AI-generated interpretation of the {totalRecords} analyzed records shown on this page.
            The statistics above are calculated directly from stored data.
          </p>
        </div>
        <button type="button" onClick={generate} disabled={state.loading} className="btn-primary">
          {state.loading && <Spinner />}
          {insight ? 'Regenerate' : 'Generate Insight'}
        </button>
      </div>

      {state.error && (
        <div className="mt-4">
          <ErrorMessage message={state.error} />
        </div>
      )}

      {insight && (
        <div className="mt-5 grid gap-6 border-t border-slate-200 pt-5 lg:grid-cols-2 animate-fade-in">
          <div>
            <h3 className="section-title">Executive Insight</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">{insight.insight}</p>
          </div>
          <div>
            <h3 className="section-title">Recommended Business Actions</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
              {insight.recommended_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Insights({ onNavigate, onMenuClick }) {
  const [selected, setSelected] = useState(null);
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, highRisk, highUrgency] = await Promise.all([
      getSummary(),
      getHistory({ risk: 'High', limit: 6 }),
      getHistory({ urgency: 'High', limit: 6 }),
    ]);
    return { summary, highRisk, highUrgency };
  }, []);

  const summary = data?.summary;
  const enough = summary && summary.total >= MIN_RECORDS;

  return (
    <>
      <Header
        title="Insights"
        subtitle="Executive insights on customer sentiment, pain points and priorities"
        onMenuClick={onMenuClick}
      />

      {error && <ErrorMessage message={error} onRetry={reload} />}
      {loading && !data && <LoadingState rows={5} label="Loading insights" />}

      {summary && !enough && (
        <div className="card">
          <EmptyState
            title="No sufficient feedback data available yet"
            message={`Analyze more customer feedback to generate insights. At least ${MIN_RECORDS} analyzed records are needed (currently ${summary.total}).`}
            action={
              <button type="button" className="btn-primary" onClick={() => onNavigate('analyze')}>
                Analyze Feedback
              </button>
            }
          />
        </div>
      )}

      {enough && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Sentiment Distribution" subtitle="Share of feedback by customer sentiment">
              <SentimentChart positive={summary.positive} neutral={summary.neutral} negative={summary.negative} />
            </Panel>
            <Panel title="Top Topics" subtitle="Where customers are talking">
              <BarListChart data={summary.top_topics} label="Top feedback topics" />
            </Panel>
            <Panel title="Most Common Emotions">
              <BarListChart data={summary.top_emotions} color="#7c6fd6" label="Most common emotions" />
            </Panel>
            <Panel title="Most Common Intents">
              <BarListChart data={summary.top_intents} color="#0f8b8d" label="Most common customer intents" />
            </Panel>
            <Panel title="High-Risk Feedback" subtitle="Customers at risk of leaving">
              <IssueList items={data.highRisk} onSelect={setSelected} emptyText="No high-risk feedback." />
            </Panel>
            <Panel title="High-Urgency Feedback" subtitle="Issues needing a fast response">
              <IssueList items={data.highUrgency} onSelect={setSelected} emptyText="No high-urgency feedback." />
            </Panel>
          </div>

          <AiBusinessInsight totalRecords={summary.total} />
        </div>
      )}

      <FeedbackDetails item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
