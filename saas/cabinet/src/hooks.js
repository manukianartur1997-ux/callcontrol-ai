// Small shared hooks. One async-loader pattern for every screen keeps the
// loading / error / reload behavior identical everywhere.
import { useCallback, useEffect, useState } from "react";

// Runs `fn` on mount and whenever `deps` change; exposes { loading, data,
// error, reload }. Cancellation guard prevents state updates after unmount
// or after the deps changed mid-flight (e.g. the user switched orgs).
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
