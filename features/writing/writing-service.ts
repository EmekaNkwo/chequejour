/**
 * Handing in a writing text: the offline hints are computed and the text is kept as a
 * submission, so the learner can look back at how their writing changes.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { WritingTask } from '../../domain/content-types';
import { nounGenderMap, writingHints, type WritingHint } from '../../domain/writing/hints';
import { countWords } from '../../domain/writing/word-count';

export type NounGenders = ReadonlyMap<string, 'm' | 'f'>;

const cache = new WeakMap<ContentRepository, Promise<NounGenders>>();

/** Single-word nouns from the course vocabulary with their gender, loaded once. */
export function loadNounGenders(content: ContentRepository): Promise<NounGenders> {
  const cached = cache.get(content);
  if (cached) return cached;
  const loading = content.listKind('word').then((words): NounGenders => nounGenderMap(words.filter((w) => w.pos === 'noun')));
  cache.set(content, loading);
  return loading;
}

/** Saves the text as a submission (unless empty) and returns its hints. */
export async function submitWriting(
  progress: ProgressRepository,
  genders: NounGenders,
  task: Pick<WritingTask, 'id' | 'taskType'>,
  text: string,
  now: number,
): Promise<WritingHint[]> {
  if (text.trim().length === 0) return [];
  const hints = writingHints(text, { taskType: task.taskType, nounGenders: genders });
  await progress.addSubmission(task.id, text, countWords(text), now, hints.filter((h) => h.tone === 'tip').length);
  return hints;
}
