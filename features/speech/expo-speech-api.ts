import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import type { SpeechApi } from './offline-french';

export const expoSpeechApi: SpeechApi = {
  platform: Platform.OS,
  apiLevel: Platform.OS === 'android' ? Number(Platform.Version) : null,
  supportsOnDeviceRecognition: () => ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
  // No service package: the default on-device service reports its installed models.
  getSupportedLocales: () => ExpoSpeechRecognitionModule.getSupportedLocales({}),
  requestPermissions: async () => (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted,
  start: (options) => ExpoSpeechRecognitionModule.start(options),
};

export const stopRecognition = (): void => ExpoSpeechRecognitionModule.stop();
