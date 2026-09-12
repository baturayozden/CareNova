import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { useDemoHidden } from '../../lib/adminDemoVisibility';

export interface PlatformQuery<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * GET for the admin screens. Refetches when the shell's "show demo data" switch
 * flips — and drops the old rows while it does, so demo rows are never on
 * screen after their marks were cleared (lib/adminDemoVisibility.ts).
 * Demo marking itself happens in the Axios interceptor, not here.
 */
export function usePlatformQuery<T>(url: string | null): PlatformQuery<T> {
  const [hideDemo] = useDemoHidden();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: url !== null });

  useEffect(() => {
    if (url === null) return undefined;
    let cancelled = false;
    setState({ loading: true });
    api.get<T>(url)
      .then(res => { if (!cancelled) setState({ data: res.data, loading: false }); })
      .catch(error => { if (!cancelled) setState({ error, loading: false }); });
    return () => { cancelled = true; };
  }, [url, hideDemo, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
