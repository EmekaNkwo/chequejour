import { addDays } from '../dates';
import { levelOrder, planDailyItems, staleDays, type DailyAssignment } from '../daily-items';
import type { Level } from '../content-types';
import { DEFAULT_NOTIFICATION_SETTINGS, horizonDays, planNotifications } from '../notification-plan';
import { rescheduleMistake, skillStats, weakestGrammar, weeklySummary, type AttemptRecord } from '../weekly';
import { definiteArticle, headword } from '../audio-keys';

const sentences = Array.from({ length: 380 }, (_, i) => `s${String(i + 1).padStart(3, '0')}`);
const words = Array.from({ length: 50 }, (_, i) => `w${i}`);

describe('daily items', () => {
  it('never repeats a sentence within a year', () => {
    const days = Array.from({ length: 366 }, (_, i) => addDays('2026-01-01', i));
    const plan = planDailyItems({ days, existing: new Map(), wordPool: words, allWords: words, allSentences: sentences });
    expect(new Set(plan.map((a) => a.sentenceId)).size).toBe(366);
  });
  it('keeps existing assignments and continues without repeats', () => {
    const first = planDailyItems({ days: horizonDays('2026-10-25', 3), existing: new Map(), wordPool: words.slice(0, 10), allWords: words, allSentences: sentences });
    const existing = new Map<string, DailyAssignment>(first.map((a) => [a.day, a]));
    const next = planDailyItems({ days: horizonDays('2026-10-25', 5), existing, wordPool: words.slice(0, 10), allWords: words, allSentences: sentences });
    expect(next.slice(0, 3)).toEqual(first);
    expect(new Set(next.map((a) => a.wordId)).size).toBe(5);
    expect(new Set(next.map((a) => a.sentenceId)).size).toBe(5);
  });
  it('takes words from the unlocked pool first, then the rest of the course', () => {
    const plan = planDailyItems({ days: horizonDays('2026-10-25', 4), existing: new Map(), wordPool: ['w7', 'w8'], allWords: words, allSentences: sentences });
    expect(plan.map((a) => a.wordId)).toEqual(['w7', 'w8', 'w0', 'w1']);
  });
  describe('at the learner\'s level', () => {
    const levels = new Map<string, Level>([
      ['wA', 'A2'], ['wA2', 'A2'], ['wP', 'A2+'], ['wB', 'B1'],
      ['sA', 'A2'], ['sP', 'A2+'], ['sP2', 'A2+'], ['sB', 'B1'],
    ]);
    const base = { existing: new Map(), allWords: ['wA', 'wA2', 'wP', 'wB'], allSentences: ['sA', 'sB', 'sP', 'sP2'], levels };

    it('picks words and sentences from the current level first', () => {
      const plan = planDailyItems({ ...base, days: horizonDays('2026-10-25', 2), wordPool: ['wA', 'wA2', 'wP'], level: 'A2+' });
      expect(plan.map((a) => a.wordId)).toEqual(['wP', 'wA']);
      expect(plan.map((a) => a.sentenceId)).toEqual(['sP', 'sP2']);
    });

    it('once the level is used up, goes to easier items before harder ones', () => {
      const plan = planDailyItems({ ...base, days: horizonDays('2026-10-25', 4), wordPool: [], level: 'A2+' });
      expect(plan.map((a) => a.sentenceId)).toEqual(['sP', 'sP2', 'sA', 'sB']);
    });

    it('keeps unlocked words ahead of others at the same level', () => {
      const plan = planDailyItems({ ...base, days: horizonDays('2026-10-25', 2), wordPool: ['wA2'], level: 'A2' });
      expect(plan.map((a) => a.wordId)).toEqual(['wA2', 'wA']);
    });

    it('orders ids by closeness to a level, keeping the original order within a level', () => {
      expect(levelOrder(['wB', 'wA', 'wP', 'wA2'], levels, 'B1')).toEqual(['wB', 'wP', 'wA', 'wA2']);
      expect(levelOrder(['wB', 'wA', 'wP'], levels, 'A2')).toEqual(['wA', 'wP', 'wB']);
    });

    it('finds future unopened days whose items are off-level, never today or opened days', () => {
      const row = (day: string, wordId: string, sentenceId: string, opened = false) =>
        [day, { day, wordId, sentenceId, wordOpened: opened, sentenceOpened: false }] as const;
      const existing = new Map([
        row('2026-10-25', 'wA', 'sA'),
        row('2026-10-26', 'wA', 'sP'),
        row('2026-10-27', 'wP', 'sP'),
        row('2026-10-28', 'wA', 'sA', true),
        row('2026-10-29', 'wP', 'sB'),
      ]);
      expect(staleDays(existing, '2026-10-25', levels, 'A2+')).toEqual(['2026-10-26', '2026-10-29']);
    });
  });

  it('starts a new cycle once everything is used', () => {
    const plan = planDailyItems({ days: horizonDays('2026-10-25', 3), existing: new Map(), wordPool: ['a', 'b'], allWords: ['a', 'b'], allSentences: ['s1', 's2'] });
    expect(plan.map((a) => a.wordId)).toEqual(['a', 'b', 'a']);
  });
});

