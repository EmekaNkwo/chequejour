// Global test setup.

// Native on-device AI modules: tests that exercise them mock them more specifically.
jest.mock('whisper.rn', () => ({ initWhisper: jest.fn() }), { virtual: true });
jest.mock('@fugood/react-native-audio-pcm-stream', () => ({
  __esModule: true,
  default: { init: jest.fn(async () => undefined), start: jest.fn(), stop: jest.fn(async () => undefined), on: jest.fn(() => ({ remove: jest.fn() })) },
}));
