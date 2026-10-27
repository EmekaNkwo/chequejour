/**
 * @jest-environment node
 */
import { setupRealContent } from '../../test-utils/real-content';
import { dictationSet } from '../practice/dictation-practice';

describe('dictation practice', () => {
  it('picks dictations only from open units, the same set for the same seed', async () => {
    const app = await setupRealContent();
    const a2 = await dictationSet(app.content, app.progress, 'A2', 'day');
    expect(a2.length).toBeGreaterThan(0);
    expect(a2.every((e) => e.type === 'dictation')).toBe(true);
    expect(await dictationSet(app.content, app.progress, 'A2', 'day')).toEqual(a2);
    const b1 = await dictationSet(app.content, app.progress, 'B1', 'day', 50);
    expect(b1.length).toBeGreaterThan(a2.length);
    const a2All = await dictationSet(app.content, app.progress, 'A2', 'day', 50);
    expect(a2All.every((e) => e.id.startsWith('a0') || e.id.startsWith('u01-'))).toBe(true);
  });
});
