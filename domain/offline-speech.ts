/**
 * When on-device French speech recognition may be used. It must never fall back to a
 * cloud recognizer, so anything short of a confirmed on-device French model means no.
 * On Android below 13 the recognizer library ignores the on-device flag, so those
 * versions are treated as unsupported.
 */
export type OfflineSpeechStatus = { status: 'ready'; locale: string } | { status: 'needs-pack' } | { status: 'unsupported' };

export interface OfflineSpeechFacts {
  platform: string;
  /** Android API level; null elsewhere. */
  apiLevel: number | null;
  supportsOnDevice: boolean;
  /** Locales with an on-device model installed. */
  installedLocales: readonly string[];
}

const MIN_ANDROID_API = 33;
const PREFERRED = ['fr-FR', 'fr-CA'];

export function offlineFrenchStatus(f: OfflineSpeechFacts): OfflineSpeechStatus {
  if (f.platform !== 'android' && f.platform !== 'ios') return { status: 'unsupported' };
  if (f.platform === 'android' && (f.apiLevel ?? 0) < MIN_ANDROID_API) return { status: 'unsupported' };
  if (!f.supportsOnDevice) return { status: 'unsupported' };
  const french = f.installedLocales.filter((l) => /^fr([-_]|$)/i.test(l));
  if (french.length === 0) return { status: 'needs-pack' };
  return { status: 'ready', locale: PREFERRED.find((p) => french.includes(p)) ?? french[0] };
}
