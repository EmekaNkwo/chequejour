/**
 * The on-device language model (llama.rn). It loads on first use,
 * answers one request at a time within a time limit, and is freed when idle. Callers
 * get raw text; every feature runs it through domain/ai/guards before showing it.
 */
import { initLlama, type JinjaFormattedChatResult, type LlamaContext } from 'llama.rn';
import { AiError } from '../../domain/ai/errors';
import { stripReasoning } from '../../domain/ai/guards';
import type { ModelEntry } from '../../domain/ai/manifest';
import { fixedPrefix } from '../../domain/ai/prompt-prefix';
import { modelFile } from '../../data/ai/modelStore';
import { llmThreads } from './cpu-cores';
import { EngineSlot } from './engine-slot';

/** Prompts and replies here are short; this leaves room for a conversation's history. */
const CONTEXT_TOKENS = 4096;

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
/** The fixed opening each loaded context last read, so a repeated warm-up costs nothing. */
const cachedPrefix = new WeakMap<LlamaContext, string>();
const prefixKey = (messages: readonly ChatMessage[]): string => JSON.stringify(fixedPrefix(messages));
/**
 * Reading a system prompt takes about 8 s, longer when the phone is busy. Bounded, and
 * stopped cleanly, so it can't hold the queue.
 */
export const PREFILL_TIMEOUT_MS = 45_000;
/** The warm-up already queued, so a screen of many cards queues it once. */
let warmingKey: string | null = null;
/** Real requests queued or running: a warm-up behind one of them has nothing left to do. */
let waitingRequests = 0;
let slotModelId: string | null = null;

function slotFor(model: ModelEntry): EngineSlot<LlamaContext> {
  if (slot && slotModelId === model.id) return slot;
  const previous = slot;
  slot = new EngineSlot<LlamaContext>({
    load: async () => initLlama({ model: modelFile(model).uri, n_ctx: CONTEXT_TOKENS, n_threads: await llmThreads(), n_gpu_layers: 0, use_mlock: false }),
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
  waitingRequests += 1;
  return slotFor(model).run(
    async (context, stopSignal) => {
      stopSignal.addEventListener('abort', () => void context.stopCompletion());
      const { prompt, grammar, stop } = await promptFor(context, messages, jsonSchema);
      const result = await context.completion(
        { prompt, grammar, stop, n_predict: maxTokens, temperature, top_p: 0.9 },
        onText ? (data) => onText(stripReasoning(data.accumulated_text ?? '')) : undefined,
      );
      if (result.interrupted) throw new AiError('cancelled', 'Stopped.');
      cachedPrefix.set(context, prefixKey(messages));
      return result.text;
    },
    { timeoutMs, signal },
  ).finally(() => {
    waitingRequests -= 1;
  });
}

/**
 * The prefix as the template will write it inside the full request. Qwen3's template writes
 * an answer after the last user turn with an empty thinking block, so a prefix ending on a
 * worked example's answer is followed by an empty learner turn to keep it a past answer.
 */
function warmMessages(prefix: readonly ChatMessage[]): ChatMessage[] {
  const copy = prefix.map((m) => ({ ...m }));
  return prefix[prefix.length - 1]?.role === 'assistant' ? [...copy, { role: 'user', content: '' }] : copy;
}

/**
 * Starts loading the language model while the learner reads, and with `prefix` (a feature's
 * fixed opening, see fixedPrefix) also reads it into the model's cache: the request then only has
 * the learner's part left to read, which saves several seconds. Never throws.
 */
export function warmLlm(model: ModelEntry, prefix?: readonly ChatMessage[]): void {
  if (!modelFile(model).exists) return;
  const engine = slotFor(model);
  if (!prefix || prefix.length === 0) {
    engine.warm();
    return;
  }
  const key = prefixKey(prefix);
  if (warmingKey === key) return;
  warmingKey = key;
  engine
    .run(async (context, stopSignal) => {
      if (waitingRequests > 0 || cachedPrefix.get(context) === key) return;
      stopSignal.addEventListener('abort', () => void context.stopCompletion());
      const formatted = await context.getFormattedChat(
        warmMessages(prefix),
        null,
        { jinja: true, enable_thinking: false, add_generation_prompt: false },
      );
      // One token is the least completion will run; the request after this reuses the prefix.
      const result = await context.completion({ prompt: formatted.prompt, n_predict: 1, temperature: 0 });
      if (!result.interrupted) cachedPrefix.set(context, key);
    }, { timeoutMs: PREFILL_TIMEOUT_MS })
    .catch(() => undefined)
    .finally(() => {
      if (warmingKey === key) warmingKey = null;
    });
}

/** Frees the language model now. */
export async function unloadLlm(): Promise<void> {
  await slot?.unload();
}
