/**
 * @jest-environment node
 */
import { saveSetting } from '../../data/settings-repo';
import { verbOfDay } from '../../domain/verb-of-day';
import { setupRealContent } from '../../test-utils/real-content';
import { ensureDailyItems } from '../daily/daily-service';
import { learnerFor } from '../daily/daily-learner';
import { genderLabel, loadWidgetDaily, widgetVerbView, widgetWordView } from '../widget/widget-data';

describe('daily widget data', () => {
  it('shows the word, sentence and verb the app shows for today, each linking to its screen', async () => {
    const app = await setupRealContent();
    const learner = await learnerFor(app.content, app.progress, 'A2');
    const [today] = await ensureDailyItems(app.content, app.progress, '2026-10-26', learner);
    const items = await loadWidgetDaily(app.db, '2026-10-26');
    const word = await app.content.item('word', today.wordId);
    const sentence = await app.content.item('sentence', today.sentenceId);
    const verb = verbOfDay('2026-10-26', learner.level);

    expect(items.map((i) => i.kind)).toEqual(['word', 'sentence', 'verb']);
    expect(items[0]).toMatchObject({ label: 'MOT DU JOUR', url: 'chequejour://daily/word?day=2026-10-26' });
    expect(items[0].fr).toContain(word!.fr);
    expect(items[1]).toMatchObject({ label: 'PHRASE DU JOUR', fr: sentence!.fr, sub: sentence!.en, url: 'chequejour://daily/sentence?day=2026-10-26', audioKey: sentence!.id });
    expect(items[2]).toMatchObject({ label: 'VERBE DU JOUR', fr: verb.infinitive, url: 'chequejour://daily/verb?day=2026-10-26' });
  });

  it('assigns today from local data when the app has not been opened today', async () => {
    const app = await setupRealContent();
    await saveSetting(app.db, 'placementLevel', 'B1');
    const items = await loadWidgetDaily(app.db, '2026-10-27');
    expect(items[0]?.url).toBe('chequejour://daily/word?day=2026-10-27');
    expect((await app.progress.dailyItems()).has('2026-10-27')).toBe(true);
  });

  it('returns nothing before the app has set up its database', async () => {
    const { createNodeDb } = jest.requireActual('../../test-utils/node-db');
    expect(await loadWidgetDaily(createNodeDb(), '2026-10-26')).toEqual([]);
  });

  it('labels gender for nouns and the part of speech otherwise', () => {
    expect(genderLabel({ pos: 'noun', gender: 'm' })).toBe('masculine');
    expect(genderLabel({ pos: 'noun', gender: 'f' })).toBe('feminine');
    expect(genderLabel({ pos: 'noun', gender: 'mf' })).toBe('masculine or feminine');
    expect(genderLabel({ pos: 'verb' })).toBe('verb');
    const view = widgetWordView({ id: 'x', fr: 'réveil', en: 'alarm clock', pos: 'noun', gender: 'm', level: 'A2', core: true, example: { fr: 'a', en: 'b' } }, '2026-10-26');
    expect(view).toEqual({ kind: 'word', label: 'MOT DU JOUR', fr: 'le réveil', sub: 'masculine · alarm clock', url: 'chequejour://daily/word?day=2026-10-26', audioKey: 'x' });
  });

  it('gives the verb its meaning and two présent forms', () => {
    const view = widgetVerbView(verbOfDay('2026-10-26', 'A1'), '2026-10-26');
    expect(view.sub).toMatch(/^.+ · (je|j')\S* .+, nous .+$/);
    expect(view.audioKey).toBe(`verb:${view.fr}`);
  });
});
