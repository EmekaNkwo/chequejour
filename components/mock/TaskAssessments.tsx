/**
 * Self-assessment pages for writing and speaking tasks, shared by the mock test and the
 * final-stretch exam practice. Scores are null for a task with nothing written or recorded.
 */
import type { SpeakingTask, WritingTask } from '../../domain/content-types';
import { audioKey } from '../../domain/audio-keys';
import { TCF_CANADA } from '../../domain/tcf/exam-format';
import { SPEAKING_CRITERIA } from '../../domain/tcf/self-check';
import { useRecordingPlayer } from '../../features/speaking/useRecorder';
import { PlayButton } from '../audio/AudioControls';
import { AppText } from '../ui/AppText';
import { LinkText } from '../ui/Bits';
import { TextHints } from '../writing/WritingFeedback';
import { SelfAssessment } from './SelfAssessment';

export interface WritingAssessmentProps {
  tasks: readonly WritingTask[];
  texts: readonly string[];
  onDone: (scores: (number | null)[]) => void;
}

export function WritingAssessment({ tasks, texts, onDone }: WritingAssessmentProps) {
  return (
    <SelfAssessment
      title={TCF_CANADA.writing.titleFr}
      tasks={tasks.map((task, i) => ({
        key: task.id,
        title: task.title,
        yours: (
          <>
            <AppText variant="body" french>
              {texts[i] || 'No text written.'}
            </AppText>
            <TextHints text={texts[i] ?? ''} taskType={task.taskType} />
          </>
        ),
        model: (
          <AppText variant="body" french>
            {task.modelAnswer}
          </AppText>
        ),
        criteria: task.checklist,
      }))}
      onDone={(scores) => onDone(texts.map((t, i) => (t.trim() ? (scores[i] ?? 0) : null)))}
    />
  );
}

export interface SpeakingAssessmentProps {
  tasks: readonly SpeakingTask[];
  recordings: readonly (string | null)[];
  onDone: (scores: (number | null)[]) => void;
}

export function SpeakingAssessment({ tasks, recordings, onDone }: SpeakingAssessmentProps) {
  const player = useRecordingPlayer();
  return (
    <SelfAssessment
      title={TCF_CANADA.speaking.titleFr}
      tasks={tasks.map((task, i) => {
        const file = recordings[i];
        return {
          key: task.id,
          title: task.title,
          yours: file ? (
            <LinkText
              label={player.playingKey === task.id ? 'Pause my recording' : 'Play my recording'}
              icon={player.playingKey === task.id ? 'pause' : 'play'}
              onPress={() => player.toggle(task.id, file)}
            />
          ) : (
            <AppText variant="meta" tone="muted">
              Nothing was recorded for this task.
            </AppText>
          ),
          model: (
            <>
              <AppText variant="body" french>
                {task.modelAnswer}
              </AppText>
              <PlayButton audioKey={audioKey.model(task.id)} text={task.modelAnswer} size={44} label="Play the model answer" />
            </>
          ),
          criteria: SPEAKING_CRITERIA[task.taskType],
        };
      })}
      onDone={(scores) => {
        player.stop();
        onDone(scores);
      }}
    />
  );
}
