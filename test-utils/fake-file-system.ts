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
  reset: () => void;
}

const join = (parts: (string | Entry)[]): string => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');

export function fakeFileSystem() {
  const fs: FakeFs = {
    files: new Map(),
    dirs: new Set(),
    reset() {
      fs.files.clear();
      fs.dirs.clear();
    },
  };

  class Directory {
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

  return { __fs: fs, Directory, File, Paths: { document: { uri: 'file:///documents' }, cache: { uri: 'file:///cache' } } };
}
