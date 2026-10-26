/**
 * "Add the widget" from inside the app. The launcher's pin request only says whether it
 * was accepted, not whether a prompt appeared: MIUI accepts it and then drops it while
 * the app's "Home screen shortcuts" permission is off (the default). So the app watches
 * for the prompt: if it never leaves the app and no widget appears, it says what to do.
 */
export type PinOutcome = 'unsupported' | 'added' | 'no-prompt' | 'dismissed';

export interface PinDeps {
  /** Asks the launcher to pin the widget; false when it can't. */
  request: () => Promise<boolean>;
  /** How many of the app's widgets are on the home screen. */
  count: () => Promise<number>;
  /** 'returned' once a launcher prompt was shown and the learner came back from it. */
  waitForPrompt: () => Promise<'stayed' | 'returned'>;
}

async function safeCount(count: PinDeps['count']): Promise<number> {
  try {
    return await count();
  } catch {
    return 0;
  }
}

export async function addWidgetOutcome({ request, count, waitForPrompt }: PinDeps): Promise<PinOutcome> {
  const before = await safeCount(count);
  if (!(await request())) return 'unsupported';
  const prompt = await waitForPrompt();
  if ((await safeCount(count)) > before) return 'added';
  return prompt === 'stayed' ? 'no-prompt' : 'dismissed';
}

export function isXiaomi(constants: { Manufacturer?: string; Brand?: string } | undefined): boolean {
  const names = [constants?.Manufacturer, constants?.Brand].map((n) => (n ?? '').toLowerCase());
  return names.some((n) => n === 'xiaomi' || n === 'redmi' || n === 'poco');
}
