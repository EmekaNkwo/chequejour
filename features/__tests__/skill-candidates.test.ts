import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import { pickSkillTask } from '../../domain/session';
import type { PathState } from '../path/path-service';
import { skillCandidates } from '../session/session-service';

const unit = (order: number) => ({ id: `u0${order}`, order, theme: `Theme ${order}`, status: 'open' });

const content = {
  skillItems: async () => [
    { id: 'u01-re01', title: 'Unit 1 reading', kind: 'reading', unitId: 'u01', unitOrder: 1 },
    { id: 'u06-re01', title: 'Unit 6 reading', kind: 'reading', unitId: 'u06', unitOrder: 6 },
  ],
} as unknown as ContentRepository;

const progressWith = (done: Record<string, number>) =>
  ({
    skillProgress: async () => new Map(Object.entries(done).map(([id, lastDoneAt]) => [id, { lastDoneAt }])),
  }) as unknown as ProgressRepository;

const path = (placementStart: number) => ({ units: [unit(1), unit(6)], placementStart }) as unknown as PathState;

describe('skillCandidates', () => {
  it('picks work from the placement start before revision units', async () => {
    const candidates = await skillCandidates(content, progressWith({}), path(6));
    expect(pickSkillTask('reading', candidates)?.itemId).toBe('u06-re01');
  });

  it('still offers earlier units once the placement-start work is done', async () => {
    const candidates = await skillCandidates(content, progressWith({ 'u06-re01': 1 }), path(6));
    expect(pickSkillTask('reading', candidates)?.itemId).toBe('u01-re01');
  });

  it('keeps path order for learners who started at unit 1', async () => {
    const candidates = await skillCandidates(content, progressWith({}), path(1));
    expect(pickSkillTask('reading', candidates)?.itemId).toBe('u01-re01');
  });
});
