/**
 * Loads and validates all content source files. Shared by validate.ts and build.ts.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ZodType } from 'zod';
import { collectAudioClips } from '../../domain/audio-keys';
import type { ContentBundle, Exercise, MockTest, PlacementTest, Sentence, Unit } from '../../domain/content-types';
import { speakingTaskFormat } from '../../domain/tcf/exam-format';
import { exerciseProblems } from '../../domain/exercises/content-checks';
import { mockFormatProblems } from '../../domain/tcf/mock-format-checks';
import { exerciseSchema, mockTestSchema, placementSchema, sentenceSchema, unitSchema } from './schema';

export const ROOT = resolve(__dirname, '..', '..');
export const SOURCE_DIR = join(ROOT, 'content', 'source');
export const AUDIO_DIR = join(ROOT, 'assets', 'audio');
export const AUDIO_EXT = '.m4a';

/** Bump whenever content changes shape or text, so installed apps reseed. 2: TCF Canada mocks. 3: mocks 3 and 4. 4: sentence-halves matching. 5: question drills. 6: speaking timings match the exam. 7: A1 units a01–a06, A1 placement and sentences. */
export const CONTENT_VERSION = 8;
export const MIN_SENTENCES = 365;

export interface Report {
  errors: string[];
  warnings: string[];
}

