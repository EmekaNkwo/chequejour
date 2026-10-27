import type { Unit } from '../content-types';
import { estimateLevel, labelFor, mockTestUnlocked, placementDecided, placementLevel, PLACEMENT_BANDS } from '../level';
import { buildSession, describeSession, pickSkillTask, skillForDay } from '../session';
import { currentUnitId, nextSegment, PLACEMENT_START_UNIT, placementStartFor, unitSegments, unitStatuses } from '../unit-path';

function makeUnit(id: string, order: number, coreWords = 20, exercises = 20): Unit {
  return {
    id,
    order,
    level: 'A2',
    theme: 't',
    titleFr: 't',
    description: 'd',
    vocab: Array.from({ length: coreWords + 5 }, (_, i) => ({
      id: `${id}-w${i}`,
      fr: `mot${i}`,
      en: 'w',
      pos: 'verb',
      level: 'A2',
      core: i < coreWords,
      example: { fr: 'f', en: 'e' },
    })),
    grammar: [1, 2].map((n) => ({
      id: `${id}-g0${n}`,
      title: `G${n}`,
      level: 'A2',
      grammarTag: 'present',
      explanation: ['x'],
      examples: [],
      commonMistakes: [],
    })),
    exercises: Array.from({ length: exercises }, (_, i) => ({
      id: `${id}-ex${i}`,
      type: 'dictation',
      level: 'A2',
      skill: 'structures',
      grammarTag: 'present',
      explanation: 'e',
      text: 't',
      translation: 't',
    })),
    listening: [],
    reading: [],
    writing: [],
    speaking: [],
    checkpoint: [],
  };
}

describe('unit path', () => {
  const unit = makeUnit('u01', 1);
  it('interleaves words, grammar and practice segments', () => {
    expect(unitSegments(unit).map((s) => s.id)).toEqual([
      'u01:words:1',
      'u01:grammar:1',
      'u01:exercises:1',
      'u01:words:2',
      'u01:grammar:2',
      'u01:exercises:2',
    ]);
    expect(unitSegments(unit)[0].itemIds).toHaveLength(10);
  });
  it('spreads extra exercises over the existing practice sets instead of adding a tiny one', () => {
    const sizes = (n: number) => unitSegments(makeUnit('u09', 9, 20, n)).filter((x) => x.kind === 'exercises').map((x) => x.itemIds.length);
    expect(sizes(20)).toEqual([10, 10]);
    expect(sizes(21)).toEqual([11, 10]);
    expect(sizes(24)).toEqual([12, 12]);
    expect(sizes(26)).toEqual([9, 9, 8]);
    expect(sizes(4)).toEqual([4]);
  });
  it('returns the next incomplete segment', () => {
    expect(nextSegment(unit, new Set(['u01:words:1']))?.id).toBe('u01:grammar:1');
    expect(nextSegment(unit, new Set(unitSegments(unit).map((s) => s.id)))).toBeNull();
  });
  it('unlocks units in order as checkpoints are passed', () => {
    const units = [makeUnit('u01', 1), makeUnit('u02', 2), makeUnit('u03', 3)];
    const progress = new Map([['u01', { unitId: 'u01', checkpointScore: 0.8 }]]);
    const s = unitStatuses(units, progress, 1);
    expect([...s.values()]).toEqual(['completed', 'available', 'locked']);
    expect(currentUnitId(units, s, 1)).toBe('u02');
  });
  it('does not unlock on a failed checkpoint', () => {
    const units = [makeUnit('u01', 1), makeUnit('u02', 2)];
    const s = unitStatuses(units, new Map([['u01', { unitId: 'u01', checkpointScore: 0.5 }]]), 1);
    expect(s.get('u02')).toBe('locked');
  });
  it('opens units up to the placement start', () => {
    const units = [1, 2, 3, 4, 5, 6, 7].map((n) => makeUnit(`u0${n}`, n));
    const s = unitStatuses(units, new Map(), 6);
    expect(s.get('u06')).toBe('available');
    expect(s.get('u07')).toBe('locked');
    expect(currentUnitId(units, s, 6)).toBe('u06');
  });
});

describe('session builder', () => {
  const segment = { id: 'u01:words:1', unitId: 'u01', kind: 'words' as const, title: 'New words 1', itemIds: [] };
  it('orders reviews, mistakes, lesson, then skill task', () => {
    const steps = buildSession({
      goal: 10,
      dueReviewIds: Array.from({ length: 50 }, (_, i) => `w${i}`),
      dueMistakeIds: [1, 2, 3, 4, 5],
      nextSegment: segment,
      skillTask: { skill: 'listening', itemId: 'u01-li01', title: 'Au café' },
    });
    expect(steps.map((s) => s.kind)).toEqual(['review', 'mistakes', 'lesson', 'skill']);
    expect(steps[0].kind === 'review' && steps[0].itemIds).toHaveLength(15);
    expect(steps[1].kind === 'mistakes' && steps[1].mistakeIds).toHaveLength(3);
    expect(describeSession(steps)).toBe('15 reviews · 3 mistakes · 1 lesson · 1 listening');
  });
  it('scales the review budget with the goal', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `w${i}`);
    const count = (goal: 10 | 15 | 20): number => {
      const step = buildSession({ goal, dueReviewIds: ids, dueMistakeIds: [], nextSegment: null, skillTask: null })[0];
      return step.kind === 'review' ? step.itemIds.length : 0;
    };
    expect([count(10), count(15), count(20)]).toEqual([15, 25, 40]);
  });
  it('describes an empty session', () => {
    expect(describeSession([])).toBe('All done for today');
  });
  it('rotates through all five skills', () => {
    expect(new Set([0, 1, 2, 3, 4].map(skillForDay)).size).toBe(5);
    expect(skillForDay(5)).toBe(skillForDay(0));
    expect(skillForDay(-1)).toBe(skillForDay(4));
  });
  it('prefers unseen skill items from the earliest unit, then the stalest', () => {
    const c = [
      { itemId: 'b', title: 'B', skill: 'reading' as const, unitOrder: 2, lastDoneAt: null },
      { itemId: 'a', title: 'A', skill: 'reading' as const, unitOrder: 1, lastDoneAt: null },
      { itemId: 'z', title: 'Z', skill: 'listening' as const, unitOrder: 1, lastDoneAt: null },
    ];
    expect(pickSkillTask('reading', c)?.itemId).toBe('a');
    const done = c.map((x, i) => ({ ...x, lastDoneAt: 100 - i }));
    expect(pickSkillTask('reading', done)?.itemId).toBe('a');
    expect(pickSkillTask('writing', c)).toBeNull();
  });
});

