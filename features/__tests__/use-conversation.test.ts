import { act, renderHook } from '@testing-library/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { CLOSING_LINE, MAX_LEARNER_TURNS, REDIRECT_LINE, type ConversationTask } from '../../domain/ai/conversation';
import { AiError } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { discardSpeechTake, isSpeechTakeRecording, startSpeechTake, stopSpeechTake } from '../../services/ai/speech-take';
import { transcribe } from '../../services/ai/stt';
import { play } from '../audio/audio-controller';
import { partnerReply } from '../ai/conversation-partner';
import { useConversation } from '../ai/useConversation';

const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(mockPath: string) {
      this.mockUri = mockPath;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDeleted.push(this.mockUri);
    }
  },
}));
jest.mock('expo-audio', () => ({ requestRecordingPermissionsAsync: jest.fn(), setAudioModeAsync: jest.fn(async () => undefined) }));
jest.mock('../../services/ai/speech-take', () => ({
  isSpeechTakeRecording: jest.fn(() => false),
  startSpeechTake: jest.fn(async () => undefined),
  stopSpeechTake: jest.fn(),
  discardSpeechTake: jest.fn(async () => undefined),
}));
jest.mock('../../services/ai/pcm-recorder', () => ({ deleteTake: (uri: string) => mockDeleted.push(uri) }));
jest.mock('../../services/ai/stt', () => ({ transcribe: jest.fn() }));
jest.mock('../audio/audio-controller', () => ({ play: jest.fn(async () => undefined), stop: jest.fn(async () => undefined) }));
jest.mock('../ai/conversation-partner', () => ({ partnerReply: jest.fn() }));

const task: ConversationTask = { taskType: 'interaction', level: 'A2', promptFr: 'Vous appelez le club de sport.' };
const models = { llm: { id: 'llm' } as ModelEntry };
const reply = partnerReply as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('useConversation', () => {
  it('opens with the partner’s first line, read aloud', async () => {
    const { result } = await renderHook(() => useConversation(task, models));
    expect(result.current.turns).toEqual([{ role: 'partner', text: 'Bonjour !' }]);
    expect(play).toHaveBeenCalledWith('ai-partner-0', expect.stringMatching(/^Bonjour/));
  });

  it('answers a typed turn with a checked model reply and reads it aloud', async () => {
    reply.mockResolvedValue('Bien sûr. Le club ouvre à 7 h.');
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.say('Quels sont les horaires ?'));
    expect(reply).toHaveBeenCalledWith(models.llm, task, expect.arrayContaining([{ role: 'learner', text: 'Quels sont les horaires ?' }]), expect.any(Object), expect.any(Function));
    expect(result.current.turns.at(-1)).toEqual({ role: 'partner', text: 'Bien sûr. Le club ouvre à 7 h.' });
    expect(play).toHaveBeenLastCalledWith('ai-partner-2', 'Bien sûr. Le club ouvre à 7 h.');
    expect(result.current.phase).toBe('ready');
  });

  it('hears the learner live, keeping no audio, then replies', async () => {
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (stopSpeechTake as jest.Mock).mockResolvedValue({ uri: null, durationMs: 2000, transcript: 'Je voudrais m’inscrire.' });
    reply.mockResolvedValue('Très bien. Quel sport ?');
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.startTalking());
    expect(startSpeechTake).toHaveBeenCalledWith({ keepAudio: false });
    expect(result.current.phase).toBe('recording');
    await act(async () => result.current.stopTalking());
    expect(transcribe).not.toHaveBeenCalled();
    expect(result.current.turns.map((t) => t.text)).toContain('Je voudrais m’inscrire.');
    expect(result.current.turns.at(-1)?.text).toBe('Très bien. Quel sport ?');
  });

  it('falls back to transcribing a cache file, then deletes it', async () => {
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (stopSpeechTake as jest.Mock).mockResolvedValue({ uri: 'file:///cache/speech-1.wav', durationMs: 2000, transcript: null });
    (transcribe as jest.Mock).mockResolvedValue('Je voudrais m’inscrire.');
    reply.mockResolvedValue('Très bien. Quel sport ?');
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.startTalking());
    await act(async () => result.current.stopTalking());
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///cache/speech-1.wav' }));
    expect(mockDeleted).toEqual(['file:///cache/speech-1.wav']);
    expect(result.current.turns.map((t) => t.text)).toContain('Je voudrais m’inscrire.');
    expect(result.current.turns.at(-1)?.text).toBe('Très bien. Quel sport ?');
  });

  it('lets the learner type when the microphone is refused, and says when nothing was heard', async () => {
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.startTalking());
    expect(result.current.micAllowed).toBe(false);
    expect(startSpeechTake).not.toHaveBeenCalled();
    await act(async () => result.current.say('   '));
    expect(result.current.heardNothing).toBe(true);
    expect(result.current.turns).toHaveLength(1);
  });

  it('answers unsafe input with a fixed line, without the model', async () => {
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.say('Tu es un connard.'));
    expect(reply).not.toHaveBeenCalled();
    expect(result.current.turns.at(-1)).toEqual({ role: 'partner', text: REDIRECT_LINE });
  });

  it('ends with a closing line after the last turn', async () => {
    reply.mockResolvedValue('D’accord.');
    const { result } = await renderHook(() => useConversation(task, models));
    for (let i = 0; i < MAX_LEARNER_TURNS; i += 1) {
      await act(async () => result.current.say(`Question ${i} ?`));
    }
    expect(result.current.phase).toBe('ended');
    expect(result.current.turns.at(-1)).toEqual({ role: 'partner', text: CLOSING_LINE });
  });

  it('reports a failed reply and stays ready for another try', async () => {
    reply.mockRejectedValue(new AiError('rejected', 'English'));
    const { result } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.say('Bonjour !'));
    expect(result.current.failure).toBe('rejected');
    expect(result.current.phase).toBe('ready');
  });

  it('discards a take, without writing it, when the screen closes mid-recording', async () => {
    (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    const { result, unmount } = await renderHook(() => useConversation(task, models));
    await act(async () => result.current.startTalking());
    (isSpeechTakeRecording as jest.Mock).mockReturnValueOnce(true);
    await unmount();
    expect(discardSpeechTake).toHaveBeenCalled();
    expect(stopSpeechTake).not.toHaveBeenCalled();
  });

  it('turns the microphone back off if the screen closed while it was starting', async () => {
    let grant: (v: { granted: boolean }) => void = () => undefined;
    (requestRecordingPermissionsAsync as jest.Mock).mockImplementationOnce(() => new Promise((r) => (grant = r)));
    const { result, unmount } = await renderHook(() => useConversation(task, models));
    let starting: Promise<void> = Promise.resolve();
    await act(async () => {
      starting = result.current.startTalking();
    });
    await unmount();
    grant({ granted: true });
    await starting;
    expect(startSpeechTake).not.toHaveBeenCalled();
  });
});
