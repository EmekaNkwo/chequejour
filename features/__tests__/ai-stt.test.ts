import { AiError } from '../../domain/ai/errors';
import { transcribeFile, type FileRecognizerApi, type RecognizerEvents } from '../../services/ai/stt';

jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {}, AudioEncodingAndroid: { ENCODING_PCM_16BIT: 2 } }));

/** A fake of the phone's recognizer: records what it was asked and lets a test play its events. */
function fakeRecognizer(overrides: Partial<FileRecognizerApi> = {}) {
  let handlers: RecognizerEvents | null = null;
  const api: FileRecognizerApi & { emit: () => RecognizerEvents } = {
    platform: 'android',
    apiLevel: 34,
    supportsOnDeviceRecognition: () => true,
    getSupportedLocales: async () => ({ installedLocales: ['fr-FR', 'en-US'] }),
    requestPermissions: async () => true,
    startFile: jest.fn(),
    abort: jest.fn(),
    listen: (h) => {
      handlers = h;
      return () => {
        handlers = null;
      };
    },
    emit: () => {
      if (!handlers) throw new Error('not listening');
      return handlers;
    },
    ...overrides,
  };
  return api;
}

const take = { uri: 'file:///docs/recordings/a.wav', durationMs: 4000 };
const started = () => new Promise((r) => setTimeout(r, 0));

describe('speech-to-text with the phone’s own recognizer', () => {
  it('transcribes a recording on the phone, in French, joining its final results', async () => {
    const api = fakeRecognizer();
    const done = transcribeFile(api, take);
    await started();
    expect(api.startFile).toHaveBeenCalledWith({ lang: 'fr-FR', uri: take.uri });
    api.emit().result('Je prends le bus', true);
    api.emit().result('tous les matins', true);
    api.emit().end();
    await expect(done).resolves.toBe('Je prends le bus tous les matins');
  });

  it('ignores interim results and tidies the text', async () => {
    const api = fakeRecognizer();
    const done = transcribeFile(api, take);
    await started();
    api.emit().result('Je pre', false);
    api.emit().result('  Je prends   le bus ', true);
    api.emit().end();
    await expect(done).resolves.toBe('Je prends le bus');
  });

  it('gives an empty transcript when nothing was said', async () => {
    const api = fakeRecognizer();
    const done = transcribeFile(api, take);
    await started();
    api.emit().error('no-speech', 'No speech');
    api.emit().end();
    await expect(done).resolves.toBe('');
  });

  it('never runs without an on-device French model, so nothing can go online', async () => {
    const api = fakeRecognizer({ getSupportedLocales: async () => ({ installedLocales: ['en-US'] }) });
    await expect(transcribeFile(api, take)).rejects.toMatchObject({ failure: 'unavailable' });
    expect(api.startFile).not.toHaveBeenCalled();
    const old = fakeRecognizer({ apiLevel: 31 });
    await expect(transcribeFile(old, take)).rejects.toMatchObject({ failure: 'unavailable' });
    expect(old.startFile).not.toHaveBeenCalled();
  });

  it('needs the speech permission', async () => {
    const api = fakeRecognizer({ requestPermissions: async () => false });
    await expect(transcribeFile(api, take)).rejects.toMatchObject({ failure: 'unavailable' });
    expect(api.startFile).not.toHaveBeenCalled();
  });

  it('reports a recognizer error as a failure', async () => {
    const api = fakeRecognizer();
    const done = transcribeFile(api, take);
    await started();
    api.emit().error('audio-capture', 'File not supported');
    await expect(done).rejects.toBeInstanceOf(AiError);
    await expect(done).rejects.toMatchObject({ failure: 'failed' });
  });

  it('stops the recognizer when cancelled', async () => {
    const api = fakeRecognizer();
    const controller = new AbortController();
    const done = transcribeFile(api, { ...take, signal: controller.signal });
    await started();
    controller.abort();
    await expect(done).rejects.toMatchObject({ failure: 'cancelled' });
    expect(api.abort).toHaveBeenCalled();
  });

  it('stops the recognizer when it takes too long', async () => {
    jest.useFakeTimers();
    try {
      const api = fakeRecognizer();
      const done = transcribeFile(api, take);
      const outcome = expect(done).rejects.toMatchObject({ failure: 'timeout' });
      await jest.advanceTimersByTimeAsync(10 * 60_000);
      await outcome;
      expect(api.abort).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs one recording at a time, since the phone has one recognizer', async () => {
    const api = fakeRecognizer();
    const first = transcribeFile(api, take);
    const second = transcribeFile(api, { ...take, uri: 'file:///docs/recordings/b.wav' });
    await started();
    expect(api.startFile).toHaveBeenCalledTimes(1);
    api.emit().result('Un', true);
    api.emit().end();
    await expect(first).resolves.toBe('Un');
    await started();
    expect(api.startFile).toHaveBeenCalledTimes(2);
    api.emit().result('Deux', true);
    api.emit().end();
    await expect(second).resolves.toBe('Deux');
  });
});
