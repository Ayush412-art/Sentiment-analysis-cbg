import { useState } from 'react';
import ConfidenceBar from './ConfidenceBar';
import { CheckIcon, CopyIcon } from './Icons';
import RiskBadge from './RiskBadge';
import SentimentBadge from './SentimentBadge';
import UrgencyBadge from './UrgencyBadge';

function Metric({ label, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="border-t border-slate-200 px-6 py-5">
      <h3 className="section-title">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-slate-800">{children}</div>
    </div>
  );
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

export default function AnalysisResult({ analysis, feedback, onReset }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyToClipboard(analysis.suggested_response)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article className="card overflow-hidden animate-fade-in" aria-label="AI analysis result">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="section-title">AI Analysis</h2>
        {onReset && (
          <button type="button" onClick={onReset} className="btn-secondary">
            New Analysis
          </button>
        )}
      </div>

      {feedback && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs font-medium text-slate-500">Customer feedback</div>
          <p className="mt-1 text-sm italic text-slate-700">“{feedback}”</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 px-6 py-5 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Sentiment">
          <SentimentBadge value={analysis.sentiment} size="lg" />
        </Metric>
        <Metric label="Confidence">
          <ConfidenceBar value={analysis.confidence} />
        </Metric>
        <Metric label="Emotion">
          <div className="text-sm font-medium text-slate-900">{analysis.emotion}</div>
        </Metric>
        <Metric label="Intent">
          <div className="text-sm font-medium text-slate-900">{analysis.intent}</div>
        </Metric>
        <Metric label="Topic">
          <div className="text-sm font-medium text-slate-900">{analysis.topic}</div>
        </Metric>
        <div className="col-span-2 grid grid-cols-2 gap-6 sm:col-span-3 lg:col-span-6 lg:grid-cols-6">
          <Metric label="Urgency">
            <UrgencyBadge value={analysis.urgency} size="lg" />
          </Metric>
          <Metric label="Customer Risk">
            <RiskBadge value={analysis.customer_risk} size="lg" />
          </Metric>
        </div>
      </div>

      <Block title="Key Issue">
        <span className="font-medium text-slate-900">{analysis.key_issue}</span>
      </Block>
      <Block title="Why This Matters">{analysis.reason}</Block>
      <Block title="Recommended Action">{analysis.recommended_action}</Block>

      <div className="border-t border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="section-title">Suggested Customer Response</h3>
          <button type="button" onClick={handleCopy} className="btn-secondary !px-3 !py-1.5">
            {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy Response'}</span>
          </button>
        </div>
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
          {analysis.suggested_response}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          AI-generated draft. Review before sending to the customer.
        </p>
      </div>
    </article>
  );
}
