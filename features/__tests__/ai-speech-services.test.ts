import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { initWhisper } from 'whisper.rn';
import { AiError } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { WAV_HEADER_BYTES } from '../../domain/ai/wav';
import { isPcmRecording, startPcm, stopPcm } from '../../services/ai/pcm-recorder';
import { transcribe, unloadStt } from '../../services/ai/stt';

const mockWritten: { uri: string; bytes: Uint8Array }[] = [];
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
    create() {}
    async write(bytes: Uint8Array) {
      mockWritten.push({ uri: this.uri, bytes });
    }
  }
  return { File, Directory: File, Paths: { cache: { uri: 'file:///cache' }, document: { uri: 'file:///docs' } } };
});

const model: ModelEntry = { id: 'whisper-small', kind: 'stt', name: 'Whisper', file: 'ggml-small.bin', url: 'https://huggingface.co/x', bytes: 1, sha256: 'a'.repeat(64), licence: 'MIT', source: 's' };
const otherModel: ModelEntry = { ...model, id: 'whisper-base', file: 'ggml-base.bin' };
const modelUri = (m: ModelEntry) => `file:///docs/ai-pack/${m.file}`;

beforeEach(() => {
  jest.clearAllMocks();
  mockWritten.length = 0;
  mockOnDisk.clear();
});

describe('PCM recorder', () => {
  it('records 16 kHz mono and writes the chunks as one WAV file', async () => {
    let emit: (b64: string) => void = () => undefined;
    (AudioRecord.on as jest.Mock).mockImplementation((_e, cb: (b64: string) => void) => {
      emit = cb;
      return { remove: jest.fn() };
    });
    await startPcm();
    expect(AudioRecord.init).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 16000, channels: 1, bitsPerSample: 16 }));
    expect(isPcmRecording()).toBe(true);
    emit(Buffer.from(new Uint8Array(32000)).toString('base64'));
    emit(Buffer.from(new Uint8Array(32000)).toString('base64'));
    const take = await stopPcm(7);
    expect(take).toEqual({ uri: 'file:///cache/speech-7.wav', durationMs: 2000 });
    expect(mockWritten[0].bytes.length).toBe(WAV_HEADER_BYTES + 64000);
    expect(isPcmRecording()).toBe(false);
  });

  it('returns null when nothing was recorded or nothing is running', async () => {
    expect(await stopPcm()).toBeNull();
    await startPcm();
    expect(await stopPcm()).toBeNull();
    expect(mockWritten).toHaveLength(0);
  });
});

describe('speech-to-text', () => {
  const context = (text: string) => {
    const stop = jest.fn(async () => undefined);
    return {
      stop,
      release: jest.fn(async () => undefined),
      transcribe: jest.fn(() => ({ stop, promise: Promise.resolve({ result: text, language: 'fr', segments: [], isAborted: false }) })),
    };
  };

  afterEach(async () => {
    await unloadStt();
  });

  it('transcribes a WAV file in French and tidies the text', async () => {
    mockOnDisk.add(modelUri(model));
    const ctx = context(' [Musique] Bonjour tout le monde ');
    (initWhisper as jest.Mock).mockResolvedValue(ctx);
    await expect(transcribe({ model, uri: 'file:///docs/recordings/a.wav', durationMs: 1000 })).resolves.toBe('Bonjour tout le monde');
    expect(initWhisper).toHaveBeenCalledWith({ filePath: modelUri(model) });
    expect(ctx.transcribe).toHaveBeenCalledWith('file:///docs/recordings/a.wav', expect.objectContaining({ language: 'fr' }));
  });

  it('keeps the model loaded between takes and frees it on unload', async () => {
    mockOnDisk.add(modelUri(model));
    const ctx = context('Oui');
    (initWhisper as jest.Mock).mockResolvedValue(ctx);
    await transcribe({ model, uri: 'a.wav', durationMs: 1 });
    await transcribe({ model, uri: 'b.wav', durationMs: 1 });
    expect(initWhisper).toHaveBeenCalledTimes(1);
    await unloadStt();
    expect(ctx.release).toHaveBeenCalled();
  });

  it('loads the other model, freeing the first, when the plan changes', async () => {
    mockOnDisk.add(modelUri(model));
    mockOnDisk.add(modelUri(otherModel));
    const first = context('Un');
    const second = context('Deux');
    (initWhisper as jest.Mock).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await transcribe({ model, uri: 'a.wav', durationMs: 1 });
    await expect(transcribe({ model: otherModel, uri: 'a.wav', durationMs: 1 })).resolves.toBe('Deux');
    await Promise.resolve();
    expect(first.release).toHaveBeenCalled();
  });

  it('is unavailable when the model file is missing', async () => {
    await expect(transcribe({ model, uri: 'a.wav', durationMs: 1 })).rejects.toEqual(new AiError('unavailable', 'The speech model is not installed.'));
    expect(initWhisper).not.toHaveBeenCalled();
  });

  it('stops the native job when cancelled', async () => {
    mockOnDisk.add(modelUri(model));
    const stop = jest.fn(async () => undefined);
    (initWhisper as jest.Mock).mockResolvedValue({ release: jest.fn(async () => undefined), transcribe: () => ({ stop, promise: new Promise(() => undefined) }) });
    const controller = new AbortController();
    const done = transcribe({ model, uri: 'a.wav', durationMs: 1, signal: controller.signal });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    await expect(done).rejects.toMatchObject({ failure: 'cancelled' });
    expect(stop).toHaveBeenCalled();
  });
});
