import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useFrenchSpeech, type FrenchSpeechApi } from '../speech/useFrenchSpeech';

jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {} }));

let onAppState: ((s: AppStateStatus) => void) | null = null;
beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, h) => {
    onAppState = h as (s: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

function fakeApi(locales: string[]): FrenchSpeechApi & { installed: string[] } {
  const api = {
    installed: locales,
    platform: 'android',
    apiLevel: 34,
    supportsOnDeviceRecognition: () => true,
    getSupportedLocales: async () => ({ installedLocales: api.installed }),
    triggerFrenchDownload: jest.fn(async () => undefined),
  };
  return api;
}

describe('the phone’s French speech recognition', () => {
  it('is ready when an on-device French model is installed', async () => {
    const api = fakeApi(['fr-FR']);
    const { result } = await renderHook(() => useFrenchSpeech(api));
    expect(result.current.status).toEqual({ status: 'ready', locale: 'fr-FR' });
    expect(result.current.ready).toBe(true);
  });

  it('offers to install French, and notices it once the learner comes back', async () => {
    const api = fakeApi(['en-GB']);
    const { result } = await renderHook(() => useFrenchSpeech(api));
    expect(result.current.status).toEqual({ status: 'needs-pack' });
    expect(result.current.canInstall).toBe(true);
    await act(async () => result.current.install());
    expect(api.triggerFrenchDownload).toHaveBeenCalledWith('fr-FR');
    api.installed = ['en-GB', 'fr-FR'];
    await act(async () => onAppState?.('active'));
    expect(result.current.ready).toBe(true);
  });

  it('is not offered on phones that cannot keep recognition on the device', async () => {
    const api = { ...fakeApi(['fr-FR']), apiLevel: 31 };
    const { result } = await renderHook(() => useFrenchSpeech(api));
    expect(result.current.status).toEqual({ status: 'unsupported' });
    expect(result.current.canInstall).toBe(false);
  });
});