function readJson(path: string, report: Report): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    report.errors.push(`${path}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}

function parseWith<T>(schema: ZodType<T>, value: unknown, label: string, report: Report): T | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues.slice(0, 25)) {
    report.errors.push(`${label}: ${issue.path.join('.') || '(root)'} — ${issue.message}`);
  }
  return undefined;
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

export function loadUnit(path: string, report: Report): Unit | undefined {
  const raw = readJson(path, report);
  return raw === undefined ? undefined : parseWith(unitSchema, raw, path, report);
}

/** Checks rules that a schema alone cannot express. */
export function checkUnit(unit: Unit, report: Report): void {
  const prefix = `${unit.id}-`;
  const ids = [
    ...unit.vocab.map((v) => v.id),
    ...unit.grammar.map((g) => g.id),
    ...unit.exercises.map((e) => e.id),
    ...unit.checkpoint.map((e) => e.id),
    ...unit.listening.map((l) => l.id),
    ...unit.reading.map((r) => r.id),
    ...unit.writing.map((w) => w.id),
    ...unit.speaking.map((s) => s.id),
  ];
  for (const id of ids) {
    if (!id.startsWith(prefix)) report.errors.push(`${unit.id}: id "${id}" must start with "${prefix}"`);
  }
  const core = unit.vocab.filter((v) => v.core).length;
  if (core < 15 || core > 25) report.errors.push(`${unit.id}: ${core} core words (expected 15–25)`);
  const seen = new Set<string>();
  for (const v of unit.vocab) {
    const key = `${v.fr.toLowerCase()}|${v.pos}`;
    if (seen.has(key)) report.warnings.push(`${unit.id}: duplicate headword "${v.fr}" (${v.pos})`);
    seen.add(key);
  }
  for (const e of [...unit.exercises, ...unit.checkpoint]) {
    if (e.type === 'reorder' && new Set(e.tokens).size !== e.tokens.length) {
      report.warnings.push(`${e.id}: repeated reorder tokens make several orders valid`);
    }
    report.errors.push(...exerciseProblems(e));
  }
  for (const t of unit.speaking) {
    const format = speakingTaskFormat(t.taskType);
    if (t.prepSeconds !== format.prepSeconds || t.speakSeconds !== format.speakSeconds) {
      report.errors.push(`${t.id}: ${t.taskType} timing ${t.prepSeconds}+${t.speakSeconds}s should match the exam (${format.prepSeconds}+${format.speakSeconds}s)`);
    }
  }
}

export function loadAll(report: Report): ContentBundle {
  const units = jsonFiles(join(SOURCE_DIR, 'units'))
    .map((p) => loadUnit(p, report))
    .filter((u): u is Unit => u !== undefined)
    .sort((a, b) => a.order - b.order);
  units.forEach((u) => checkUnit(u, report));

  const sentences: Sentence[] = jsonFiles(join(SOURCE_DIR, 'sentences')).flatMap((p) => {
    const raw = readJson(p, report);
    if (!Array.isArray(raw)) {
      if (raw !== undefined) report.errors.push(`${p}: expected an array of sentences`);
      return [];
    }
    return raw
      .map((s, i) => parseWith(sentenceSchema, s, `${p}[${i}]`, report))
      .filter((s): s is Sentence => s !== undefined);
  });

  const placementPath = join(SOURCE_DIR, 'placement.json');
  const placementRaw = existsSync(placementPath) ? readJson(placementPath, report) : undefined;
  if (placementRaw === undefined) report.errors.push('placement.json is missing');
  const placement: PlacementTest = (placementRaw !== undefined &&
    parseWith(placementSchema, placementRaw, 'placement.json', report)) || { version: 0, questions: [] };

  const mockTests = jsonFiles(join(SOURCE_DIR, 'mock-tests'))
    .map((p) => {
      const raw = readJson(p, report);
      return raw === undefined ? undefined : parseWith(mockTestSchema, raw, p, report);
    })
    .filter((m): m is MockTest => m !== undefined);

  const drillsPath = join(SOURCE_DIR, 'question-drills.json');
  const drillsRaw = existsSync(drillsPath) ? readJson(drillsPath, report) : [];
  const questionDrills: Exercise[] = Array.isArray(drillsRaw)
    ? drillsRaw.map((e, i) => parseWith(exerciseSchema, e, `question-drills.json[${i}]`, report)).filter((e): e is Exercise => e !== undefined)
    : [];
  for (const e of questionDrills) {
    if (!e.id.startsWith('qd-')) report.errors.push(`question-drills.json: id "${e.id}" must start with "qd-"`);
    report.errors.push(...exerciseProblems(e));
  }

  const bundle: ContentBundle = {
    version: CONTENT_VERSION,
    builtAt: new Date().toISOString(),
    units,
    sentences,
    placement,
    mockTests,
    questionDrills,
  };
  checkBundle(bundle, report);
  return bundle;
}

function checkBundle(bundle: ContentBundle, report: Report): void {
  const all = [
    ...bundle.units.flatMap((u) => [
      ...u.vocab,
      ...u.grammar,
      ...u.exercises,
      ...u.checkpoint,
      ...u.listening,
      ...u.reading,
      ...u.writing,
      ...u.speaking,
      ...u.listening.flatMap((l) => l.questions),
      ...u.reading.flatMap((r) => r.questions),
    ]),
    ...bundle.sentences,
    ...bundle.placement.questions,
    ...bundle.mockTests.flatMap((m) => [
      ...m.writing,
      ...m.speaking,
      ...m.listening,
      ...m.reading,
      ...m.listening.flatMap((l) => l.questions),
      ...m.reading.flatMap((r) => r.questions),
    ]),
  ];
  const counts = new Map<string, number>();
  for (const item of all) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  for (const [id, n] of counts) if (n > 1) report.errors.push(`duplicate id "${id}" (${n}×)`);

  for (const m of bundle.mockTests) {
    for (const problem of mockFormatProblems(m)) report.errors.push(`${m.id}: ${problem}`);
  }

  const orders = bundle.units.map((u) => u.order);
  if (new Set(orders).size !== orders.length) report.errors.push('two units share the same order');

  if (bundle.sentences.length < MIN_SENTENCES) {
    report.warnings.push(`only ${bundle.sentences.length} sentences of the day (target ${MIN_SENTENCES}+)`);
  }
  const frSeen = new Set<string>();
  for (const s of bundle.sentences) {
    const key = s.fr.trim().toLowerCase();
    if (frSeen.has(key)) report.errors.push(`${s.id}: duplicate sentence "${s.fr}"`);
    frSeen.add(key);
  }

  const clips = collectAudioClips(bundle);
  const missing = clips.filter((c) => !existsSync(join(AUDIO_DIR, `${c.key}${AUDIO_EXT}`)));
  if (missing.length > 0) {
    report.warnings.push(
      `${missing.length}/${clips.length} audio clips missing (TTS fallback will be used). Run "npm run content:audio".`,
    );
  }
}

export function summarize(bundle: ContentBundle): string {
  const vocab = bundle.units.reduce((n, u) => n + u.vocab.length, 0);
  const byLevel = bundle.units.map((u) => `${u.id}(${u.level})`).join(' ');
  return [
    `units: ${bundle.units.length}  ${byLevel}`,
    `vocabulary: ${vocab}`,
    `sentences: ${bundle.sentences.length}`,
    `exercises: ${bundle.units.reduce((n, u) => n + u.exercises.length + u.checkpoint.length, 0)}`,
    `placement questions: ${bundle.placement.questions.length}`,
    `mock tests: ${bundle.mockTests.length}`,
    `question drills: ${bundle.questionDrills?.length ?? 0}`,
  ].join('\n');
}
