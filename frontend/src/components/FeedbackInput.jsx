import { MAX_FEEDBACK_LENGTH, SAMPLE_FEEDBACK } from '../utils/constants';
import { Spinner } from './LoadingState';

export default function FeedbackInput({ value, onChange, onSubmit, loading }) {
  const length = value.length;
  const tooLong = length > MAX_FEEDBACK_LENGTH;
  const canSubmit = value.trim().length >= 5 && !tooLong && !loading;

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) onSubmit();
  };

  return (
    <div className="card p-5">
      <label htmlFor="feedback" className="text-sm font-semibold text-slate-900">
        Enter customer feedback
      </label>
      <p className="mt-0.5 text-xs text-slate-500">
        Paste a single customer comment, review or message.
      </p>
      <textarea
        id="feedback"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        disabled={loading}
        aria-describedby="feedback-count"
        className="mt-3 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:bg-slate-50"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span
            id="feedback-count"
            className={`text-xs tabular-nums ${tooLong ? 'font-medium text-rose-600' : 'text-slate-500'}`}
          >
            {length.toLocaleString()} / {MAX_FEEDBACK_LENGTH.toLocaleString()} characters
          </span>
      
        </div>
        <button type="button" onClick={onSubmit} disabled={!canSubmit} className="btn-primary">
          {loading && <Spinner />}
          {loading ? 'Analyzing…' : 'Analyze Feedback'}
        </button>
      </div>
    </div>
  );
}
