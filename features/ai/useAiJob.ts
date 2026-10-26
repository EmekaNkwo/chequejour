/**
 * State for one AI request on a screen: working (with the reply so far), done, or
 * failed. A new request cancels the one before; leaving the screen cancels too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { aiFailureOf, type AiFailure } from '../../domain/ai/errors';
import { logError } from '../app/log';

export type AiJobState<T> = { status: 'idle' } | { status: 'working'; partial: string } | { status: 'done'; value: T } | { status: 'failed'; failure: AiFailure };

export type AiJobRunner<T> = (signal: AbortSignal, onText: (soFar: string) => void) => Promise<T>;

export interface AiJob<T> {
  state: AiJobState<T>;
  run: (job: AiJobRunner<T>) => void;
  cancel: () => void;
  reset: () => void;
}

export function useAiJob<T>(where: string): AiJob<T> {
  const [state, setState] = useState<AiJobState<T>>({ status: 'idle' });
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const cancel = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState((s) => (s.status === 'working' ? { status: 'idle' } : s));
  }, []);

  const run = useCallback(
    (job: AiJobRunner<T>) => {
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      setState({ status: 'working', partial: '' });
      job(controller.signal, (partial) => {
        if (!controller.signal.aborted) setState({ status: 'working', partial });
      })
        .then((value) => {
          if (!controller.signal.aborted) setState({ status: 'done', value });
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          logError(where, e);
          setState({ status: 'failed', failure: aiFailureOf(e) });
        });
    },
    [where],
  );

  const reset = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, run, cancel, reset };
}
