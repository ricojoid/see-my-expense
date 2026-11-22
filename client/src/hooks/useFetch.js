import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `fetcher` whenever `deps` change. Keeps the previous data while
 * refetching (no flash of empty content) and ignores out-of-order responses.
 */
export function useFetch(fetcher, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const callId = useRef(0);

  const run = useCallback(() => {
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: true }));
    fetcher()
      .then((data) => id === callId.current && setState({ data, error: null, loading: false }))
      .catch((error) => id === callId.current && setState((s) => ({ ...s, error, loading: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { ...state, reload: run };
}
