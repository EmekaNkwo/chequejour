/**
 * A spoken (or typed) conversation with the AI partner. The learner's speech is recognised
 * on the phone as they speak; the audio is not kept. (If live recognition can't start, it
 * goes to a cache file that is transcribed and deleted.)
 * Partner lines are read aloud with the phone's French voice.
 */
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { nextStep, openingLine, type ConversationTask, type Turn } from '../../domain/ai/conversation';
import { AiError, aiFailureOf, type AiFailure } from '../../domain/ai/errors';
import type { ModelEntry } from '../../domain/ai/manifest';
import { deleteTake } from '../../services/ai/pcm-recorder';
import { discardSpeechTake, isSpeechTakeRecording, startSpeechTake, stopSpeechTake } from '../../services/ai/speech-take';
import { transcribe } from '../../services/ai/stt';
import { logError } from '../app/log';
import { play, stop as stopAudio } from '../audio/audio-controller';
import { partnerReply } from './conversation-partner';

export type ConversationPhase = 'ready' | 'recording' | 'transcribing' | 'replying' | 'ended';

export interface Conversation {
  turns: readonly Turn[];
  phase: ConversationPhase;
  /** The partner's reply as it is being written. */
  partial: string;
  /** Why the last step failed, if it did; the learner can simply try again. */
  failure: AiFailure | null;
  /** The last take had no recognisable speech. */
  heardNothing: boolean;
  /** False when the microphone was refused; typing still works. */
  micAllowed: boolean | null;
  startTalking: () => Promise<void>;
  stopTalking: () => Promise<void>;
  say: (text: string) => void;
  /** Reads a partner line aloud again. */
  replay: (index: number) => void;
}

export interface ConversationModels {
  llm: ModelEntry;
}

const idleAudio = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

export function useConversation(task: ConversationTask, models: ConversationModels): Conversation {
  const [turns, setTurns] = useState<Turn[]>(() => [{ role: 'partner', text: openingLine(task) }]);
  const [phase, setPhase] = useState<ConversationPhase>('ready');
  const [partial, setPartial] = useState('');
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [heardNothing, setHeardNothing] = useState(false);
  const turnsRef = useRef(turns);
  const starting = useRef(false);
  const controller = useRef(new AbortController());

  const speak = useCallback((index: number, text: string) => {
    play(`ai-partner-${index}`, text).catch((e: unknown) => logError('speak partner line', e));
  }, []);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    speak(0, turnsRef.current[0].text);
    return () => {
      current.abort();
      void stopAudio();
      // Leaving mid-take: stop without writing anything, so no audio is left behind.
      if (isSpeechTakeRecording()) discardSpeechTake().catch((e: unknown) => logError('stop conversation recording', e));
      idleAudio().catch((e: unknown) => logError('audio mode on leave', e));
    };
  }, [speak]);

  const append = useCallback((turn: Turn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    return turnsRef.current.length - 1;
  }, []);

  const say = useCallback(
    (raw: string) => {
      const text = raw.trim();
      setHeardNothing(text.length === 0);
      if (text.length === 0) {
        setPhase('ready');
        return;
      }
      const before = turnsRef.current;
      append({ role: 'learner', text });
      setFailure(null);
      const step = nextStep(before, text);
      if (step.kind !== 'ask') {
        speak(append({ role: 'partner', text: step.text }), step.text);
        setPhase(step.kind === 'end' ? 'ended' : 'ready');
        return;
      }
      setPhase('replying');
      setPartial('');
      const signal = controller.current.signal;
      partnerReply(models.llm, task, turnsRef.current, signal, (soFar) => !signal.aborted && setPartial(soFar))
        .then((reply) => {
          if (signal.aborted) return;
          speak(append({ role: 'partner', text: reply }), reply);
          setPhase('ready');
        })
        .catch((e: unknown) => {
          if (signal.aborted) return;
          logError('conversation reply', e);
          setFailure(aiFailureOf(e));
          setPhase('ready');
        })
        .finally(() => setPartial(''));
    },
    [append, models.llm, speak, task],
  );

  const startTalking = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    const signal = controller.current.signal;
    try {
      const permission = await requestRecordingPermissionsAsync();
      setMicAllowed(permission.granted);
      if (!permission.granted || signal.aborted) return;
      await stopAudio();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (signal.aborted) return;
      await startSpeechTake({ keepAudio: false });
      // The screen may have closed while the microphone was starting.
      if (signal.aborted) {
        await discardSpeechTake();
        return;
      }
      setFailure(null);
      setPhase('recording');
    } catch (e: unknown) {
      logError('start conversation recording', e);
      if (signal.aborted) return;
      setFailure('failed');
      setPhase('ready');
    } finally {
      starting.current = false;
    }
  }, []);

  const stopTalking = useCallback(async () => {
    setPhase('transcribing');
    const signal = controller.current.signal;
    let uri: string | null = null;
    try {
      const take = await stopSpeechTake();
      await idleAudio().catch((e: unknown) => logError('audio mode', e));
      if (!take) {
        setPhase('ready');
        return;
      }
      uri = take.uri;
      if (take.transcript === null && !take.uri) throw new AiError('failed', 'Speech recognition stopped and no audio was kept.');
      const text = take.transcript ?? (await transcribe({ uri: take.uri ?? '', durationMs: take.durationMs, signal }));
      if (!signal.aborted) say(text);
    } catch (e: unknown) {
      if (signal.aborted) return;
      logError('transcribe conversation turn', e);
      setFailure(aiFailureOf(e));
      setPhase('ready');
    } finally {
      if (uri) deleteTake(uri);
    }
  }, [say]);

  const replay = useCallback((index: number) => speak(index, turnsRef.current[index]?.text ?? ''), [speak]);

  return { turns, phase, partial, failure, heardNothing, micAllowed, startTalking, stopTalking, say, replay };
}
