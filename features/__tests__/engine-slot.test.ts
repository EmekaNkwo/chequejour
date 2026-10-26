import { AiError } from '../../domain/ai/errors';
import { EngineSlot } from '../../services/ai/engine-slot';

interface Ctx {
  id: number;
}

function makeSlot(options: { failLoad?: boolean; idleMs?: number; settleMs?: number } = {}) {
  let loads = 0;
  const released: number[] = [];
  const slot = new EngineSlot<Ctx>({
    load: async () => {
      loads += 1;
      if (options.failLoad) throw new Error('out of memory');
      return { id: loads };
    },
    release: async (c) => {
      released.push(c.id);
    },
    idleMs: options.idleMs ?? 1000,
    settleMs: options.settleMs,
  });
  return { slot, loads: () => loads, released };
}

const failureOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof AiError ? e.failure : 'other'));

afterEach(() => jest.useRealTimers());

describe('engine slot', () => {
  it('loads lazily, once, and reuses the model', async () => {
    const { slot, loads } = makeSlot();
    expect(slot.loaded).toBe(false);
    expect(await slot.run(async (c) => c.id, { timeoutMs: 1000 })).toBe(1);
    expect(await slot.run(async (c) => c.id, { timeoutMs: 1000 })).toBe(1);
    expect(loads()).toBe(1);
    expect(slot.loaded).toBe(true);
  });

  it('runs one job at a time, in order', async () => {
    const { slot } = makeSlot();
    const order: string[] = [];
    let release!: () => void;
    const first = slot.run(
      () =>
        new Promise<void>((resolve) => {
          order.push('first start');
          release = () => {
            order.push('first end');
            resolve();
          };
        }),
      { timeoutMs: 1000 },
    );
    const second = slot.run(async () => void order.push('second'), { timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['first start']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first start', 'first end', 'second']);
  });

  it('stops a job that runs past its time limit and tells it to stop', async () => {
    const { slot } = makeSlot();
    const order: string[] = [];
    const job = slot.run(
      (_c, signal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => {
            order.push('aborted');
            // The native call takes a moment to unwind after being told to stop.
            setTimeout(() => {
              order.push('native stopped');
              resolve();
            }, 30);
          });
        }),
      { timeoutMs: 20 },
    );
    expect(await failureOf(job)).toBe('timeout');
    expect(order).toEqual(['aborted']);
    // The next job waits until the stopped one has really finished.
    expect(await slot.run(async () => order.push('next'), { timeoutMs: 1000 })).toBe(3);
    expect(order).toEqual(['aborted', 'native stopped', 'next']);
  });

  it('moves on after a short limit when a stopped job never finishes', async () => {
    const { slot } = makeSlot({ settleMs: 30 });
    expect(await failureOf(slot.run(() => new Promise<void>(() => undefined), { timeoutMs: 10 }))).toBe('timeout');
    expect(await slot.run(async () => 'next', { timeoutMs: 1000 })).toBe('next');
  });

  it('never frees the model under a job queued while unloading', async () => {
    const { slot, released } = makeSlot();
    const events: string[] = [];
    let finishFirst!: () => void;
    const first = slot.run(() => new Promise<void>((r) => (finishFirst = r)), { timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 0));
    const unloading = slot.unload().then(() => events.push(`released ${released.length}`));
    const second = slot.run(async () => void events.push('second ran'), { timeoutMs: 1000 });
    finishFirst();
    await Promise.all([first, second, unloading]);
    expect(events).toEqual(['second ran', 'released 1']);
  });

  it('lets the learner cancel, before or during a job', async () => {
    const { slot } = makeSlot();
    const early = new AbortController();
    early.abort();
    expect(await failureOf(slot.run(async () => 'x', { timeoutMs: 1000, signal: early.signal }))).toBe('cancelled');
    const during = new AbortController();
    const job = slot.run(() => new Promise<void>(() => undefined), { timeoutMs: 1000, signal: during.signal });
    setTimeout(() => during.abort(), 5);
    expect(await failureOf(job)).toBe('cancelled');
  });

  it('reports a model that cannot load (e.g. out of memory) and tries again next time', async () => {
    const { slot, loads } = makeSlot({ failLoad: true });
    expect(await failureOf(slot.run(async () => 'x', { timeoutMs: 1000 }))).toBe('load-failed');
    expect(await failureOf(slot.run(async () => 'x', { timeoutMs: 1000 }))).toBe('load-failed');
    expect(loads()).toBe(2);
    expect(slot.loaded).toBe(false);
  });

  it('wraps a failing job as a calm failure', async () => {
    const { slot } = makeSlot();
    expect(
      await failureOf(
        slot.run(async () => {
          throw new Error('native crash');
        }, { timeoutMs: 1000 }),
      ),
    ).toBe('failed');
  });

  it('frees the model after being idle, and on demand, but never under a running job', async () => {
    jest.useFakeTimers();
    const { slot, released, loads } = makeSlot({ idleMs: 1000 });
    await slot.run(async () => undefined, { timeoutMs: 5000 });
    await jest.advanceTimersByTimeAsync(999);
    expect(released).toEqual([]);
    await jest.advanceTimersByTimeAsync(1);
    expect(released).toEqual([1]);
    expect(slot.loaded).toBe(false);

    let finish!: () => void;
    const running = slot.run(() => new Promise<void>((r) => (finish = r)), { timeoutMs: 5000 });
    await jest.advanceTimersByTimeAsync(0);
    const unloading = slot.unload();
    await jest.advanceTimersByTimeAsync(0);
    expect(released).toEqual([1]);
    finish();
    await running;
    await unloading;
    expect(released).toEqual([1, 2]);
    expect(loads()).toBe(2);
  });
});
