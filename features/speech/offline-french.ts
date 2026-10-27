/**
 * Optional on-device French speech recognition for shadowing. The availability check
 * runs again right before every start, so a removed language pack or an unsupported
 * phone can never reach a recognizer that might send audio online.
 */
import { offlineFrenchStatus, type OfflineSpeechStatus } from '../../domain/offline-speech';
import { diffWords, type DiffToken } from '../../domain/exercises/dictation-diff';

export interface SpeechStartOptions {
  lang: string;
  requiresOnDeviceRecognition: true;
  interimResults: false;
  maxAlternatives: 1;
  continuous: false;
}

/** The parts of expo-speech-recognition used here, injectable for tests. */
export interface SpeechApi {
  platform: string;
  apiLevel: number | null;
  supportsOnDeviceRecognition(): boolean;
  /** Locales with an on-device model, for the default on-device service. */
  getSupportedLocales(): Promise<{ installedLocales: string[] }>;
  requestPermissions(): Promise<boolean>;
  start(options: SpeechStartOptions): void;
}

/** What the availability check needs to know about the phone. */
export type SpeechFacts = Pick<SpeechApi, 'platform' | 'apiLevel' | 'supportsOnDeviceRecognition' | 'getSupportedLocales'>;

export async function checkOfflineFrench(api: SpeechFacts): Promise<OfflineSpeechStatus> {
  try {
    const { installedLocales } = await api.getSupportedLocales();
    return offlineFrenchStatus({ platform: api.platform, apiLevel: api.apiLevel, supportsOnDevice: api.supportsOnDeviceRecognition(), installedLocales });
  } catch {
    return { status: 'unsupported' };
  }
}

export type StartResult = 'started' | 'unavailable' | 'no-permission';

export async function startOfflineFrench(api: SpeechApi): Promise<StartResult> {
  const status = await checkOfflineFrench(api);
  if (status.status !== 'ready') return 'unavailable';
  if (!(await api.requestPermissions())) return 'no-permission';
  api.start({ lang: status.locale, requiresOnDeviceRecognition: true, interimResults: false, maxAlternatives: 1, continuous: false });
  return 'started';
}

export interface HeardMatch {
  tokens: DiffToken[];
  matched: number;
  total: number;
}

/** Word-by-word comparison of the line with what the recognizer heard. */
export function heardMatch(expected: string, heard: string): HeardMatch {
  const tokens = diffWords(expected, heard);
  const expectedTokens = tokens.filter((t) => t.status !== 'extra');
  return { tokens, matched: expectedTokens.filter((t) => t.status === 'ok').length, total: expectedTokens.length };
}
