/**
 * @jest-environment node
 */
import { saveSetting } from '../../data/settings-repo';
import { setupRealContent } from '../../test-utils/real-content';
import { ensureDailyItems } from '../daily/daily-service';
import { learnerFor } from '../daily/daily-learner';
import { genderLabel, loadWidgetWord, widgetWordView } from '../widget/widget-data';

describe('word of the day widget data', () => {
  it('shows the same word the app assigned for today, with a link to it', async () => {
    const app = await setupRealContent();
    const learner = await learnerFor(app.content, app.progress, 'A2');
    const [today] = await ensureDailyItems(app.content, app.progress, '2026-10-26', learner);
    const view = await loadWidgetWord(app.db, '2026-10-26');
    const word = await app.content.item('word', today.wordId);
    expect(view).toMatchObject({ en: word!.en, url: 'chequejour://daily/word?day=2026-10-26' });
    expect(view!.fr).toContain(word!.fr);
  });

  it('assigns today from local data when the app has not been opened today', async () => {
    const app = await setupRealContent();
    await saveSetting(app.db, 'placementLevel', 'B1');
    const view = await loadWidgetWord(app.db, '2026-10-27');
    expect(view?.url).toBe('chequejour://daily/word?day=2026-10-27');
    expect((await app.progress.dailyItems()).has('2026-10-27')).toBe(true);
  });

  it('returns null before the app has set up its database', async () => {
    const { createNodeDb } = jest.requireActual('../../test-utils/node-db');
    expect(await loadWidgetWord(createNodeDb(), '2026-10-26')).toBeNull();
  });

  it('labels gender for nouns and the part of speech otherwise', () => {
    expect(genderLabel({ pos: 'noun', gender: 'm' })).toBe('masculine');
    expect(genderLabel({ pos: 'noun', gender: 'f' })).toBe('feminine');
    expect(genderLabel({ pos: 'noun', gender: 'mf' })).toBe('masculine or feminine');
    expect(genderLabel({ pos: 'verb' })).toBe('verb');
    const view = widgetWordView({ id: 'x', fr: 'réveil', en: 'alarm clock', pos: 'noun', gender: 'm', level: 'A2', core: true, example: { fr: 'a', en: 'b' } }, '2026-10-26');
    expect(view).toEqual({ fr: 'le réveil', detail: 'masculine', en: 'alarm clock', url: 'chequejour://daily/word?day=2026-10-26' });
  });
});
