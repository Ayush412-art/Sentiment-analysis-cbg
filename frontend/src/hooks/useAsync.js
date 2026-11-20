import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader on mount (and whenever `deps` change) and tracks
 * loading / error / data. Stale responses from superseded calls are ignored.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const callId = useRef(0);

  const run = useCallback(() => {
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (id === callId.current) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (id === callId.current) {
          setState({ data: null, loading: false, error: err.message || 'Something went wrong.' });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      callId.current++;
    };
  }, [run]);

  return { ...state, reload: run };
}
