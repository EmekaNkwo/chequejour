/**
 * The parts of whisper.rn the app uses. Its exports map has no root entry, so the type
 * checker cannot find its types (Metro falls back to its "react-native" field).
 */
declare module 'whisper.rn' {
  export interface TranscribeOptions {
    language?: string;
    maxThreads?: number;
    temperature?: number;
    beamSize?: number;
    prompt?: string;
  }

  export interface TranscribeResult {
    result: string;
    language: string;
    segments: { text: string; t0: number; t1: number }[];
    isAborted: boolean;
  }

  export interface WhisperContext {
    transcribe(filePath: string, options?: TranscribeOptions): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    release(): Promise<void>;
  }

  export function initWhisper(options: { filePath: string; useGpu?: boolean }): Promise<WhisperContext>;
}
