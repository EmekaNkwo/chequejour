import type { AudioStatus } from 'expo-audio';
import type * as SpeechModule from 'expo-speech';
import type * as Controller from '../audio/audio-controller';
import type * as Log from '../app/log';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
  getAvailableVoicesAsync: jest.fn(),
}));
jest.mock('../../content/build/audio-manifest', () => ({ AUDIO_CLIPS: { clip1: 101, clip2: 102 } }));

interface FakePlayer {
  addListener: jest.Mock;
  replace: jest.Mock;
  setPlaybackRate: jest.Mock;
  seekTo: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
}

let audio: { createAudioPlayer: jest.Mock; setAudioModeAsync: jest.Mock };
let Speech: jest.Mocked<typeof SpeechModule>;
let controller: typeof Controller;
let log: typeof Log;
let player: FakePlayer;
let states: Controller.PlaybackState[];

const latest = () => states[states.length - 1];
const status = (s: Partial<AudioStatus>): AudioStatus => ({ playing: true, currentTime: 0, duration: 10, didJustFinish: false, ...s }) as AudioStatus;
const sendStatus = (s: Partial<AudioStatus>) => (player.addListener.mock.calls[0][1] as (st: AudioStatus) => void)(status(s));
const speakOptions = (call = 0) => Speech.speak.mock.calls[call][1] as Required<NonNullable<Parameters<typeof SpeechModule.speak>[1]>>;

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  audio = jest.requireMock('expo-audio');
  Speech = jest.requireMock('expo-speech');
  player = { addListener: jest.fn(), replace: jest.fn(), setPlaybackRate: jest.fn(), seekTo: jest.fn(async () => undefined), play: jest.fn(), pause: jest.fn() };
  audio.createAudioPlayer.mockReset().mockReturnValue(player);
  audio.setAudioModeAsync.mockReset().mockResolvedValue(undefined);
  Speech.speak.mockReset();
  Speech.stop.mockClear();
  controller = require('../audio/audio-controller');
  log = require('../app/log');
  states = [];
  controller.subscribe((s) => states.push(s));
});

afterEach(() => jest.restoreAllMocks());

