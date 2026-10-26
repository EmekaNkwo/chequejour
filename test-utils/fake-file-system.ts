/**
 * In-memory stand-in for expo-file-system's File/Directory/Paths, for jest.mock:
 *   jest.mock('expo-file-system', () => require('../../test-utils/fake-file-system').fakeFileSystem());
 */
interface Entry {
  uri: string;
}

export interface FakeFs {
  files: Map<string, string>;
  dirs: Set<string>;
  /** What Directory.pickDirectoryAsync returns: a folder uri, or null to act as a cancel. */
  pickedDirectory: string | null;
  /** Content served for a download URL; a missing URL makes the download fail. */
  remote: Map<string, string>;
  /** When true, downloads wait until paused, cancelled or released with `finishDownloads`. */
  holdDownloads: boolean;
  finishDownloads: () => void;
  /** What Paths.availableDiskSpace reports. */
  freeBytes: number;
  reset: () => void;
}

interface Waiter {
  release: () => void;
}

const join = (parts: (string | Entry)[]): string => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');

export function fakeFileSystem() {
  const waiters: Waiter[] = [];
  const fs: FakeFs = {
    files: new Map(),
    dirs: new Set(),
    pickedDirectory: null,
    remote: new Map(),
    holdDownloads: false,
    freeBytes: 64e9,
    finishDownloads() {
      for (const w of waiters.splice(0)) w.release();
    },
    reset() {
      fs.files.clear();
      fs.dirs.clear();
      fs.remote.clear();
      fs.pickedDirectory = null;
      fs.holdDownloads = false;
      fs.freeBytes = 64e9;
      waiters.splice(0);
    },
  };

  class Directory {
    static async pickDirectoryAsync(): Promise<Directory> {
      if (fs.pickedDirectory === null) throw Object.assign(new Error('The file picker was cancelled by the user'), { code: 'ERR_PICKER_CANCELLED' });
      fs.dirs.add(fs.pickedDirectory);
      return new Directory(fs.pickedDirectory);
    }
    readonly uri: string;
    constructor(...parts: (string | Entry)[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return fs.dirs.has(this.uri);
    }
    create(): void {
      fs.dirs.add(this.uri);
    }
    createFile(name: string, _mimeType: string | null): File {
      const file = new File(this.uri, name);
      file.create();
      return file;
    }
    delete(): void {
      fs.dirs.delete(this.uri);
      for (const key of [...fs.files.keys()]) if (key.startsWith(`${this.uri}/`)) fs.files.delete(key);
    }
  }

  class File {
    uri: string;
    constructor(...parts: (string | Entry)[]) {
      this.uri = join(parts);
    }
    get name(): string {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }
    get exists(): boolean {
      return fs.files.has(this.uri);
    }
    create(): void {
      fs.files.set(this.uri, '');
    }
    delete(): void {
      if (!fs.files.has(this.uri)) throw new Error(`missing ${this.uri}`);
      fs.files.delete(this.uri);
    }
    async write(text: string): Promise<void> {
      fs.files.set(this.uri, text);
    }
    get size(): number {
      return (fs.files.get(this.uri) ?? '').length;
    }
    async digest(algorithm: string): Promise<string> {
      const text = await this.text();
      const { createHash } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
      return createHash(algorithm.toLowerCase().replace('-', '')).update(text).digest('hex');
    }
    static createDownloadTask(url: string, destination: File, options?: { onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void }): DownloadTask {
      return new DownloadTask({ url, fileUri: destination.uri, isDirectory: false }, options);
    }
    async text(): Promise<string> {
      const text = fs.files.get(this.uri);
      if (text === undefined) throw new Error(`missing ${this.uri}`);
      return text;
    }
    async move(target: File): Promise<void> {
      const text = await this.text();
      fs.files.delete(this.uri);
      fs.files.set(target.uri, text);
      this.uri = target.uri;
    }
  }

  /** Serves `fs.remote` content; resuming continues from what was already written. */
  class DownloadTask {
    state: 'idle' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' = 'idle';
    private stopped: (() => void) | null = null;
    constructor(
      private readonly saved: { url: string; fileUri: string; isDirectory: boolean },
      private readonly options?: { onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void },
    ) {}
    static fromSavable(state: { url: string; fileUri: string; isDirectory: boolean }, options?: { onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void }): DownloadTask {
      return new DownloadTask(state, options);
    }
    downloadAsync(): Promise<File | null> {
      return this.run();
    }
    resumeAsync(): Promise<File | null> {
      return this.run();
    }
    private async run(): Promise<File | null> {
      const body = fs.remote.get(this.saved.url);
      if (body === undefined) {
        this.state = 'error';
        throw new Error(`HTTP 404 for ${this.saved.url}`);
      }
      this.state = 'active';
      const half = Math.floor(body.length / 2);
      const have = fs.files.get(this.saved.fileUri) ?? '';
      if (have.length < half) fs.files.set(this.saved.fileUri, body.slice(0, half));
      this.options?.onProgress?.({ bytesWritten: Math.max(have.length, half), totalBytes: body.length });
      if (fs.holdDownloads) {
        const stopped = await new Promise<boolean>((resolve) => {
          this.stopped = () => resolve(true);
          waiters.push({ release: () => resolve(false) });
        });
        if (stopped) return null;
      }
      fs.files.set(this.saved.fileUri, body);
      this.options?.onProgress?.({ bytesWritten: body.length, totalBytes: body.length });
      this.state = 'completed';
      return new File(this.saved.fileUri);
    }
    async pauseAsync(): Promise<void> {
      this.state = 'paused';
      this.stopped?.();
    }
    cancel(): void {
      this.state = 'cancelled';
      this.stopped?.();
    }
    savable(): { url: string; fileUri: string; isDirectory: boolean; resumeData: string } {
      return { ...this.saved, resumeData: 'opaque' };
    }
  }

  return { __fs: fs, Directory, File, DownloadTask, Paths: {
      document: { uri: 'file:///documents' },
      cache: { uri: 'file:///cache' },
      get availableDiskSpace(): number {
        return fs.freeBytes;
      },
    }, };
}
