/**
 * Checks that a mock test matches the TCF Canada format in exam-format.ts. Used by
 * content validation; returns readable problems instead of throwing.
 */
import { CEFR_BANDS, type MockTest } from '../content-types';
import { countWords } from '../writing/word-count';
import { TCF_CANADA, type TcfFormat } from './exam-format';

function bandOrderProblems(label: string, bands: readonly string[]): string[] {
  const ranks = bands.map((b) => CEFR_BANDS.indexOf(b as (typeof CEFR_BANDS)[number]));
  const firstDrop = ranks.findIndex((r, i) => i > 0 && r < ranks[i - 1]);
  return firstDrop === -1 ? [] : [`${label} question ${firstDrop + 1} is easier than the one before (difficulty must rise)`];
}

export function mockFormatProblems(mock: MockTest, format: TcfFormat = TCF_CANADA): string[] {
  const problems: string[] = [];
  const listening = mock.listening.flatMap((l) => l.questions);
  const reading = mock.reading.flatMap((r) => r.questions);
  if (listening.length !== format.listening.questions) {
    problems.push(`listening has ${listening.length} questions, the format needs ${format.listening.questions}`);
  }
  if (reading.length !== format.reading.questions) {
    problems.push(`reading has ${reading.length} questions, the format needs ${format.reading.questions}`);
  }
  problems.push(...bandOrderProblems('listening', listening.map((q) => q.band)));
  problems.push(...bandOrderProblems('reading', reading.map((q) => q.band)));

  format.writing.tasks.forEach((f, i) => {
    const task = mock.writing[i];
    if (!task) return problems.push(`writing task ${f.task} is missing`);
    if (task.taskType !== f.taskType) problems.push(`writing task ${f.task} must be "${f.taskType}", not "${task.taskType}"`);
    if (task.minWords !== f.minWords || task.maxWords !== f.maxWords) {
      problems.push(`writing task ${f.task} must ask for ${f.minWords}–${f.maxWords} words`);
    }
    const modelWords = countWords(task.modelAnswer);
    if (modelWords < f.minWords || modelWords > f.maxWords) {
      problems.push(`writing task ${f.task} model answer has ${modelWords} words, outside ${f.minWords}–${f.maxWords}`);
    }
    if (f.taskType === 'opinion' && task.documents?.length !== 2) problems.push(`writing task ${f.task} needs two documents`);
    return undefined;
  });

  format.speaking.tasks.forEach((f, i) => {
    const task = mock.speaking[i];
    if (!task) return problems.push(`speaking task ${f.task} is missing`);
    if (task.taskType !== f.taskType) problems.push(`speaking task ${f.task} must be "${f.taskType}", not "${task.taskType}"`);
    if (task.prepSeconds !== f.prepSeconds || task.speakSeconds !== f.speakSeconds) {
      problems.push(`speaking task ${f.task} must be ${f.prepSeconds}s preparation + ${f.speakSeconds}s speaking`);
    }
    return undefined;
  });
  return problems;
}
