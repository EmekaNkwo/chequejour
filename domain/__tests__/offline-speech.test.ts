import { offlineFrenchStatus } from '../offline-speech';

const android = (apiLevel: number, supportsOnDevice: boolean, installedLocales: string[]) => offlineFrenchStatus({ platform: 'android', apiLevel, supportsOnDevice, installedLocales });

describe('offline French speech availability', () => {
  it('is ready only with on-device support and an installed French model', () => {
    expect(android(34, true, ['en-US', 'fr-FR'])).toEqual({ status: 'ready', locale: 'fr-FR' });
    expect(android(34, true, ['fr-CA'])).toEqual({ status: 'ready', locale: 'fr-CA' });
    expect(android(34, true, ['fr_BE'])).toEqual({ status: 'ready', locale: 'fr_BE' });
  });

  it('asks for the French pack when on-device recognition exists without French', () => {
    expect(android(34, true, ['en-US'])).toEqual({ status: 'needs-pack' });
    expect(android(33, true, [])).toEqual({ status: 'needs-pack' });
  });

  it('is unsupported below Android 13, where the library could fall back to a cloud recognizer', () => {
    expect(android(32, true, ['fr-FR'])).toEqual({ status: 'unsupported' });
    expect(android(34, false, ['fr-FR'])).toEqual({ status: 'unsupported' });
  });

  it('follows the same rule on iOS, and refuses unknown platforms', () => {
    expect(offlineFrenchStatus({ platform: 'ios', apiLevel: null, supportsOnDevice: true, installedLocales: ['fr-FR'] })).toEqual({ status: 'ready', locale: 'fr-FR' });
    expect(offlineFrenchStatus({ platform: 'web', apiLevel: null, supportsOnDevice: true, installedLocales: ['fr-FR'] })).toEqual({ status: 'unsupported' });
  });
});
