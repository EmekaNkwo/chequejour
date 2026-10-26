/**
 * The on-device language model (llama.rn). Like the speech model it loads on first use,
 * answers one request at a time within a time limit, and is freed when idle. Callers
 * get raw text; every feature runs it through domain/ai/guards before showing it.
 */
import { initLlama, type JinjaFormattedChatResult, type LlamaContext } from 'llama.rn';
import { AiError } from '../../domain/ai/errors';
import { stripReasoning } from '../../domain/ai/guards';
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

/**
 * Formats the chat with the model's own template (thinking switched off), then generates
 * from that plain prompt with the JSON grammar applied directly. Passing `messages` to
 * completion instead hands llama.rn's reply parser the generation prompt, and on the phone
 * that let the model think out loud and ignore the grammar.
 */
async function promptFor(context: LlamaContext, messages: readonly ChatMessage[], jsonSchema?: object): Promise<{ prompt: string; grammar?: string; stop: string[] }> {
  const formatted = (await context.getFormattedChat(
    messages.map((m) => ({ ...m })),
    null,
    {
      jinja: true,
      // Both models can "think" first; that only costs time and memory here.
      enable_thinking: false,
      response_format: jsonSchema ? { type: 'json_schema', json_schema: { strict: true, schema: jsonSchema } } : undefined,
    },
  )) as JinjaFormattedChatResult;
  return { prompt: formatted.prompt, grammar: formatted.grammar || undefined, stop: formatted.additional_stops ?? [] };
}

export function generate({ model, messages, maxTokens, temperature, jsonSchema, timeoutMs, signal, onText }: GenerateRequest): Promise<string> {
  if (!modelFile(model).exists) return Promise.reject(new AiError('unavailable', 'The language model is not installed.'));
  return slotFor(model).run(
    async (context, stopSignal) => {
      stopSignal.addEventListener('abort', () => void context.stopCompletion());
      const { prompt, grammar, stop } = await promptFor(context, messages, jsonSchema);
      const result = await context.completion(
        { prompt, grammar, stop, n_predict: maxTokens, temperature, top_p: 0.9 },
        onText ? (data) => onText(stripReasoning(data.accumulated_text ?? '')) : undefined,
      );
      if (result.interrupted) throw new AiError('cancelled', 'Stopped.');
      return result.text;
    },
    { timeoutMs, signal },
  );
}

/** Frees the language model now. */
export async function unloadLlm(): Promise<void> {
  await slot?.unload();
}
