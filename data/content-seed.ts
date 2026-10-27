/**
 * Loads the bundled content into SQLite on first launch, and again whenever the
 * bundle's version is newer than the stored one. Only content tables are replaced;
 * progress is keyed by item id and kept.
 */
import type { ContentBundle, Unit } from '../domain/content-types';
import type { SqlDb, SqlParam } from './sql';

export type ItemKind =
  | 'word'
  | 'grammar'
  | 'exercise'
  | 'checkpoint'
  | 'listening'
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'sentence'
  | 'placement'
  | 'mock';

interface ItemRow {
  id: string;
  kind: ItemKind;
  unitId: string | null;
  ord: number;
  level: string | null;
  skill: string | null;
  grammarTag: string | null;
  title: string | null;
  json: unknown;
}

function unitRows(unit: Unit): ItemRow[] {
  const base = { unitId: unit.id };
  return [
    ...unit.vocab.map((v, ord) => ({ ...base, id: v.id, kind: 'word' as const, ord, level: v.level, skill: null, grammarTag: 'vocabulary', title: v.fr, json: v })),
    ...unit.grammar.map((g, ord) => ({ ...base, id: g.id, kind: 'grammar' as const, ord, level: g.level, skill: 'structures', grammarTag: g.grammarTag, title: g.title, json: g })),
    ...unit.exercises.map((e, ord) => ({ ...base, id: e.id, kind: 'exercise' as const, ord, level: e.level, skill: e.skill, grammarTag: e.grammarTag, title: null, json: e })),
    ...unit.checkpoint.map((e, ord) => ({ ...base, id: e.id, kind: 'checkpoint' as const, ord, level: e.level, skill: e.skill, grammarTag: e.grammarTag, title: null, json: e })),
    ...unit.listening.map((l, ord) => ({ ...base, id: l.id, kind: 'listening' as const, ord, level: l.level, skill: 'listening', grammarTag: null, title: l.title, json: l })),
    ...unit.reading.map((r, ord) => ({ ...base, id: r.id, kind: 'reading' as const, ord, level: r.level, skill: 'reading', grammarTag: null, title: r.title, json: r })),
    ...unit.writing.map((w, ord) => ({ ...base, id: w.id, kind: 'writing' as const, ord, level: w.level, skill: 'writing', grammarTag: null, title: w.title, json: w })),
    ...unit.speaking.map((s, ord) => ({ ...base, id: s.id, kind: 'speaking' as const, ord, level: s.level, skill: 'speaking', grammarTag: null, title: s.title, json: s })),
  ];
}

export function bundleRows(bundle: ContentBundle): ItemRow[] {
  return [
    ...bundle.units.flatMap(unitRows),
    ...bundle.sentences.map((s, ord) => ({ id: s.id, kind: 'sentence' as const, unitId: null, ord, level: s.level, skill: null, grammarTag: s.grammarTag, title: null, json: s })),
    ...bundle.placement.questions.map((q, ord) => ({ id: q.id, kind: 'placement' as const, unitId: null, ord, level: q.band, skill: q.skill, grammarTag: q.grammarTag, title: null, json: q })),
    ...bundle.mockTests.map((m, ord) => ({ id: m.id, kind: 'mock' as const, unitId: null, ord, level: 'B1', skill: null, grammarTag: null, title: m.title, json: m })),
    ...(bundle.questionDrills ?? []).map((e, ord) => ({ id: e.id, kind: 'exercise' as const, unitId: null, ord, level: e.level, skill: e.skill, grammarTag: e.grammarTag, title: null, json: e })),
  ];
}

export async function storedContentVersion(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'content_version'", []);
  return row ? Number(row.value) : 0;
}

export async function seedContentIfNeeded(db: SqlDb, bundle: ContentBundle): Promise<boolean> {
  if ((await storedContentVersion(db)) >= bundle.version) return false;
  const rows = bundleRows(bundle);
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM content_items; DELETE FROM content_units;');
    for (const u of bundle.units) {
      await db.runAsync(
        'INSERT INTO content_units (id, ord, level, theme, title_fr, description) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, u.order, u.level, u.theme, u.titleFr, u.description],
      );
    }
    for (const r of rows) {
      const params: SqlParam[] = [r.id, r.kind, r.unitId, r.ord, r.level, r.skill, r.grammarTag, r.title, JSON.stringify(r.json)];
      await db.runAsync(
        'INSERT INTO content_items (id, kind, unit_id, ord, level, skill, grammar_tag, title, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params,
      );
    }
    await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('content_version', ?)", [String(bundle.version)]);
  });
  return true;
}
