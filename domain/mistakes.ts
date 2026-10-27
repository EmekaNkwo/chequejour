/**
 * The mistakes notebook seen by topic: open mistakes grouped by grammar point and by
 * skill, the weakest grammar point, and short drills built around one point.
 */
import { GRAMMAR_TAG_LABELS, type Exercise, type GrammarTag, type Skill } from './content-types';
import { seededShuffle } from './shuffle';

export interface MistakeSummary {
  itemId: string;
  skill: Skill;
  grammarTag: GrammarTag | null;
  timesWrong: number;
  resolved: boolean;
}

export interface GrammarGroup {
  tag: GrammarTag;
  label: string;
  /** Open mistakes on this point. */
  count: number;
  /** All the times those mistakes were answered wrong. */
  timesWrong: number;
}

export interface SkillGroup {
  skill: Skill;
  count: number;
}

export const DRILL_SIZE = 8;

/** Vocabulary is a word problem, not a grammar point, so it only counts by skill. */
const grammarPoint = (m: MistakeSummary): GrammarTag | null => (m.grammarTag && m.grammarTag !== 'vocabulary' ? m.grammarTag : null);

export function groupMistakes(mistakes: readonly MistakeSummary[]): { byGrammar: GrammarGroup[]; bySkill: SkillGroup[] } {
  const open = mistakes.filter((m) => !m.resolved);
  const grammar = new Map<GrammarTag, GrammarGroup>();
  const skills = new Map<Skill, number>();
  for (const m of open) {
    skills.set(m.skill, (skills.get(m.skill) ?? 0) + 1);
    const tag = grammarPoint(m);
    if (!tag) continue;
    const g = grammar.get(tag) ?? { tag, label: GRAMMAR_TAG_LABELS[tag], count: 0, timesWrong: 0 };
    grammar.set(tag, { ...g, count: g.count + 1, timesWrong: g.timesWrong + m.timesWrong });
  }
  return {
    byGrammar: [...grammar.values()].sort((a, b) => b.count - a.count || b.timesWrong - a.timesWrong || a.label.localeCompare(b.label)),
    bySkill: [...skills].map(([skill, count]) => ({ skill, count })).sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)),
  };
}

/** The grammar point with the most open mistakes, or null when none has any. */
export function weakestPoint(mistakes: readonly MistakeSummary[]): GrammarGroup | null {
  return groupMistakes(mistakes).byGrammar[0] ?? null;
}

/**
 * Item ids for a short drill on one grammar point: its open mistakes first, then other
 * exercises on the same point, picked in a stable order for the given seed.
 */
export function drillPlan(tag: GrammarTag, mistakes: readonly MistakeSummary[], exercises: readonly Exercise[], seed: string, size = DRILL_SIZE): string[] {
  const fromMistakes = mistakes.filter((m) => !m.resolved && grammarPoint(m) === tag).map((m) => m.itemId);
  const own = seededShuffle(fromMistakes, seed).slice(0, size);
  const taken = new Set(own);
  const related = seededShuffle(
    exercises.filter((e) => e.grammarTag === tag && !taken.has(e.id)).map((e) => e.id),
    `${seed}:related`,
  );
  return [...own, ...related].slice(0, size);
}
