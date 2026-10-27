/**
 * The widget's pronunciation button. A tap reaches the widget's background task as a
 * click action carrying the word's clip key and text; the task plays it through the
 * app's audio controller and stays alive until the clip ends (or a time limit passes).
 */
import type { PlaybackRate } from '../../domain/playback';
import { logError } from '../app/log';

export const PLAY_WORD_ACTION = 'PLAY_WORD';
/** A word clip lasts a second or two; this only guards against a stuck player. */
const MAX_WAIT_MS = 15_000;

export interface WidgetPlayer {
  play: (key: string, text: string, options?: { rate?: PlaybackRate; onFinish?: (key: string) => void }) => Promise<void>;
  stop: () => Promise<void>;
}

export type WidgetPlayResult = 'played' | 'ignored' | 'timed-out' | 'failed';

export function playWordAction(word: { fr: string; audioKey: string }): { clickAction: string; clickActionData: { key: string; text: string } } {
  return { clickAction: PLAY_WORD_ACTION, clickActionData: { key: word.audioKey, text: word.fr } };
}

/** Click data comes from the launcher, so check it before use. */
function clipFrom(data: Record<string, unknown> | undefined): { key: string; text: string } | null {
  const key = data?.key;
  const text = data?.text;
  return typeof key === 'string' && key.length > 0 && typeof text === 'string' && text.length > 0 ? { key, text } : null;
}

export async function playFromWidget(
  clickAction: string | undefined,
  data: Record<string, unknown> | undefined,
  player: WidgetPlayer,
  rate: PlaybackRate,
): Promise<WidgetPlayResult> {
  const clip = clickAction === PLAY_WORD_ACTION ? clipFrom(data) : null;
  if (!clip) return 'ignored';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const finished = new Promise<WidgetPlayResult>((resolve) => {
      timer = setTimeout(() => resolve('timed-out'), MAX_WAIT_MS);
      player.play(clip.key, clip.text, { rate, onFinish: () => resolve('played') }).catch((e: unknown) => {
        logError('widget play', e);
        resolve('failed');
      });
    });
    const result = await finished;
    if (result === 'timed-out') await player.stop();
    return result;
  } finally {
    clearTimeout(timer);
  }
}
