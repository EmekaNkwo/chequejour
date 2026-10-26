/**
 * The speech model reads 16 kHz mono 16-bit PCM WAV. The recorder streams raw PCM as
 * base64 chunks; these turn them into a WAV file once recording stops.
 */
export const WAV_FORMAT = { sampleRate: 16000, channels: 1, bitsPerSample: 16 } as const;
export const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = (WAV_FORMAT.bitsPerSample / 8) * WAV_FORMAT.channels;

export function wavHeader(dataBytes: number): Uint8Array {
  const size = dataBytes - (dataBytes % BYTES_PER_SAMPLE);
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const view = new DataView(header.buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + size, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, WAV_FORMAT.channels, true);
  view.setUint32(24, WAV_FORMAT.sampleRate, true);
  view.setUint32(28, WAV_FORMAT.sampleRate * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, WAV_FORMAT.bitsPerSample, true);
  text(36, 'data');
  view.setUint32(40, size, true);
  return header;
}

export function pcmDurationMs(dataBytes: number): number {
  return Math.round((dataBytes / (WAV_FORMAT.sampleRate * BYTES_PER_SAMPLE)) * 1000);
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE = new Map([...BASE64].map((c, i) => [c, i]));

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let out = 0;
  for (const c of clean) {
    value = (value << 6) | (BASE64_VALUE.get(c) ?? 0);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (value >> bits) & 0xff;
      value &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/** Header plus the recorded chunks, in order, as one WAV file. */
export function buildWav(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const size = total - (total % BYTES_PER_SAMPLE);
  const wav = new Uint8Array(WAV_HEADER_BYTES + size);
  wav.set(wavHeader(size), 0);
  let offset = WAV_HEADER_BYTES;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.length, wav.length - offset));
    wav.set(part, offset);
    offset += part.length;
  }
  return wav;
}
