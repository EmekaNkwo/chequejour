/**
 * One on-device model held in memory: loaded lazily on the first job, released after a
 * spell of idleness (or on demand, e.g. when the app goes to the background), and used
 * by one job at a time. Every job has a time limit and can be cancelled.
 */
import { AiError } from '../../domain/ai/errors';

export const IDLE_UNLOAD_MS = 2 * 60_000;
/** After a timeout or cancel, how long to let the native call unwind before the next job. */
export const SETTLE_MS = 5_000;

export interface EngineSlotOptions<C> {
  load: () => Promise<C>;
  release: (context: C) => Promise<void>;
  idleMs?: number;
  /** How long a stopped job may keep the queue while its native call unwinds. */
  settleMs?: number;
}

export interface JobOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

/** A job receives the loaded context and a signal that fires on timeout or cancel; it should stop its native work then. */
export type Job<C, T> = (context: C, signal: AbortSignal) => Promise<T>;

export class EngineSlot<C> {
  private context: C | null = null;
  private loading: Promise<C> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = 0;

  constructor(private readonly options: EngineSlotOptions<C>) {}

  get loaded(): boolean {
    return this.context !== null;
  }

  /** Runs `job` after the jobs queued before it. */
  run<T>(job: Job<C, T>, options: JobOptions): Promise<T> {
    this.busy += 1;
    this.clearIdle();
    // A job stopped early still holds the queue until its native call has unwound.
    let settled: Promise<unknown> = Promise.resolve();
    const next = this.queue.then(() =>
      this.runNow(job, options, (p) => {
        settled = p;
      }),
    );
    this.queue = next.catch(() => undefined).then(() => settled);
    return next.finally(() => {
      this.busy -= 1;
      if (this.busy === 0) this.scheduleIdle();
    });
  }

  /** Frees the model's memory now; the next job loads it again. */
  async unload(): Promise<void> {
    this.clearIdle();
    // Never free the model under a running job. Jobs queued while waiting are waited for
    // too; jobs are time-limited, so this ends.
    let seen: Promise<unknown>;
    do {
      seen = this.queue;
      await seen;
    } while (seen !== this.queue);
    const context = this.context ?? (this.loading ? await this.loading.catch(() => null) : null);
    this.context = null;
    this.loading = null;
    if (context !== null) await this.options.release(context);
  }

  private async runNow<T>(job: Job<C, T>, { timeoutMs, signal }: JobOptions, onSettle: (settled: Promise<unknown>) => void): Promise<T> {
    if (signal?.aborted) throw new AiError('cancelled', 'Cancelled before it started.');
    const context = await this.ensureLoaded();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const stopped = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiError('timeout', `No answer within ${Math.round(timeoutMs / 1000)} s.`));
      }, timeoutMs);
      onAbort = () => {
        controller.abort();
        reject(new AiError('cancelled', 'Cancelled.'));
      };
      signal?.addEventListener('abort', onAbort);
    });
    const work = job(context, controller.signal);
    try {
      return await Promise.race([work, stopped]);
    } catch (e: unknown) {
      throw e instanceof AiError ? e : new AiError('failed', e instanceof Error ? e.message : 'The model failed.');
    } finally {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      // Stopped early: the caller hears now, but the next job or a release waits until the
      // native call has really stopped (or a short limit passes).
      if (controller.signal.aborted) {
        onSettle(Promise.race([work.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, this.options.settleMs ?? SETTLE_MS))]));
      }
    }
  }

  private ensureLoaded(): Promise<C> {
    if (this.context !== null) return Promise.resolve(this.context);
    if (!this.loading) {
      this.loading = this.options
        .load()
        .then((context) => {
          this.context = context;
          return context;
        })
        .catch((e: unknown) => {
          throw new AiError('load-failed', e instanceof Error ? e.message : 'The model could not be loaded.');
        })
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  private scheduleIdle(): void {
    this.clearIdle();
    this.idleTimer = setTimeout(() => {
      this.unload().catch(() => undefined);
    }, this.options.idleMs ?? IDLE_UNLOAD_MS);
  }

  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}
