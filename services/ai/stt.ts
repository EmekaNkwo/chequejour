/**
 * On-device French speech-to-text with Whisper. The model loads on the first
 * transcription and is freed after a spell of idleness (see EngineSlot).
 */
import { initWhisper, type WhisperContext } from 'whisper.rn';
import { AiError } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { cleanTranscript, sttTimeoutMs } from '../../domain/ai/transcript';
import { modelFile } from '../../data/ai/modelStore';
import { EngineSlot } from './engine-slot';

/** Nudges the model towards French learner speech and proper punctuation. */
const PROMPT = 'Bonjour. Je parle français.';

let slot: EngineSlot<WhisperContext> | null = null;
let slotModelId: string | null = null;

function slotFor(model: ModelEntry): EngineSlot<WhisperContext> {
  if (slot && slotModelId === model.id) return slot;
  const previous = slot;
  slot = new EngineSlot<WhisperContext>({
    load: () => initWhisper({ filePath: modelFile(model).uri }),
    release: (context) => context.release(),
  });
  slotModelId = model.id;
  void previous?.unload();
  return slot;
}

export interface TranscribeRequest {
  model: ModelEntry;
  /** A 16 kHz mono WAV file. */
  uri: string;
  durationMs: number;
  signal?: AbortSignal;
}

/** What was said, tidied; '' when nothing was heard. */
export function transcribe({ model, uri, durationMs, signal }: TranscribeRequest): Promise<string> {
  if (!modelFile(model).exists) return Promise.reject(new AiError('unavailable', 'The speech model is not installed.'));
  return slotFor(model).run(
    async (context, stopSignal) => {
      const { stop, promise } = context.transcribe(uri, { language: 'fr', prompt: PROMPT, temperature: 0 });
      stopSignal.addEventListener('abort', () => void stop());
      const result = await promise;
      return cleanTranscript(result.result);
    },
    { timeoutMs: sttTimeoutMs(durationMs), signal },
  );
}

/** Frees the speech model now (the app went to the background, or the pack was removed). */
export async function unloadStt(): Promise<void> {
  await slot?.unload();
}
