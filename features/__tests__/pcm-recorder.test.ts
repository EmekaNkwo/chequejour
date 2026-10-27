import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { WAV_HEADER_BYTES } from '../../domain/ai/wav';
import { discardPcm, isPcmRecording, startPcm, stopPcm } from '../../services/ai/pcm-recorder';

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

describe('PCM recorder lifecycle', () => {
  it('discards a take without writing a file', async () => {
    let emit: (b64: string) => void = () => undefined;
    (AudioRecord.on as jest.Mock).mockImplementation((_e, cb: (b64: string) => void) => {
      emit = cb;
      return { remove: jest.fn() };
    });
    await startPcm();
    emit(Buffer.from(new Uint8Array(3200)).toString('base64'));
    await discardPcm();
    expect(isPcmRecording()).toBe(false);
    expect(mockWritten).toHaveLength(0);
  });

  it('shares one stop between overlapping callers', async () => {
    (AudioRecord.on as jest.Mock).mockImplementation((_e, cb: (b64: string) => void) => {
      cb(Buffer.from(new Uint8Array(3200)).toString('base64'));
      return { remove: jest.fn() };
    });
    await startPcm();
    const [a, b] = await Promise.all([stopPcm(1), discardPcm()]);
    expect(a).toEqual(expect.objectContaining({ uri: 'file:///cache/speech-1.wav' }));
    expect(b).toBeUndefined();
    expect(AudioRecord.stop).toHaveBeenCalledTimes(1);
  });

  it('is not left recording when the native start fails', async () => {
    (AudioRecord.on as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
    (AudioRecord.start as jest.Mock).mockImplementationOnce(() => {
      throw new Error('mic busy');
    });
    await expect(startPcm()).rejects.toThrow('mic busy');
    expect(isPcmRecording()).toBe(false);
  });
});
