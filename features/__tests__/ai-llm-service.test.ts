import { initLlama } from 'llama.rn';
import type { ModelEntry } from '../../domain/ai/manifest';
import { fixedPrefix } from '../../domain/ai/prompt-prefix';
import { generate, PREFILL_TIMEOUT_MS, unloadLlm, warmLlm } from '../../services/ai/llm';

const mockOnDisk = new Set<string>();
const mockText = new Map<string, string>();
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return mockOnDisk.has(this.uri) || mockText.has(this.uri);
    }
    textSync() {
      return mockText.get(this.uri) ?? '';
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

  it('runs on the fast cores only, read from the kernel once', async () => {
    jest.resetModules();
    [348, 348, 348, 348, 348, 348, 1024, 1024].forEach((c, i) => mockText.set(`file:///sys/devices/system/cpu/cpu${i}/cpu_capacity`, `${c}\n`));
    mockOnDisk.add(uri);
    const { initLlama: init } = jest.requireMock<typeof import('llama.rn')>('llama.rn');
    (init as jest.Mock).mockResolvedValue(context(jest.fn(async () => ({ text: 'Oui', interrupted: false }))));
    const fresh = jest.requireActual<typeof import('../../services/ai/llm')>('../../services/ai/llm');
    await fresh.generate(base);
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ n_threads: 2 }));
    await fresh.unloadLlm();
    mockText.clear();
  });

  it('reads a feature’s fixed instructions into the cache ahead of the request, once', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_params: unknown) => ({ text: '', interrupted: false }));
    const getFormattedChat = jest.fn(async () => ({ ...formatted, prompt: '<|im_start|>system\nBe brief.<|im_end|>\n' }));
    (initLlama as jest.Mock).mockResolvedValue(context(completion, getFormattedChat));
    const system = [{ role: 'system' as const, content: 'Be brief.' }];
    warmLlm(model, system);
    warmLlm(model, system);
    await new Promise((r) => setTimeout(r, 0));
    await generate({ ...base, messages: [...system, { role: 'user', content: 'Salut' }] });
    expect(getFormattedChat).toHaveBeenCalledWith(system, null, expect.objectContaining({ add_generation_prompt: false }));
    // One prefill (the second warm-up found it cached), then the request itself.
    expect(completion).toHaveBeenCalledTimes(2);
    expect(completion.mock.calls[0][0]).toEqual(expect.objectContaining({ prompt: '<|im_start|>system\nBe brief.<|im_end|>\n', n_predict: 1 }));
  });

  it('reads a worked example along with the instructions: everything before the learner’s message', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_params: unknown) => ({ text: '', interrupted: false }));
    const getFormattedChat = jest.fn(async () => formatted);
    (initLlama as jest.Mock).mockResolvedValue(context(completion, getFormattedChat));
    const full = [
      { role: 'system' as const, content: 'Correct the text.' },
      { role: 'user' as const, content: 'je suis alle' },
      { role: 'assistant' as const, content: 'je suis allé' },
      { role: 'user' as const, content: 'il est parti' },
    ];
    expect(fixedPrefix(full)).toEqual(full.slice(0, 3));
    warmLlm(model, fixedPrefix(full));
    await new Promise((r) => setTimeout(r, 0));
    // An empty turn after the example: Qwen3's template writes the last answer differently, so ending on it would not match the request.
    expect(getFormattedChat).toHaveBeenCalledWith([...full.slice(0, 3), { role: 'user', content: '' }], null, expect.objectContaining({ add_generation_prompt: false }));
    await generate({ ...base, messages: full });
    // The request left the same opening in the cache, so warming it again reads nothing.
    warmLlm(model, fixedPrefix([...full.slice(0, 3), { role: 'user', content: 'autre texte' }]));
    await new Promise((r) => setTimeout(r, 0));
    expect(completion).toHaveBeenCalledTimes(2);
  });

  it('queues one warm-up when many cards ask at once', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_params: unknown) => ({ text: '', interrupted: false }));
    (initLlama as jest.Mock).mockResolvedValue(context(completion));
    const system = [{ role: 'system' as const, content: 'Be brief.' }];
    for (let i = 0; i < 5; i += 1) warmLlm(model, system);
    await new Promise((r) => setTimeout(r, 0));
    await generate({ ...base, messages: [...system, { role: 'user', content: 'Salut' }] });
    expect(completion).toHaveBeenCalledTimes(2);
  });

  it('skips the warm-up when a real request is already waiting', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_params: unknown) => ({ text: 'ok', interrupted: false }));
    (initLlama as jest.Mock).mockResolvedValue(context(completion));
    warmLlm(model, [{ role: 'system', content: 'Be brief.' }]);
    await generate(base);
    expect(completion).toHaveBeenCalledTimes(1);
    expect(completion.mock.calls[0][0]).toEqual(expect.objectContaining({ n_predict: 64 }));
  });

  it('stops a warm-up that runs too long, so the next request does not overlap it', async () => {
    jest.useFakeTimers();
    try {
      mockOnDisk.add(uri);
      // Like the native call: it only ends once it is told to stop.
      let finish: (r: { text: string; interrupted: boolean }) => void = () => undefined;
      const ctx = context(jest.fn(() => new Promise((resolve) => (finish = resolve))));
      ctx.stopCompletion.mockImplementation(async () => {
        finish({ text: '', interrupted: true });
        return undefined;
      });
      (initLlama as jest.Mock).mockResolvedValue(ctx);
      warmLlm(model, [{ role: 'system', content: 'Be brief.' }]);
      await jest.advanceTimersByTimeAsync(PREFILL_TIMEOUT_MS + 1);
      expect(ctx.stopCompletion).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('never lets a failed warm-up surface', async () => {
    mockOnDisk.add(uri);
    (initLlama as jest.Mock).mockRejectedValue(new Error('out of memory'));
    expect(() => warmLlm(model, [{ role: 'system', content: 'x' }])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('is unavailable without the model file', async () => {
    await expect(generate(base)).rejects.toMatchObject({ failure: 'unavailable' });
  });
});
