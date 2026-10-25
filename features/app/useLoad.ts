import { useCallback, useRef, useState, type DependencyList } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApp } from './AppContext';
import { logError } from './log';

export interface LoadState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs an async loader when the screen gains focus and whenever progress or `deps` change,
 * so screens always show fresh data after a session or a settings change.
 */
export function useLoad<T>(label: string, loader: () => Promise<T>, deps: DependencyList): LoadState<T> {
  const { dataVersion } = useApp();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const runId = useRef(0);

  const run = useCallback(() => {
    const id = (runId.current += 1);
    setState((s) => ({ ...s, loading: true }));
    loaderRef
      .current()
      .then((data) => {
        if (id === runId.current) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        logError(label, error);
        if (id === runId.current) setState((s) => ({ ...s, error: 'Something went wrong loading this screen.', loading: false }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, dataVersion, ...deps]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  return { ...state, reload: run };
}
