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

const context = (completion: jest.Mock) => ({ completion, stopCompletion: jest.fn(async () => undefined), release: jest.fn(async () => undefined) });

beforeEach(() => {
  jest.clearAllMocks();
  mockOnDisk.clear();
});
afterEach(async () => {
  await unloadLlm();
});

describe('language model service', () => {
  it('asks for a reply without thinking and returns its content', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async () => ({ content: 'Bonjour !', text: '<think></think>Bonjour !', interrupted: false }));
    (initLlama as jest.Mock).mockResolvedValue(context(completion));
    await expect(generate(base)).resolves.toBe('Bonjour !');
    expect(initLlama).toHaveBeenCalledWith(expect.objectContaining({ model: uri, n_ctx: 4096 }));
    expect(completion).toHaveBeenCalledWith(expect.objectContaining({ enable_thinking: false, n_predict: 64, temperature: 0.2, response_format: undefined }), undefined);
  });

  it('constrains the reply to a JSON schema when given one, and streams text', async () => {
    mockOnDisk.add(uri);
    const completion = jest.fn(async (_p: unknown, cb?: (d: { content?: string }) => void) => {
      cb?.({ content: '{"a"' });
      return { content: '{"a":1}', text: '{"a":1}', interrupted: false };
    });
    (initLlama as jest.Mock).mockResolvedValue(context(completion));
    const seen: string[] = [];
    await generate({ ...base, jsonSchema: { type: 'object' }, onText: (t) => seen.push(t) });
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: 'json_schema', json_schema: { strict: true, schema: { type: 'object' } } } }),
      expect.any(Function),
    );
    expect(seen).toEqual(['{"a"']);
  });

  it('falls back to the raw text when no content was parsed', async () => {
    mockOnDisk.add(uri);
    (initLlama as jest.Mock).mockResolvedValue(context(jest.fn(async () => ({ content: '', text: 'Oui', interrupted: false }))));
    await expect(generate(base)).resolves.toBe('Oui');
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
    (initLlama as jest.Mock).mockResolvedValue(context(jest.fn(async () => ({ content: 'Bon', text: 'Bon', interrupted: true }))));
    await expect(generate(base)).rejects.toMatchObject({ failure: 'cancelled' });
  });

  it('is unavailable without the model file', async () => {
    await expect(generate(base)).rejects.toMatchObject({ failure: 'unavailable' });
  });
});
