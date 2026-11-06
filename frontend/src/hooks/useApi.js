// frontend/src/hooks/useApi.js
// Generic hook for async API calls with loading/error state.

import { useState, useCallback } from 'react';

/**
 * @template T
 * @param {() => Promise<import('axios').AxiosResponse<T>>} apiFn
 * @returns {{ data: T|null, loading: boolean, error: string|null, execute: function, reset: function }}
 */
export function useApi(apiFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFn(...args);
        setData(res.data);
        return res.data;
      } catch (err) {
        const msg =
          err.response?.data?.error?.message ?? err.message ?? 'An unknown error occurred.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFn],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