describe('level estimate', () => {
  it('keeps learners without a placement (from before A1 existed) at A2', () => {
    const e = estimateLevel({ completedUnits: 0, totalUnits: 24, masteredCards: 0, recentAttempts: [], placement: null });
    expect(e.value).toBe(0.15);
    expect(e.label).toBe('A2');
  });
  it('returns A1 and A1+ at low scores', () => {
    const a1 = estimateLevel({ completedUnits: 0, totalUnits: 24, masteredCards: 0, recentAttempts: [], placement: 'A1' });
    expect([a1.value, a1.label]).toEqual([0, 'A1']);
    const a1plus = estimateLevel({
      completedUnits: 3,
      totalUnits: 24,
      masteredCards: 40,
      recentAttempts: Array.from({ length: 30 }, () => ({ correct: true, level: 'A1+' as const })),
      placement: 'A1',
    });
    expect(a1plus.label).toBe('A1+');
    expect(estimateLevel({ completedUnits: 0, totalUnits: 24, masteredCards: 0, recentAttempts: [], placement: 'A1+' }).label).toBe('A1+');
  });
  it('uses the placement result as a floor', () => {
    const e = estimateLevel({ completedUnits: 0, totalUnits: 18, masteredCards: 0, recentAttempts: [], placement: 'A2+' });
    expect(e.label).toBe('A2+');
  });
  it('reaches B1 with full progress and strong B1 answers', () => {
    const e = estimateLevel({
      completedUnits: 18,
      totalUnits: 18,
      masteredCards: 700,
      recentAttempts: Array.from({ length: 100 }, () => ({ correct: true, level: 'B1' as const })),
      placement: 'A2',
    });
    expect(e.value).toBeCloseTo(1);
    expect(e.label).toBe('B1');
  });
  it('discounts demonstrated level when there are few answers', () => {
    const few = estimateLevel({ completedUnits: 0, totalUnits: 18, masteredCards: 0, recentAttempts: [{ correct: true, level: 'B1' }], placement: null });
    expect(few.parts.demonstrated).toBeLessThan(0.1);
  });
  it('labels thresholds', () => {
    expect([labelFor(0), labelFor(0.1), labelFor(0.2), labelFor(0.5), labelFor(0.8)]).toEqual(['A1', 'A1+', 'A2', 'A2+', 'B1']);
  });
  it('places from band accuracy', () => {
    const band = (c: number) => ({ correct: c, total: 8 });
    const basics = { A1: band(7), 'A1+': band(6) };
    expect(placementLevel({ A1: band(3) })).toBe('A1');
    expect(placementLevel({ A1: band(6), 'A1+': band(3) })).toBe('A1+');
    expect(placementLevel({ ...basics, A2: band(3), 'A2+': band(1), B1: band(0) })).toBe('A2');
    expect(placementLevel({ ...basics, A2: band(7), 'A2+': band(5), B1: band(2) })).toBe('A2+');
    expect(placementLevel({ ...basics, A2: band(8), 'A2+': band(7), B1: band(6) })).toBe('B1');
  });
  it('starts each placement result at its unit: A1 1, A1+ 4, A2 7, A2+ 12, B1 17', () => {
    expect(PLACEMENT_BANDS.map((l) => PLACEMENT_START_UNIT[l])).toEqual([1, 4, 7, 12, 17]);
    expect(placementStartFor(null)).toBe(7);
  });
  it('stops placement early once later bands cannot change the result', () => {
    const band = (c: number) => ({ correct: c, total: 8 });
    // Most A1 questions wrong: done after the first block.
    expect(placementDecided({ A1: band(3) })).toBe(true);
    expect(placementDecided({ A1: band(7) })).toBe(false);
    expect(placementDecided({ A1: band(7), 'A1+': band(2) })).toBe(true);
    expect(placementDecided({ A1: band(7), 'A1+': band(7), A2: band(4) })).toBe(true);
    expect(placementDecided({ A1: band(7), 'A1+': band(7), A2: band(7) })).toBe(false);
    expect(placementDecided({ A1: band(7), 'A1+': band(7), A2: band(7), 'A2+': band(3) })).toBe(true);
  });
  it('unlocks mock tests near B1', () => {
    expect(mockTestUnlocked(0.3, false)).toBe(false);
    expect(mockTestUnlocked(0.65, false)).toBe(true);
    expect(mockTestUnlocked(0.1, true)).toBe(true);
  });
});
