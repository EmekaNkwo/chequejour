/**
 * The on-device language model (llama.rn). Like the speech model it loads on first use,
 * answers one request at a time within a time limit, and is freed when idle. Callers
 * get raw text; every feature runs it through domain/ai/guards before showing it.
 */
import { initLlama, type LlamaContext } from 'llama.rn';
import { AiError } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { modelFile } from '../../data/ai/modelStore';
import { EngineSlot } from './engine-slot';

/** Prompts and replies here are short; this leaves room for a conversation's history. */
const CONTEXT_TOKENS = 4096;
const THREADS = 4;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  model: ModelEntry;
  messages: readonly ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** JSON schema the reply must follow; the runtime turns it into a grammar so the model can't stray. */
  jsonSchema?: object;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Called with the reply so far while it is being written. */
  onText?: (soFar: string) => void;
}

let slot: EngineSlot<LlamaContext> | null = null;
let slotModelId: string | null = null;

function slotFor(model: ModelEntry): EngineSlot<LlamaContext> {
  if (slot && slotModelId === model.id) return slot;
  const previous = slot;
  slot = new EngineSlot<LlamaContext>({
    load: () => initLlama({ model: modelFile(model).uri, n_ctx: CONTEXT_TOKENS, n_threads: THREADS, n_gpu_layers: 0, use_mlock: false }),
    release: (context) => context.release(),
  });
  slotModelId = model.id;
  void previous?.unload();
  return slot;
}

export function generate({ model, messages, maxTokens, temperature, jsonSchema, timeoutMs, signal, onText }: GenerateRequest): Promise<string> {
  if (!modelFile(model).exists) return Promise.reject(new AiError('unavailable', 'The language model is not installed.'));
  return slotFor(model).run(
    async (context, stopSignal) => {
      stopSignal.addEventListener('abort', () => void context.stopCompletion());
      const result = await context.completion(
        {
          messages: messages.map((m) => ({ ...m })),
          n_predict: maxTokens,
          temperature,
          top_p: 0.9,
          jinja: true,
          // Both models can "think" first; that only costs time and memory here.
          enable_thinking: false,
          reasoning_format: 'auto',
          response_format: jsonSchema ? { type: 'json_schema', json_schema: { strict: true, schema: jsonSchema } } : undefined,
        },
        onText ? (data) => onText(data.content ?? data.accumulated_text ?? '') : undefined,
      );
      if (result.interrupted) throw new AiError('cancelled', 'Stopped.');
      return result.content || result.text;
    },
    { timeoutMs, signal },
  );
}

/** Frees the language model now. */
export async function unloadLlm(): Promise<void> {
  await slot?.unload();
}
