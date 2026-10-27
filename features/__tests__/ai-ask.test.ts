import { act, renderHook } from '@testing-library/react-native';
import { z } from 'zod';
import { AiError } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { generate } from '../../services/ai/llm';
import { askJson, askText, grammarSchema, llmTimeoutMs, withRetry } from '../ai/ask';
import { useAiJob } from '../ai/useAiJob';

jest.mock('../../services/ai/llm', () => ({ generate: jest.fn() }));
const gen = generate as jest.Mock;
const model = { id: 'llm' } as ModelEntry;
const opts = { model, messages: [], maxTokens: 100, temperature: 0.2 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('guarded requests', () => {
  it('gives the model time for the reply length', () => {
    expect(llmTimeoutMs(100)).toBe(25_000 + 25_000);
  });

  it('turns a zod shape into a grammar schema', () => {
    expect(grammarSchema(z.object({ a: z.string() }))).toEqual({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false });
  });

  it('parses a JSON reply and rejects one that does not fit', async () => {
    const schema = z.object({ a: z.number() });
    gen.mockResolvedValueOnce('{"a": 2}');
    await expect(askJson(opts, schema)).resolves.toEqual({ a: 2 });
    expect(gen).toHaveBeenCalledWith(expect.objectContaining({ jsonSchema: expect.objectContaining({ type: 'object' }), timeoutMs: llmTimeoutMs(100) }));
    gen.mockResolvedValueOnce('{"a": "deux"}');
    await expect(askJson(opts, schema)).rejects.toMatchObject({ failure: 'rejected' });
  });

  it('checks a text reply', async () => {
    gen.mockResolvedValueOnce('Bien sûr, je suis là pour toi.');
    await expect(askText(opts, { language: 'fr', maxChars: 100 })).resolves.toBe('Bien sûr, je suis là pour toi.');
    gen.mockResolvedValueOnce('Visit www.example.com for more.');
    await expect(askText(opts, { language: 'en', maxChars: 100 })).rejects.toMatchObject({ failure: 'rejected' });
  });
});

describe('useAiJob', () => {
  it('goes from working (with partial text) to done', async () => {
    let finish: (v: string) => void = () => undefined;
    const { result } = await renderHook(() => useAiJob<string>('test'));
    expect(result.current.state).toEqual({ status: 'idle' });
    await act(async () => {
      result.current.run((_s, onText) => {
        onText('Bon');
        return new Promise((r) => (finish = r));
      });
    });
    expect(result.current.state).toEqual({ status: 'working', partial: 'Bon' });
    await act(async () => finish('Bonjour'));
    expect(result.current.state).toEqual({ status: 'done', value: 'Bonjour' });
  });

  it('reports a failure by kind', async () => {
    const { result } = await renderHook(() => useAiJob<string>('test'));
    await act(async () => {
      result.current.run(async () => {
        throw new AiError('rejected', 'no');
      });
    });
    expect(result.current.state).toEqual({ status: 'failed', failure: 'rejected' });
  });

  it('cancels the previous request when a new one starts, and on cancel or reset', async () => {
    const signals: AbortSignal[] = [];
    const { result } = await renderHook(() => useAiJob<string>('test'));
    const hang = (s: AbortSignal) => {
      signals.push(s);
      return new Promise<string>(() => undefined);
    };
    await act(async () => result.current.run(hang));
    await act(async () => result.current.run(hang));
    expect(signals[0].aborted).toBe(true);
    await act(async () => result.current.cancel());
    expect(signals[1].aborted).toBe(true);
    expect(result.current.state).toEqual({ status: 'idle' });
    await act(async () => result.current.run(async () => 'x'));
    await act(async () => result.current.reset());
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('ignores a late answer after the screen closed', async () => {
    let finish: (v: string) => void = () => undefined;
    const { result, unmount } = await renderHook(() => useAiJob<string>('test'));
    await act(async () => result.current.run(() => new Promise((r) => (finish = r))));
    await unmount();
    finish('late');
  });
});

describe('one more try', () => {
  it('asks once more, a little less predictably, when the answer fails the checks', async () => {
    const attempt = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce(new AiError('rejected', 'Not in English.'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(attempt)).resolves.toBe('ok');
    expect(attempt.mock.calls).toEqual([[0], [1]]);
  });

  it('gives up after the second try', async () => {
    const attempt = jest.fn(async () => {
      throw new AiError('rejected', 'Not in English.');
    });
    await expect(withRetry(attempt)).rejects.toMatchObject({ failure: 'rejected' });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('does not retry a timeout, a cancel or a missing model', async () => {
    for (const failure of ['timeout', 'cancelled', 'unavailable', 'load-failed'] as const) {
      const attempt = jest.fn(async () => {
        throw new AiError(failure, 'x');
      });
      await expect(withRetry(attempt)).rejects.toMatchObject({ failure });
      expect(attempt).toHaveBeenCalledTimes(1);
    }
  });

  it('does not retry once the learner has cancelled', async () => {
    const controller = new AbortController();
    const attempt = jest.fn(async () => {
      controller.abort();
      throw new AiError('rejected', 'x');
    });
    await expect(withRetry(attempt, controller.signal)).rejects.toMatchObject({ failure: 'rejected' });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
