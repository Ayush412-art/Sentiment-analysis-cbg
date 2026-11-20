import { useState } from 'react';
import AnalysisResult from '../components/AnalysisResult';
import ErrorMessage from '../components/ErrorMessage';
import FeedbackInput from '../components/FeedbackInput';
import Header from '../components/Header';
import { AnalysisLoading } from '../components/LoadingState';
import { analyzeFeedback } from '../services/api';

export default function AnalyzeFeedback({ onMenuClick }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { analysis, feedback }

  const handleSubmit = async () => {
    const feedback = text.trim();
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeFeedback(feedback);
      setResult({ analysis, feedback });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setText('');
    setError(null);
  };

  return (
    <>
      <Header
        title="Analyze Feedback"
        subtitle="Turn a single customer comment into structured customer experience insight"
        onMenuClick={onMenuClick}
      />

      <div className="space-y-6">
        {!result && (
          <FeedbackInput value={text} onChange={setText} onSubmit={handleSubmit} loading={loading} />
        )}

        {error && <ErrorMessage message={error} />}
        {loading && <AnalysisLoading />}
        {result && (
          <AnalysisResult
            analysis={result.analysis}
            feedback={result.feedback}
            onReset={handleReset}
          />
        )}
      </div>
    </>
  );
}