describe('audio controller', () => {
  it('sends the current state to new subscribers and stops after unsubscribing', async () => {
    expect(states).toEqual([{ key: null, playing: false, progress: 0, source: null }]);
    const other: Controller.PlaybackState[] = [];
    const unsubscribe = controller.subscribe((s) => other.push(s));
    unsubscribe();
    await controller.play('clip1', 'Bonjour');
    expect(other).toHaveLength(1);
  });

  it('knows which clips are bundled', () => {
    expect(controller.hasClip('clip1')).toBe(true);
    expect(controller.hasClip('missing')).toBe(false);
  });

  it('plays a bundled clip through one shared player at the chosen speed', async () => {
    await controller.play('clip1', 'Bonjour', { rate: 0.75 });
    await controller.play('clip2', 'Salut');
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(audio.createAudioPlayer).toHaveBeenCalledWith(null, { updateInterval: 250 });
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    expect(player.replace.mock.calls).toEqual([[101], [102]]);
    expect(player.setPlaybackRate.mock.calls).toEqual([[0.75, 'high'], [1, 'high']]);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(latest()).toEqual({ key: 'clip2', playing: true, progress: 0, source: 'clip' });
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('tracks clip progress and calls onFinish once at the end', async () => {
    const onFinish = jest.fn();
    await controller.play('clip1', 'Bonjour', { onFinish });
    sendStatus({ currentTime: 5, duration: 10 });
    expect(latest()).toMatchObject({ playing: true, progress: 0.5 });
    sendStatus({ currentTime: 3, duration: 0, playing: false });
    expect(latest()).toMatchObject({ playing: false, progress: 0.5 });
    sendStatus({ didJustFinish: true });
    expect(latest()).toMatchObject({ playing: false, progress: 1 });
    sendStatus({ didJustFinish: true });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith('clip1');
  });

  it('ignores status updates from a clip that was stopped', async () => {
    const onFinish = jest.fn();
    await controller.play('clip1', 'Bonjour', { onFinish });
    await controller.stop();
    const count = states.length;
    sendStatus({ didJustFinish: true });
    expect(states).toHaveLength(count);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('speaks text without a clip and reports when it is done', async () => {
    const onFinish = jest.fn();
    await controller.play('u01-w001', 'le réveil', { rate: 1.25, onFinish });
    expect(Speech.speak).toHaveBeenCalledWith('le réveil', expect.objectContaining({ language: 'fr-FR', rate: 1.25 }));
    expect(latest()).toEqual({ key: 'u01-w001', playing: true, progress: 0, source: 'tts' });
    speakOptions().onDone();
    expect(latest()).toMatchObject({ playing: false, progress: 1 });
    expect(onFinish).toHaveBeenCalledWith('u01-w001');
  });

  it('marks speech stopped or failed as not playing, and logs failures', async () => {
    await controller.play('a', 'un');
    speakOptions().onStopped();
    expect(latest().playing).toBe(false);
    await controller.play('b', 'deux');
    speakOptions(1).onError(new Error('no voice'));
    expect(latest().playing).toBe(false);
    expect(log.recentErrors()[0]).toMatchObject({ where: 'tts', message: 'no voice' });
  });

  it('ignores speech callbacks from an earlier sentence', async () => {
    const first = jest.fn();
    await controller.play('a', 'un', { onFinish: first });
    await controller.play('b', 'deux');
    expect(Speech.stop).toHaveBeenCalledTimes(1);
    speakOptions(0).onDone();
    speakOptions(0).onStopped();
    expect(first).not.toHaveBeenCalled();
    expect(latest()).toMatchObject({ key: 'b', playing: true });
  });

  it('changes a clip speed in place and restarts speech at the new speed', async () => {
    await controller.play('clip1', 'Bonjour');
    await controller.setRate(1.5);
    expect(player.setPlaybackRate).toHaveBeenLastCalledWith(1.5, 'high');
    expect(player.replace).toHaveBeenCalledTimes(1);

    const onFinish = jest.fn();
    await controller.play('t', 'texte', { onFinish });
    await controller.setRate(0.5);
    expect(Speech.speak).toHaveBeenCalledTimes(2);
    expect(Speech.speak).toHaveBeenLastCalledWith('texte', expect.objectContaining({ rate: 0.5 }));
    speakOptions(1).onDone();
    expect(onFinish).toHaveBeenCalledWith('t');
  });

  it('leaves the speed alone when nothing is playing or it is unchanged', async () => {
    await controller.setRate(1.5);
    await controller.play('t', 'texte', { rate: 1 });
    await controller.setRate(1);
    await controller.stop();
    await controller.setRate(0.5);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('logs a clip that fails to load and stops showing it as playing', async () => {
    player.replace.mockImplementation(() => {
      throw new Error('bad asset');
    });
    await controller.play('clip1', 'Bonjour');
    expect(latest().playing).toBe(false);
    expect(log.recentErrors()[0]).toMatchObject({ where: 'audio play', message: 'bad asset' });
  });

  it('still plays when the audio mode cannot be set', async () => {
    audio.setAudioModeAsync.mockRejectedValue(new Error('mode'));
    await controller.play('clip1', 'Bonjour');
    expect(player.play).toHaveBeenCalled();
    expect(log.recentErrors()[0]).toMatchObject({ where: 'audio mode', message: 'mode' });
  });

  it('checks for a French voice and treats errors as none', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValueOnce([{ language: 'en-US' }, { language: 'FR-ca' }] as never);
    expect(await controller.hasFrenchVoice()).toBe(true);
    Speech.getAvailableVoicesAsync.mockResolvedValueOnce([{ language: 'en-US' }] as never);
    expect(await controller.hasFrenchVoice()).toBe(false);
    Speech.getAvailableVoicesAsync.mockRejectedValueOnce(new Error('x'));
    expect(await controller.hasFrenchVoice()).toBe(false);
  });
});

describe('error log', () => {
  it('keeps the newest 50 errors and stringifies non-errors', () => {
    for (let i = 0; i < 55; i += 1) log.logError('loop', i);
    const errors = log.recentErrors();
    expect(errors).toHaveLength(50);
    expect(errors[0]).toMatchObject({ where: 'loop', message: '54' });
    expect(console.warn).toHaveBeenCalledWith('[loop]', 54);
  });
});
