/**
 * Ways an on-device AI job can end without a result. Screens turn each into a calm toast
 * and fall back to the non-AI behaviour; none of them is shown as a crash.
 */
export type AiFailure = 'unavailable' | 'load-failed' | 'timeout' | 'cancelled' | 'failed' | 'rejected';

export class AiError extends Error {
  constructor(
    readonly failure: AiFailure,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export function aiFailureOf(error: unknown): AiFailure {
  return error instanceof AiError ? error.failure : 'failed';
}

/** Short, learner-facing text for a failure (the toast message). */
export function aiFailureMessage(failure: AiFailure): string {
  switch (failure) {
    case 'unavailable':
      return 'The AI pack is not installed or this feature is turned off.';
    case 'load-failed':
      return 'The AI model could not start, probably for lack of memory. Close other apps and try again.';
    case 'timeout':
      return 'The AI took too long, so it was stopped.';
    case 'cancelled':
      return 'Stopped.';
    case 'rejected':
      return 'The AI answer did not pass the app’s checks, so it is not shown.';
    case 'failed':
      return 'The AI could not answer this time.';
  }
}
