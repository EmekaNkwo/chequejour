/**
 * What a toast says and how long it stays. Rendering lives in components/ui/Toast.
 */
import type { CheckOutcome } from './answers';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
}

export interface ToastOptions {
  tone: ToastTone;
  title: string;
  message?: string;
  /** French text shown prominently, e.g. the right answer. */
  detail?: string;
  /** A toast with actions stays until one is chosen. */
  actions?: readonly ToastAction[];
  /** Milliseconds on screen; null keeps it until dismissed. */
  duration?: number | null;
}

const BASE_DURATION: Record<ToastTone, number> = { success: 2500, info: 3500, warning: 4500, error: 5000 };
const MS_PER_WORD = 250;
const MAX_DURATION = 10000;

export function toastDuration(options: ToastOptions): number | null {
  if (options.duration !== undefined) return options.duration;
  if (options.actions && options.actions.length > 0) return null;
  const words = `${options.message ?? ''} ${options.detail ?? ''}`.split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_DURATION, Math.max(BASE_DURATION[options.tone], words * MS_PER_WORD));
}

const CORRECT_DURATION = 3000;

/** Feedback after an answer. Wrong and almost-right answers get reading time; quizzes also clear them on Continue. */
export function answerToast(outcome: CheckOutcome, explanation: string): ToastOptions {
  if (outcome.result === 'correct') {
    return { tone: 'success', title: 'Correct', message: explanation, detail: undefined, duration: CORRECT_DURATION };
  }
  const message = outcome.note ? `${outcome.note}\n${explanation}` : explanation;
  return {
    tone: outcome.result === 'almost' ? 'warning' : 'error',
    title: outcome.result === 'almost' ? 'Almost' : 'Not quite',
    message,
    detail: outcome.expected || undefined,
  };
}
