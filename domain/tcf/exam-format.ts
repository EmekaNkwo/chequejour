/**
 * TCF Canada format: four compulsory tests. Counts, timings and word ranges live here
 * as configuration so they can be updated if the exam changes; content validation and
 * the mock test screens both read them.
 *
 * Language structures is part of the general TCF, not TCF Canada, so it is not here.
 */
import type { SpeakingTask, WritingTask } from '../content-types';

export type TcfSkill = 'listening' | 'reading' | 'writing' | 'speaking';

export const TCF_SKILLS: readonly TcfSkill[] = ['listening', 'reading', 'writing', 'speaking'];

export type TaskNumber = 1 | 2 | 3;

export interface ComprehensionFormat {
  titleFr: string;
  title: string;
  questions: number;
  minutes: number;
}

export interface WritingTaskFormat {
  task: TaskNumber;
  taskType: WritingTask['taskType'];
  minWords: number;
  maxWords: number;
  summary: string;
}

export interface SpeakingTaskFormat {
  task: TaskNumber;
  taskType: SpeakingTask['taskType'];
  prepSeconds: number;
  speakSeconds: number;
  summary: string;
}

export interface TcfFormat {
  listening: ComprehensionFormat & { replay: false };
  reading: ComprehensionFormat;
  writing: { titleFr: string; title: string; minutes: number; tasks: readonly WritingTaskFormat[] };
  speaking: { titleFr: string; title: string; tasks: readonly SpeakingTaskFormat[] };
}

export const TCF_CANADA: TcfFormat = {
  listening: { titleFr: 'Compréhension orale', title: 'Listening', questions: 39, minutes: 35, replay: false },
  reading: { titleFr: 'Compréhension écrite', title: 'Reading', questions: 39, minutes: 60 },
  writing: {
    titleFr: 'Expression écrite',
    title: 'Writing',
    minutes: 60,
    tasks: [
      { task: 1, taskType: 'message', minWords: 60, maxWords: 120, summary: 'A short message, e.g. to a friend or a neighbour' },
      { task: 2, taskType: 'description', minWords: 120, maxWords: 150, summary: 'An account of an experience or event, e.g. a blog post' },
      { task: 3, taskType: 'opinion', minWords: 120, maxWords: 180, summary: 'Compare two documents with opposing views, then give your opinion' },
    ],
  },
  speaking: {
    titleFr: 'Expression orale',
    title: 'Speaking',
    tasks: [
      { task: 1, taskType: 'entretien', prepSeconds: 0, speakSeconds: 120, summary: 'Guided interview about yourself, no preparation' },
      { task: 2, taskType: 'interaction', prepSeconds: 120, speakSeconds: 210, summary: 'Ask the examiner questions to get information' },
      { task: 3, taskType: 'opinion', prepSeconds: 0, speakSeconds: 270, summary: 'Give and justify an opinion on a topic' },
    ],
  },
};

export function writingTaskFormat(taskType: WritingTask['taskType'], format: TcfFormat = TCF_CANADA): WritingTaskFormat {
  const found = format.writing.tasks.find((t) => t.taskType === taskType);
  if (!found) throw new Error(`No writing task format for ${taskType}`);
  return found;
}

export function speakingTaskFormat(taskType: SpeakingTask['taskType'], format: TcfFormat = TCF_CANADA): SpeakingTaskFormat {
  const found = format.speaking.tasks.find((t) => t.taskType === taskType);
  if (!found) throw new Error(`No speaking task format for ${taskType}`);
  return found;
}

/** Minutes of a test as taken in the mock. */
/**
 * Time for one writing task practised on its own: the test's 60 minutes shared in
 * proportion to each task's maximum length (about 16, 20 and 24 minutes).
 */
export function writingTaskMinutes(taskType: WritingTask['taskType'], format: TcfFormat = TCF_CANADA): number {
  const total = format.writing.tasks.reduce((n, t) => n + t.maxWords, 0);
  return Math.round((format.writing.minutes * writingTaskFormat(taskType, format).maxWords) / total);
}

export function testMinutes(skill: TcfSkill, format: TcfFormat = TCF_CANADA): number {
  switch (skill) {
    case 'listening':
      return format.listening.minutes;
    case 'reading':
      return format.reading.minutes;
    case 'writing':
      return format.writing.minutes;
    case 'speaking':
      return Math.round(format.speaking.tasks.reduce((n, t) => n + t.prepSeconds + t.speakSeconds, 0) / 60);
  }
}
