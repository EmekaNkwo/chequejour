import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast';
import type { CheckOutcome } from '../../domain/answers';
import { answerToast } from '../../domain/toast';

export interface AnswerToast {
  /** Shows "Correct" / "Not quite" with the right answer and the explanation. */
  show: (outcome: CheckOutcome, explanation: string) => void;
  /** Clears this quiz's feedback, e.g. when moving to the next question. */
  clear: () => void;
}

/** Answer feedback as a toast that never outlives the question or screen it belongs to. */
export function useAnswerToast(): AnswerToast {
  const toast = useToast();
  const shown = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (shown.current !== null) toast.dismiss(shown.current);
    shown.current = null;
  }, [toast]);

  const show = useCallback(
    (outcome: CheckOutcome, explanation: string) => {
      shown.current = toast.show(answerToast(outcome, explanation));
    },
    [toast],
  );

  useEffect(() => clear, [clear]);
  return { show, clear };
}