describe('notification plan', () => {
  const assignments = planDailyItems({ days: horizonDays('2026-10-25', 14), existing: new Map(), wordPool: words, allWords: words, allSentences: sentences });
  const texts = {
    word: (id: string) => ({ title: 'Word of the Day', body: id }),
    sentence: (id: string) => ({ title: 'Sentence of the Day', body: id }),
  };
  it('schedules two notifications a day at the chosen times, skipping the past', () => {
    const now = new Date(2026, 9, 25, 12, 0);
    const plan = planNotifications(DEFAULT_NOTIFICATION_SETTINGS, assignments, texts, now);
    expect(plan).toHaveLength(27);
    expect(plan[0].id).toBe('sentence-2026-10-25');
    expect(plan[0].fireAt.getHours()).toBe(18);
    expect(plan[1].fireAt.getHours()).toBe(8);
    expect(plan[0].url).toBe('/daily/sentence?day=2026-10-25');
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
  it('respects toggles and custom times', () => {
    const settings = { word: { enabled: false, time: { hour: 8, minute: 0 } }, sentence: { enabled: true, time: { hour: 7, minute: 30 } } };
    const plan = planNotifications(settings, assignments, texts, new Date(2026, 9, 25, 6, 0));
    expect(plan).toHaveLength(14);
    expect(plan.every((p) => p.kind === 'sentence' && p.fireAt.getMinutes() === 30)).toBe(true);
  });
  it('carries each day\'s own item so content rotates', () => {
    const plan = planNotifications(DEFAULT_NOTIFICATION_SETTINGS, assignments, texts, new Date(2026, 9, 25, 0, 0));
    const bodies = plan.filter((p) => p.kind === 'word').map((p) => p.body);
    expect(new Set(bodies).size).toBe(14);
  });
  it('after a time-zone change the same local times are produced', () => {
    const plan = planNotifications(DEFAULT_NOTIFICATION_SETTINGS, assignments, texts, new Date(2026, 9, 25, 0, 0));
    expect(plan.filter((p) => p.kind === 'word').every((p) => p.fireAt.getHours() === 8)).toBe(true);
  });
});

describe('weekly summary', () => {
  const at = (skill: AttemptRecord['skill'], tag: AttemptRecord['grammarTag'], correct: boolean): AttemptRecord => ({ skill, grammarTag: tag, correct, answeredAt: 0 });
  const attempts = [
    at('structures', 'subjonctif', false),
    at('structures', 'subjonctif', false),
    at('structures', 'subjonctif', true),
    at('structures', 'cod', true),
    at('structures', 'cod', true),
    at('structures', 'cod', false),
    at('structures', 'imparfait', true),
    at('reading', null, true),
    at('structures', 'vocabulary', false),
    at('structures', 'vocabulary', false),
    at('structures', 'vocabulary', false),
  ];
  it('finds the weakest grammar points', () => {
    expect(weakestGrammar(attempts).map((w) => w.tag)).toEqual(['subjonctif', 'cod']);
  });
  it('summarizes the week', () => {
    const s = weeklySummary(attempts, [{ day: 'a', seconds: 600, reviews: 10 }, { day: 'b', seconds: 0, reviews: 0 }], 12);
    expect(s).toMatchObject({ wordsLearned: 12, minutes: 10, reviews: 10, daysStudied: 1 });
    expect(s.accuracy).toBeCloseTo(5 / 11);
    expect(weeklySummary([], [], 0).accuracy).toBeNull();
  });
  it('computes per-skill stats', () => {
    const stats = skillStats(attempts, { listening: 0, reading: 0.5, structures: 0.2, writing: 0, speaking: 0 });
    expect(stats.find((s) => s.skill === 'reading')).toMatchObject({ attempts: 1, accuracy: 1, completion: 0.5 });
    expect(stats.find((s) => s.skill === 'writing')?.accuracy).toBeNull();
  });
  it('reschedules mistakes and clears them after three correct spaced retries', () => {
    const one = rescheduleMistake({ correctStreak: 0 }, true, 0);
    expect(one).toMatchObject({ correctStreak: 1, resolved: false, nextReviewAt: 3 * 86_400_000 });
    const two = rescheduleMistake(one, true, 0);
    expect(two).toMatchObject({ correctStreak: 2, resolved: false, nextReviewAt: 7 * 86_400_000 });
    expect(rescheduleMistake(two, true, 0).resolved).toBe(true);
    expect(rescheduleMistake(one, false, 0)).toMatchObject({ correctStreak: 0, nextReviewAt: 86_400_000 });
  });
});

describe('headwords', () => {
  it('adds the right article', () => {
    expect(headword({ fr: 'loyer', pos: 'noun', gender: 'm' })).toBe('le loyer');
    expect(headword({ fr: 'clé', pos: 'noun', gender: 'f' })).toBe('la clé');
    expect(headword({ fr: 'immeuble', pos: 'noun', gender: 'm' })).toBe("l'immeuble");
    expect(headword({ fr: 'heure', pos: 'noun', gender: 'f' })).toBe("l'heure");
    expect(headword({ fr: 'hasard', pos: 'noun', gender: 'm' })).toBe('le hasard');
    expect(headword({ fr: 'collègue', pos: 'noun', gender: 'mf' })).toBe('le / la collègue');
    expect(headword({ fr: 'partir', pos: 'verb' })).toBe('partir');
    expect(headword({ fr: 'vacances', pos: 'noun', gender: 'f', pluralOnly: true })).toBe('les vacances');
    expect(definiteArticle('haricot', 'm')).toBe('le');
  });
});
