import type { Exercise } from '../content-types';
import { drillPlan, groupMistakes, weakestPoint, type MistakeSummary } from '../mistakes';

const m = (id: string, skill: MistakeSummary['skill'], grammarTag: MistakeSummary['grammarTag'], timesWrong = 1, resolved = false): MistakeSummary => ({
  itemId: id,
  skill,
  grammarTag,
  timesWrong,
  resolved,
});

const MISTAKES = [
  m('a', 'structures', 'imparfait', 2),
  m('b', 'structures', 'imparfait'),
  m('c', 'structures', 'subjonctif', 4),
  m('d', 'listening', null),
  m('e', 'reading', 'vocabulary'),
  m('f', 'structures', 'imparfait', 1, true),
];

describe('mistake grouping', () => {
  it('counts open mistakes per grammar point and per skill, biggest first', () => {
    const g = groupMistakes(MISTAKES);
    expect(g.byGrammar).toEqual([
      { tag: 'imparfait', label: 'Imparfait', count: 2, timesWrong: 3 },
      { tag: 'subjonctif', label: expect.any(String), count: 1, timesWrong: 4 },
    ]);
    expect(g.bySkill).toEqual([
      { skill: 'structures', count: 3 },
      { skill: 'listening', count: 1 },
      { skill: 'reading', count: 1 },
    ]);
  });

  it('calls the grammar point with most open mistakes the weakest, breaking ties by times wrong', () => {
    expect(weakestPoint(MISTAKES)?.tag).toBe('imparfait');
    expect(weakestPoint([m('x', 'structures', 'negation'), m('y', 'structures', 'present', 3)])?.tag).toBe('present');
    expect(weakestPoint([m('z', 'listening', null)])).toBeNull();
  });
});

describe('drill plan', () => {
  const ex = (id: string, grammarTag: Exercise['grammarTag']): Exercise => ({ id, type: 'mcq', level: 'A2', skill: 'structures', grammarTag, explanation: 'e', prompt: 'p', options: ['a', 'b'], answer: 0 });
  const pool = [ex('a', 'imparfait'), ex('r1', 'imparfait'), ex('r2', 'imparfait'), ex('r3', 'imparfait'), ex('o1', 'present'), ex('b', 'imparfait')];

  it("starts with the point's open mistakes, then adds related exercises up to the size", () => {
    const plan = drillPlan('imparfait', MISTAKES, pool, 'seed', 4);
    expect(plan.slice(0, 2).sort()).toEqual(['a', 'b']);
    expect(plan).toHaveLength(4);
    expect(plan.every((id) => ['a', 'b', 'r1', 'r2', 'r3'].includes(id))).toBe(true);
    expect(drillPlan('imparfait', MISTAKES, pool, 'seed', 4)).toEqual(plan);
  });

  it('still builds a drill from related exercises when there are no mistakes for the point', () => {
    expect(drillPlan('present', MISTAKES, pool, 'seed', 4)).toEqual(['o1']);
  });
});
