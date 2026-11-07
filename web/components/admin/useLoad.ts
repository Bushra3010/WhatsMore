'use client';
// Loads a section's data when it opens or `key` changes, and again on reload() (Refresh button,
// after a change). Responses for an older key or an older reload are dropped.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLoad<T>(fetcher: () => Promise<T>, key = '') {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(fetcher);
  useEffect(() => { latest.current = fetcher; });
  useEffect(() => {
    let live = true;
    latest.current().then(
      (value) => { if (live) setState({ key, value }); },
      () => { /* rpc() already showed the error as a toast */ },
    );
    return () => { live = false; };
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  /** data: the latest result (may belong to a previous key); fresh: it matches the current key. */
  return { data: state?.value ?? null, fresh: !!state && state.key === key, reload };
}
