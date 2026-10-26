/**
 * Lookup for listening, reading, writing and speaking items. Unit items live in the
 * content tables; mock-test items live inside their mock test.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ListeningItem, MockTest, ReadingItem, SpeakingTask, WritingTask } from '../../domain/content-types';

/** "u03-li01" → "u03"; mock-test items ("mk1-li01") have no unit. */
export function unitIdOf(itemId: string): string | null {
  const prefix = itemId.split('-')[0] ?? '';
  return /^u\d+$/.test(prefix) ? prefix : null;
}

async function mocks(content: ContentRepository, mockId?: string): Promise<MockTest[]> {
  if (mockId) {
    const mock = await content.item('mock', mockId);
    return mock ? [mock] : [];
  }
  return content.listKind('mock');
}

export async function findListening(content: ContentRepository, id: string): Promise<ListeningItem | null> {
  const direct = await content.item('listening', id);
  if (direct) return direct;
  for (const mock of await mocks(content)) {
    const found = mock.listening.find((l) => l.id === id);
    if (found) return found;
  }
  return null;
}

export async function findReading(content: ContentRepository, id: string): Promise<ReadingItem | null> {
  const direct = await content.item('reading', id);
  if (direct) return direct;
  for (const mock of await mocks(content)) {
    const found = mock.reading.find((r) => r.id === id);
    if (found) return found;
  }
  return null;
}

export async function findWriting(content: ContentRepository, id: string, mockId?: string): Promise<WritingTask | null> {
  const direct = await content.item('writing', id);
  if (direct) return direct;
  for (const mock of await mocks(content, mockId)) {
    const found = mock.writing.find((w) => w.id === id);
    if (found) return found;
  }
  return null;
}

export async function findSpeaking(content: ContentRepository, id: string, mockId?: string): Promise<SpeakingTask | null> {
  const direct = await content.item('speaking', id);
  if (direct) return direct;
  for (const mock of await mocks(content, mockId)) {
    const found = mock.speaking.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
}

export { countWords } from '../../domain/writing/word-count';

/** "1:05" from seconds. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
