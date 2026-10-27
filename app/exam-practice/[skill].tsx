/**
 * Final-stretch exam practice, timed as in the exam:
 * - listening/reading: a short mock-style set taken from the mock tests, a different
 *   slice each time;
 * - writing/speaking (`?task=<mock task id>`): one task with its exam clock, then
 *   self-assessment against the model answer.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ComprehensionTest } from '../../components/mock/ComprehensionTest';
import { MockResults } from '../../components/mock/MockResults';
import { SpeakingTest } from '../../components/mock/SpeakingTest';
import { SpeakingAssessment, WritingAssessment } from '../../components/mock/TaskAssessments';
import { WritingTest } from '../../components/mock/WritingTest';
import { ErrorState, Loading } from '../../components/ui/Screen';
import { useToast } from '../../components/ui/Toast';
import type { MockTest, SpeakingTask, WritingTask } from '../../domain/content-types';
import { TCF_CANADA, writingTaskMinutes, type TcfSkill } from '../../domain/tcf/exam-format';
import { reviewItems, scoreComprehension, scoreTasks, type ReviewItem } from '../../domain/tcf/mock-scoring';
import { useApp } from '../../features/app/AppContext';
import { logError } from '../../features/app/log';
import { useLoad } from '../../features/app/useLoad';
import { loadMocks, practiceMinutes, practiceRunId, practiceSet, saveMockRun } from '../../features/mock/mock-service';

const ROUND_KEY = (skill: string) => `exam-practice-round:${skill}`;

function parseSkill(raw: string | undefined): TcfSkill | null {
  return raw === 'listening' || raw === 'reading' || raw === 'writing' || raw === 'speaking' ? raw : null;
}

function useLeave(): () => void {
  const toast = useToast();
  return () => {
    toast
      .confirm({ title: 'Stop this practice?', message: 'It won’t count for today.', confirmLabel: 'Stop', cancelLabel: 'Keep going', destructive: true })
      .then((ok) => {
        if (!ok) return;
        if (router.canGoBack()) router.back();
        else router.replace('/');
      })
      .catch((e: unknown) => logError('leave exam practice', e));
  };
}

export default function ExamPracticeScreen() {
  const { skill: raw, task } = useLocalSearchParams<{ skill: string; task?: string }>();
  const skill = parseSkill(raw);
  if (!skill) return <ErrorState message="This practice set couldn't be found." />;
  if (skill === 'listening' || skill === 'reading') return <ComprehensionPractice skill={skill} />;
  if (!task) return <ErrorState message="This practice task couldn't be found." />;
  return <TaskPractice skill={skill} taskId={task} />;
}

function ComprehensionPractice({ skill }: { skill: 'listening' | 'reading' }) {
  const { content, progress, invalidate } = useApp();
  const leave = useLeave();
  const [result, setResult] = useState<{ score: number; review: ReviewItem[] } | null>(null);
  const { data, error, reload } = useLoad(
    `exam practice ${skill}`,
    async () => {
      const round = Number((await progress.meta(ROUND_KEY(skill))) ?? '0') || 0;
      return { round, items: practiceSet(await loadMocks(content), skill, round) };
    },
    [skill],
  );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (data.items.length === 0) return <ErrorState message="No mock questions are available for this practice." />;
  if (result) return <MockResults title={`Exam practice · ${TCF_CANADA[skill].title}`} scores={{ [skill]: result.score }} review={{ [skill]: result.review }} />;

  const questions = data.items.flatMap((i) => i.questions);
  return (
    <ComprehensionTest
      skill={skill}
      title={`Exam practice · ${TCF_CANADA[skill].titleFr}`}
      items={data.items}
      minutes={practiceMinutes(skill, questions.length)}
      onQuit={leave}
      onFinish={(answers) => {
        const score = scoreComprehension(questions, answers).score;
        setResult({ score, review: reviewItems(questions, answers) });
        Promise.all([saveMockRun(progress, practiceRunId(skill), { [skill]: score }, Date.now()), progress.setMeta(ROUND_KEY(skill), String(data.round + 1))])
          .then(invalidate)
          .catch((e: unknown) => logError('save exam practice', e));
      }}
    />
  );
}

function findTask(mocks: readonly MockTest[], skill: 'writing' | 'speaking', id: string): WritingTask | SpeakingTask | null {
  for (const m of mocks) {
    const found = skill === 'writing' ? m.writing.find((t) => t.id === id) : m.speaking.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}

type TaskStage = { kind: 'task' } | { kind: 'assess'; texts: string[]; recordings: (string | null)[] } | { kind: 'results'; score: number };

function TaskPractice({ skill, taskId }: { skill: 'writing' | 'speaking'; taskId: string }) {
  const { content, progress, invalidate } = useApp();
  const leave = useLeave();
  const [stage, setStage] = useState<TaskStage>({ kind: 'task' });
  const { data, error, reload } = useLoad(`exam task ${taskId}`, async () => ({ task: findTask(await loadMocks(content), skill, taskId) }), [skill, taskId]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const found = data.task;
  if (!found) return <ErrorState message="This practice task couldn't be found." />;

  const title = `Exam practice · ${TCF_CANADA[skill].titleFr}`;
  const finish = (scores: (number | null)[]) => {
    const score = scoreTasks(scores);
    setStage({ kind: 'results', score });
    // Marks the step done for today; the self-assessed score feeds the skill estimate.
    progress
      .completeSkillItem(taskId, skill, null, score, Date.now())
      .then(invalidate)
      .catch((e: unknown) => logError('save exam task', e));
  };

  if (stage.kind === 'results') return <MockResults title={`${title} · ${found.title}`} scores={{ [skill]: stage.score }} review={{}} />;
  if (skill === 'writing') {
    const task = found as WritingTask;
    if (stage.kind === 'assess') return <WritingAssessment tasks={[task]} texts={stage.texts} onDone={finish} />;
    return <WritingTest title={title} tasks={[task]} minutes={writingTaskMinutes(task.taskType)} onQuit={leave} onFinish={(texts) => setStage({ kind: 'assess', texts, recordings: [] })} />;
  }
  const task = found as SpeakingTask;
  if (stage.kind === 'assess') return <SpeakingAssessment tasks={[task]} recordings={stage.recordings} onDone={finish} />;
  return <SpeakingTest title={title} tasks={[task]} onQuit={leave} onFinish={(recordings) => setStage({ kind: 'assess', texts: [], recordings })} />;
}
