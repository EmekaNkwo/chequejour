import { checkOfflineFrench, heardMatch, startOfflineFrench, type SpeechApi } from '../speech/offline-french';

function fakeApi(over: Partial<SpeechApi> = {}): SpeechApi & { start: jest.Mock } {
  return {
    platform: 'android',
    apiLevel: 34,
    supportsOnDeviceRecognition: () => true,
    getSupportedLocales: async () => ({ installedLocales: ['fr-FR'] }),
    requestPermissions: async () => true,
    start: jest.fn(),
    ...over,
  } as SpeechApi & { start: jest.Mock };
}

describe('offline French recognition', () => {
  it('starts strictly on-device with the installed French locale', async () => {
    const api = fakeApi();
    expect(await checkOfflineFrench(api)).toEqual({ status: 'ready', locale: 'fr-FR' });
    expect(await startOfflineFrench(api)).toBe('started');
    expect(api.start).toHaveBeenCalledWith({ lang: 'fr-FR', requiresOnDeviceRecognition: true, interimResults: false, maxAlternatives: 1, continuous: false });
  });

  it('never starts without an on-device French model, even if asked', async () => {
    for (const api of [
      fakeApi({ getSupportedLocales: async () => ({ installedLocales: ['en-US'] }) }),
      fakeApi({ apiLevel: 31 }),
      fakeApi({ supportsOnDeviceRecognition: () => false }),
      fakeApi({
        getSupportedLocales: async () => {
          throw new Error('no service');
        },
      }),
    ]) {
      expect(await startOfflineFrench(api)).toBe('unavailable');
      expect(api.start).not.toHaveBeenCalled();
    }
    expect(await checkOfflineFrench(fakeApi({ getSupportedLocales: async () => ({ installedLocales: [] }) }))).toEqual({ status: 'needs-pack' });
  });

  it('does not start without microphone permission', async () => {
    const api = fakeApi({ requestPermissions: async () => false });
    expect(await startOfflineFrench(api)).toBe('no-permission');
    expect(api.start).not.toHaveBeenCalled();
  });

  it('compares what was heard with the line, ignoring punctuation and case', () => {
    const m = heardMatch('Le samedi, nous nous levons vers dix heures.', 'le samedi nous nous levons vers 10 heures');
    expect([m.matched, m.total]).toEqual([7, 8]);
    expect(m.tokens.find((t) => t.status !== 'ok')).toMatchObject({ word: 'dix' });
  });
});
