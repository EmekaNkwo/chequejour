import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bundleJson from '../../content/build/content.json';
import { collectAudioClips } from '../audio-keys';
import type { ContentBundle, Exercise } from '../content-types';
import { exerciseProblems } from '../exercises/content-checks';
import { speakingTaskFormat } from '../tcf/exam-format';

const base = { level: 'A2', skill: 'structures', grammarTag: 'present', explanation: 'e' } as const;

describe('exercise content checks', () => {
  it('flags conjugation drills with an unknown tense or a form the tables disagree with', () => {
    const bad: Exercise = { ...base, id: 'c1', type: 'conjugation', verb: 'aller', tense: 'passé composé', person: 'nous', answers: ['avons allé'] };
    expect(exerciseProblems(bad)).toEqual(['c1: answers ["avons allé"] don\'t include the table form "sommes allés"']);
    const tense: Exercise = { ...base, id: 'c2', type: 'conjugation', verb: 'zébrer', tense: 'plus-que-parfait', person: 'je', answers: ['avais zébré'] };
    expect(exerciseProblems(tense)).toEqual(['c2: unknown tense "plus-que-parfait"']);
    const fem: Exercise = { ...base, id: 'c3', type: 'conjugation', verb: 'partir', tense: 'passé composé', person: 'elle', answers: ['est partie'] };
    expect(exerciseProblems(fem)).toEqual([]);
  });

  it('flags duplicate or echoing translation answers, ambiguous matches and odd dictations', () => {
    expect(exerciseProblems({ ...base, id: 't1', type: 'translate', direction: 'fr-en', source: 'Bonjour', answers: ['Hello', 'hello.', 'Bonjour'] })).toEqual([
      't1: answer "hello" is listed twice',
      't1: an answer repeats the source text',
    ]);
    expect(
      exerciseProblems({ ...base, id: 'm1', type: 'match', prompt: 'p', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'x' }, { left: 'c', right: 'y' }] }),
    ).toEqual(['m1: two right items are the same, so the match is ambiguous']);
    expect(exerciseProblems({ ...base, id: 'd1', type: 'dictation', text: 'Bonjour', translation: 'Hello' })).toEqual([
      'd1: dictation text should end with . ! ? or …',
      'd1: dictation has 1 words (expected 3–25)',
    ]);
  });

  it('finds no problems in the shipped content', () => {
    const bundle = bundleJson as unknown as ContentBundle;
    const all = bundle.units.flatMap((u) => [...u.exercises, ...u.checkpoint]);
    expect(all.flatMap(exerciseProblems)).toEqual([]);
  });

  it('times every speaking task like the exam: 2 min interview, 2+3½ min interaction, 4½ min opinion', () => {
    const bundle = bundleJson as unknown as ContentBundle;
    const off = bundle.units
      .flatMap((u) => u.speaking)
      .filter((t) => {
        const f = speakingTaskFormat(t.taskType);
        return t.prepSeconds !== f.prepSeconds || t.speakSeconds !== f.speakSeconds;
      });
    expect(off.map((t) => t.id)).toEqual([]);
    expect([speakingTaskFormat('entretien'), speakingTaskFormat('interaction'), speakingTaskFormat('opinion')].map((f) => f.prepSeconds + f.speakSeconds)).toEqual([120, 330, 270]);
  });

  it('ships A1 and A1+ content at every level tag, all of it with audio', () => {
    const bundle = bundleJson as unknown as ContentBundle;
    const a1Units = bundle.units.filter((u) => u.level === 'A1' || u.level === 'A1+');
    expect(a1Units.map((u) => u.id)).toEqual(['a01', 'a02', 'a03', 'a04', 'a05', 'a06']);
    const items = a1Units.flatMap((u) => [...u.vocab, ...u.grammar, ...u.exercises, ...u.checkpoint, ...u.listening, ...u.reading, ...u.writing, ...u.speaking]);
    expect(items.every((i) => i.level === 'A1' || i.level === 'A1+')).toBe(true);
    const a1Bundle = { ...bundle, units: a1Units, sentences: bundle.sentences.filter((s) => s.level === 'A1' || s.level === 'A1+'), mockTests: [], placement: { version: 0, questions: [] } };
    expect(a1Bundle.sentences.length).toBeGreaterThanOrEqual(60);
    const clips = collectAudioClips(a1Bundle);
    const missing = clips.filter((c) => !existsSync(join(__dirname, '..', '..', 'assets', 'audio', `${c.key}.m4a`)));
    expect(missing.map((c) => c.key)).toEqual([]);
  });
});
