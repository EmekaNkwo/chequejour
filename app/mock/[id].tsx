import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { ComprehensionTest } from '../../components/mock/ComprehensionTest';
import { MockIntro } from '../../components/mock/MockIntro';
import { MockResults } from '../../components/mock/MockResults';
import { SpeakingAssessment, WritingAssessment } from '../../components/mock/TaskAssessments';
import { SpeakingTest } from '../../components/mock/SpeakingTest';
import { WritingTest } from '../../components/mock/WritingTest';
import { spacing } from '../../components/theme/tokens';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { ErrorState, Loading, Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useToast } from '../../components/ui/Toast';
import type { MockTest } from '../../domain/content-types';
import { TCF_CANADA, type TcfSkill } from '../../domain/tcf/exam-format';
import { reviewItems, scoreComprehension, scoreTasks, type MockRunRecord, type MockSkillScores, type QuestionAnswer, type ReviewItem } from '../../domain/tcf/mock-scoring';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { loadMocks, mockHistory, saveMockRun } from '../../features/mock/mock-service';
import { loadPath } from '../../features/path/path-service';
import { isBeginner } from '../../domain/level';
import { levelOverview } from '../../features/progress/stats-service';
import { masteredIds } from '../../features/session/session-service';

export default function MockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { content, progress, settings } = useApp();
  const { data, error, reload } = useLoad(
    `mock ${id}`,
    async () => {
      const mastered = await masteredIds(progress);
      const path = await loadPath(content, progress, settings.placementLevel, mastered);
      const [mocks, level, history] = await Promise.all([loadMocks(content), levelOverview(progress, path, settings.placementLevel, mastered.size), mockHistory(progress)]);
      const titles = new Map(mocks.map((m) => [m.id, m.title]));
      // With an exam date the learner needs the mocks whatever their level.
      return { mock: mocks.find((m) => m.id === id) ?? null, unlocked: level.mockUnlocked || settings.examDate !== null, beginner: isBeginner(level.estimate.label), history, titles };
    },
    [id, settings.placementLevel, settings.examDate],
  );
  // Once opened, stay open: the test's own answers feed the estimate, so a reload mid-test
  // could otherwise flip it back to locked and discard the run.
  const [wasUnlocked, setWasUnlocked] = useState(false);
  if (data?.unlocked && !wasUnlocked) setWasUnlocked(true);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.mock) return <ErrorState message="This mock test couldn't be found." />;
  if (!data.unlocked && !wasUnlocked) return <Locked title={data.mock.title} />;
  return <MockRun mock={data.mock} history={data.history} titles={data.titles} beginner={data.beginner} />;
}

function Locked({ title }: { title: string }) {
  return (
    <Screen testID="mock-locked">
      <ScreenHeader title={title} back />
      <Card>
        <AppText variant="cardTitle">Not unlocked yet</AppText>
        <AppText variant="body" tone="secondary" style={styles.mt}>
          The mock test opens once your practice estimate gets close to B1, when you have completed every A2 and A2+ unit, or as soon as you set your exam date in Settings.
        </AppText>
      </Card>
    </Screen>
  );
}

type Stage =
  | { kind: 'intro' }
  | { kind: 'test'; index: number }
  | { kind: 'assess-writing'; index: number; texts: string[] }
  | { kind: 'assess-speaking'; index: number; recordings: (string | null)[] }
  | { kind: 'results' };

interface MockRunProps {
  mock: MockTest;
  history: readonly MockRunRecord[];
  titles: ReadonlyMap<string, string>;
  beginner: boolean;
}

function MockRun({ mock, history, titles, beginner }: MockRunProps) {
  const { progress, invalidate } = useApp();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [queue, setQueue] = useState<TcfSkill[]>([]);
  const [scores, setScores] = useState<MockSkillScores>({});
  const [review, setReview] = useState<Partial<Record<'listening' | 'reading', ReviewItem[]>>>({});

  const record = (index: number, skill: TcfSkill, score: number) => {
    const next = { ...scores, [skill]: score };
    setScores(next);
    if (index + 1 < queue.length) {
      setStage({ kind: 'test', index: index + 1 });
      return;
    }
    saveMockRun(progress, mock.id, next, Date.now())
      .then(invalidate)
      .catch((e: unknown) => {
        logError('save mock run', e);
        toast.show({ tone: 'error', title: 'Result not saved', message: 'Your scores are shown below but could not be stored.' });
      });
    setStage({ kind: 'results' });
  };

  const quit = async () => {
    const leave = await toast.confirm({
      title: 'Leave the mock test?',
      message: 'This run will not be scored.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep going',
      destructive: true,
    });
    if (!leave) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (stage.kind === 'intro') {
    return (
      <MockIntro
        mock={mock}
        history={history}
        titles={titles}
        beginner={beginner}
        onStart={(skills) => {
          setQueue(skills);
          setScores({});
          setReview({});
          setStage({ kind: 'test', index: 0 });
        }}
      />
    );
  }
  if (stage.kind === 'results') return <MockResults title={mock.title} scores={scores} review={review} />;
  if (stage.kind === 'assess-writing') {
    return (
      <WritingAssessment
        tasks={mock.writing}
        texts={stage.texts}
        onDone={(taskScores) => record(stage.index, 'writing', scoreTasks(taskScores))}
      />
    );
  }
  if (stage.kind === 'assess-speaking') {
    return <SpeakingAssessment tasks={mock.speaking} recordings={stage.recordings} onDone={(taskScores) => record(stage.index, 'speaking', scoreTasks(taskScores))} />;
  }

  const skill = queue[stage.index];
  const title = `${TCF_CANADA[skill].titleFr} · test ${stage.index + 1} of ${queue.length}`;
  const onQuit = () => void quit();
  switch (skill) {
    case 'listening':
    case 'reading': {
      const items = skill === 'listening' ? mock.listening : mock.reading;
      const questions = items.flatMap((i) => i.questions);
      return (
        <ComprehensionTest
          key={skill}
          skill={skill}
          title={title}
          items={items}
          minutes={TCF_CANADA[skill].minutes}
          onQuit={onQuit}
          onFinish={(answers: QuestionAnswer[]) => {
            setReview((r) => ({ ...r, [skill]: reviewItems(questions, answers) }));
            record(stage.index, skill, scoreComprehension(questions, answers).score);
          }}
        />
      );
    }
    case 'writing':
      return <WritingTest key="writing" title={title} tasks={mock.writing} minutes={TCF_CANADA.writing.minutes} onQuit={onQuit} onFinish={(texts) => setStage({ kind: 'assess-writing', index: stage.index, texts })} />;
    case 'speaking':
      return <SpeakingTest key="speaking" title={title} tasks={mock.speaking} onQuit={onQuit} onFinish={(recordings) => setStage({ kind: 'assess-speaking', index: stage.index, recordings })} />;
  }
}

const styles = StyleSheet.create({
  mt: { marginTop: spacing.sm },
});
