import { WAV_FORMAT, WAV_HEADER_BYTES, base64ToBytes, buildWav, pcmDurationMs, wavHeader } from '../ai/wav';

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

describe('WAV header for the speech model', () => {
  it('describes 16 kHz mono 16-bit PCM of the given length', () => {
    const h = wavHeader(32000);
    const view = new DataView(h.buffer);
    expect(h.length).toBe(WAV_HEADER_BYTES);
    expect(ascii(h, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 32000);
    expect(ascii(h, 8, 16)).toBe('WAVEfmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(h, 36, 40)).toBe('data');
    expect(view.getUint32(40, true)).toBe(32000);
  });

  it('drops a trailing half sample so the data is whole samples', () => {
    expect(new DataView(wavHeader(32001).buffer).getUint32(40, true)).toBe(32000);
  });

  it('works out the length of the audio', () => {
    expect(pcmDurationMs(WAV_FORMAT.sampleRate * 2 * 3)).toBe(3000);
    expect(pcmDurationMs(0)).toBe(0);
  });
});

describe('assembling a WAV file from recorded PCM', () => {
  it('decodes base64 chunks the recorder streams', () => {
    expect([...base64ToBytes('AAEC/w==')]).toEqual([0, 1, 2, 255]);
    expect([...base64ToBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...base64ToBytes('AQI=')]).toEqual([1, 2]);
    expect(base64ToBytes('').length).toBe(0);
    const long = Uint8Array.from({ length: 3000 }, (_, i) => (i * 37) % 256);
    expect([...base64ToBytes(Buffer.from(long).toString('base64'))]).toEqual([...long]);
  });

  it('puts the header in front of the chunks, in order', () => {
    const wav = buildWav([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5, 6])]);
    expect(wav.length).toBe(WAV_HEADER_BYTES + 6);
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(6);
    expect([...wav.slice(WAV_HEADER_BYTES)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('drops a trailing half sample from the data too', () => {
    const wav = buildWav([new Uint8Array([1, 2, 3])]);
    expect(wav.length).toBe(WAV_HEADER_BYTES + 2);
  });
});
