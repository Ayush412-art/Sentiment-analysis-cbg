import { useEffect } from 'react';
import AnalysisResult from './AnalysisResult';
import { CloseIcon, TrashIcon } from './Icons';
import { formatDateTime } from '../utils/format';

/** Slide-over panel with the full analysis for a stored feedback record. */
export default function FeedbackDetails({ item, onClose, onDelete, deleting }) {
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Analysis details">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-slate-50 shadow-xl animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Analysis details</div>
            <div className="text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                disabled={deleting}
                className="btn-secondary !px-3 !py-1.5 text-rose-700 hover:!bg-rose-50"
              >
                <TrashIcon width={16} height={16} />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close details"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="p-6">
          <AnalysisResult analysis={item} feedback={item.feedback} />
        </div>
      </div>
    </div>
  );
}
