import { initLlama } from 'llama.rn';
import type { ModelEntry } from '../../domain/ai/manifest';
import { generate, unloadLlm } from '../../services/ai/llm';

const mockOnDisk = new Set<string>();
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return mockOnDisk.has(this.uri);
    }
  }
  return { File, Directory: File, Paths: { document: { uri: 'file:///docs' } } };
});

const model: ModelEntry = { id: 'qwen3-1.7b', kind: 'llm', name: 'Qwen', file: 'qwen.gguf', url: 'https://huggingface.co/x', bytes: 1, sha256: 'a'.repeat(64), licence: 'Apache-2.0', source: 's' };
const uri = 'file:///docs/ai-pack/qwen.gguf';
const base = { model, messages: [{ role: 'user' as const, content: 'Salut' }], maxTokens: 64, temperature: 0.2, timeoutMs: 5000 };

const formatted = { type: 'jinja', prompt: '<|im_start|>user\nSalut<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n', grammar: '', additional_stops: [] as string[] };
const context = (completion: jest.Mock, getFormattedChat = jest.fn(async () => formatted)) => ({
  completion,
  getFormattedChat,
  stopCompletion: jest.fn(async () => undefined),
  release: jest.fn(async () => undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOnDisk.clear();
});
afterEach(async () => {
  await unloadLlm();
});

describe('language model service', () => {
  it('formats the chat without thinking, then generates from that prompt', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async () => ({ text: '<|im_start|>assistant\nBonjour !', interrupted: false }));
    const ctx = context(completion);
    (initLlama as jest.Mock).mockResolvedValue(ctx);
    await expect(generate(base)).resolves.toBe('<|im_start|>assistant\nBonjour !');
    expect(initLlama).toHaveBeenCalledWith(expect.objectContaining({ model: uri, n_ctx: 4096 }));
    expect(ctx.getFormattedChat).toHaveBeenCalledWith(base.messages, null, expect.objectContaining({ jinja: true, enable_thinking: false, response_format: undefined }));
    // A plain prompt, not messages: llama.rn's reply parser is kept out of the way.
    expect(completion).toHaveBeenCalledWith({ prompt: formatted.prompt, grammar: undefined, stop: [], n_predict: 64, temperature: 0.2, top_p: 0.9 }, undefined);
  });

  it('applies the JSON grammar directly and streams the text without the header', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_p: unknown, cb?: (d: { accumulated_text?: string }) => void) => {
      cb?.({ accumulated_text: '<|im_start|>assistant\n{"a"' });
      return { text: '{"a":1}', interrupted: false };
    });
    const getFormattedChat = jest.fn(async () => ({ ...formatted, grammar: 'root ::= object', additional_stops: ['<|im_end|>'] }));
    (initLlama as jest.Mock).mockResolvedValue(context(completion, getFormattedChat));
    const seen: string[] = [];
    await generate({ ...base, jsonSchema: { type: 'object' }, onText: (t) => seen.push(t) });
    expect(getFormattedChat).toHaveBeenCalledWith(
      base.messages,
      null,
      expect.objectContaining({ response_format: { type: 'json_schema', json_schema: { strict: true, schema: { type: 'object' } } } }),
    );
    expect(completion).toHaveBeenCalledWith(expect.objectContaining({ grammar: 'root ::= object', stop: ['<|im_end|>'] }), expect.any(Function));
    expect(seen).toEqual(['{"a"']);
  });

  it('stops the native completion when cancelled', async () => {
    mockOnDisk.add(uri);
    const ctx = context(jest.fn(() => new Promise(() => undefined)));
    (initLlama as jest.Mock).mockResolvedValue(ctx);
    const controller = new AbortController();
    const done = generate({ ...base, signal: controller.signal });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    await expect(done).rejects.toMatchObject({ failure: 'cancelled' });
    expect(ctx.stopCompletion).toHaveBeenCalled();
  });

  it('reports an interrupted completion as cancelled', async () => {
    mockOnDisk.add(uri);
    (initLlama as jest.Mock).mockResolvedValue(context(jest.fn(async () => ({ text: 'Bon', interrupted: true }))));
    await expect(generate(base)).rejects.toMatchObject({ failure: 'cancelled' });
  });

  it('is unavailable without the model file', async () => {
    await expect(generate(base)).rejects.toMatchObject({ failure: 'unavailable' });
  });
});
