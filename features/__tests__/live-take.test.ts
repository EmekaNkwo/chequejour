import { startLiveTake, type LiveEvents, type LiveRecognizerApi, type LiveSession } from '../../services/ai/live-take';
import { acquireRecognizer } from '../../services/ai/recognizer-lock';

jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {} }));

/** A fake recognizer: records what it was asked and lets a test play its events. */
function fakeRecognizer(overrides: Partial<LiveRecognizerApi> = {}) {
  let handlers: LiveEvents | null = null;
  const api: LiveRecognizerApi & { emit: () => LiveEvents; listening: () => boolean } = {
    platform: 'android',
    apiLevel: 34,
    supportsOnDeviceRecognition: () => true,
    getSupportedLocales: async () => ({ installedLocales: ['fr-FR'] }),
    requestPermissions: async () => true,
    startLive: jest.fn(),
    stop: jest.fn(),
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
    listening: () => handlers !== null,
    ...overrides,
  };
  return api;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Lets the availability check, permission and lock run until the take is listening. */
async function untilListening(api: { listening: () => boolean }) {
  for (let i = 0; i < 20 && !api.listening(); i += 1) await tick();
}

/** Takes a test left open, thrown away after it so the recognizer is free for the next. */
let open: { session: LiveSession; api: ReturnType<typeof fakeRecognizer> }[] = [];
afterEach(async () => {
  const left = open;
  open = [];
  for (const { session, api } of left) {
    const thrown = session.abort();
    if (api.listening()) api.emit().end();
    await thrown;
  }
});

/** Starts a take and plays the recognizer becoming ready. */
async function started(api: ReturnType<typeof fakeRecognizer>, persist = true) {
  const pending = startLiveTake(api, { persist });
  await untilListening(api);
  api.emit().audioStart(1000);
  api.emit().ready();
  const session = await pending;
  open.push({ session, api });
  return session;
}

/** Plays the recognizer finishing after stop: the file is closed, then the session ends. */
function finish(api: ReturnType<typeof fakeRecognizer>, uri: string | null = 'file:///cache/recording_1.wav', at = 5000) {
  api.emit().audioEnd(uri, at);
  api.emit().end();
}

describe('a live take: recorded and recognised at the same time', () => {
  it('starts the on-device French recognizer on the microphone, keeping the audio when asked', async () => {
    const api = fakeRecognizer();
    await started(api);
    expect(api.startLive).toHaveBeenCalledWith({ lang: 'fr-FR', persist: true });
  });

  it('hands back the recording and what was heard as soon as it stops', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    api.emit().result('Je prends le bus', true);
    api.emit().result('tous les', false);
    const stopped = session.stop();
    api.emit().result('  tous les matins ', true);
    await tick();
    expect(api.stop).toHaveBeenCalled();
    finish(api);
    await expect(stopped).resolves.toEqual({ uri: 'file:///cache/recording_1.wav', durationMs: 4000, transcript: 'Je prends le bus tous les matins', error: null });
    expect(api.listening()).toBe(false);
  });

  it('lets the recognizer finish what the learner just said before stopping it', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    const stopped = session.stop();
    await tick();
    // Stopping mid-segment would lose it: wait for the segment the learner just finished.
    expect(api.stop).not.toHaveBeenCalled();
    api.emit().result('parce que je n’ai pas de voiture', true);
    await tick();
    expect(api.stop).toHaveBeenCalled();
    // This recognizer reports an error when told to stop; the words are already in.
    api.emit().error('client', 'Other client side errors.');
    finish(api);
    await expect(stopped).resolves.toMatchObject({ transcript: 'parce que je n’ai pas de voiture', error: null });
  });

  it('does not wait for a segment for long', async () => {
    jest.useFakeTimers();
    try {
      const api = fakeRecognizer();
      const pending = startLiveTake(api, { persist: true });
      await jest.advanceTimersByTimeAsync(0);
      api.emit().ready();
      const session = await pending;
      const stopped = session.stop();
      await jest.advanceTimersByTimeAsync(2_000);
      expect(api.stop).toHaveBeenCalled();
      finish(api);
      await stopped;
    } finally {
      jest.useRealTimers();
    }
  });

  it('treats silence as an empty transcript, not a failure', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    const stopped = session.stop();
    api.emit().result('', true);
    await tick();
    api.emit().error('no-speech', 'No speech');
    finish(api);
    await expect(stopped).resolves.toMatchObject({ transcript: '', error: null });
  });

  it('reports a recognizer failure with whatever was recorded, so the file can still be used', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    api.emit().error('audio-capture', 'Audio recording error.');
    finish(api);
    await expect(session.stop()).resolves.toMatchObject({ uri: 'file:///cache/recording_1.wav', error: 'Audio recording error.' });
    // It had already ended: nothing left to stop.
    expect(api.stop).not.toHaveBeenCalled();
  });

  it('tells the caller when the recognizer ends on its own', async () => {
    const api = fakeRecognizer();
    const onEnd = jest.fn();
    const session = startLiveTake(api, { persist: true, onEnd });
    await untilListening(api);
    api.emit().ready();
    open.push({ session: await session, api });
    finish(api);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('never starts without an on-device French model, so nothing can go online', async () => {
    const api = fakeRecognizer({ getSupportedLocales: async () => ({ installedLocales: ['en-US'] }) });
    await expect(startLiveTake(api, { persist: true })).rejects.toMatchObject({ failure: 'unavailable' });
    const refused = fakeRecognizer({ requestPermissions: async () => false });
    await expect(startLiveTake(refused, { persist: true })).rejects.toMatchObject({ failure: 'unavailable' });
    expect(api.startLive).not.toHaveBeenCalled();
    expect(refused.startLive).not.toHaveBeenCalled();
  });

  it('fails to start when the recognizer errors before it is ready, and frees the recognizer', async () => {
    const api = fakeRecognizer();
    const session = startLiveTake(api, { persist: true });
    await untilListening(api);
    api.emit().error('language-not-supported', 'Not supported');
    api.emit().end();
    await expect(session).rejects.toMatchObject({ failure: 'failed' });
    (await acquireRecognizer())();
  });

  it('gives up when the recognizer never becomes ready', async () => {
    jest.useFakeTimers();
    try {
      const api = fakeRecognizer();
      const session = startLiveTake(api, { persist: true });
      const check = expect(session).rejects.toMatchObject({ failure: 'timeout' });
      await jest.advanceTimersByTimeAsync(10_000);
      await check;
      expect(api.abort).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds the recognizer until the take is over', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    let gotIt = false;
    const next = acquireRecognizer().then((release) => {
      gotIt = true;
      release();
    });
    await tick();
    expect(gotIt).toBe(false);
    const stopped = session.stop();
    api.emit().result('', true);
    await tick();
    finish(api);
    await stopped;
    await next;
    expect(gotIt).toBe(true);
  });

  it('can be thrown away mid-take', async () => {
    const api = fakeRecognizer();
    const session = await started(api);
    const thrown = session.abort();
    expect(api.abort).toHaveBeenCalled();
    finish(api, 'file:///cache/recording_2.wav');
    // The caller deletes the file, so no audio is left behind.
    await expect(thrown).resolves.toBe('file:///cache/recording_2.wav');
    (await acquireRecognizer())();
  });
});
