/** The PCM recorder ships types under its old package name; this maps them to the one installed. */
declare module '@fugood/react-native-audio-pcm-stream' {
  import type { EmitterSubscription } from 'react-native';

  export interface PcmOptions {
    sampleRate: number;
    channels: 1 | 2;
    bitsPerSample: 8 | 16;
    audioSource?: number;
    wavFile: string;
    bufferSize?: number;
  }

  const AudioRecord: {
    init: (options: PcmOptions) => Promise<void> | void;
    start: () => void;
    stop: () => Promise<void> | void;
    on: (event: 'data', callback: (base64: string) => void) => EmitterSubscription;
  };
  export default AudioRecord;
}
