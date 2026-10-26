/**
 * Read access to course content stored in SQLite. Parsed items are cached in memory
 * because content never changes while the app runs.
 */
import type {
  Exercise,
  GrammarLesson,
  Level,
  ListeningItem,
  McqExercise,
  MockTest,
  ReadingItem,
  Sentence,
  SpeakingTask,
  Unit,
  VocabItem,
  WritingTask,
} from '../domain/content-types';
import type { ItemKind } from './content-seed';
import type { SqlDb } from './sql';

/** French letters folded for search, so 'reveil' finds 'réveil' and 'soeur' finds 'sœur'. */
const FOLDS: readonly [string, string][] = [
  ['œ', 'oe'], ['æ', 'ae'], ['à', 'a'], ['â', 'a'], ['ä', 'a'], ['ç', 'c'], ['é', 'e'], ['è', 'e'], ['ê', 'e'],
  ['ë', 'e'], ['î', 'i'], ['ï', 'i'], ['ô', 'o'], ['ö', 'o'], ['ù', 'u'], ['û', 'u'], ['ü', 'u'], ['ÿ', 'y'],
];

/** SQL for `expr` lower-cased and folded (SQLite's lower() only handles ASCII). */
function foldSql(expr: string): string {
  const upper = FOLDS.map(([from, to]) => [from.toUpperCase(), to] as const);
  return [...upper, ...FOLDS].reduce((sql, [from, to]) => `replace(${sql}, '${from}', '${to}')`, `lower(${expr})`);
}

function foldForSearch(text: string): string {
  return FOLDS.reduce((t, [from, to]) => t.split(from).join(to), text.trim().toLowerCase());
}

export interface UnitSummary {
  id: string;
  order: number;
  level: Level;
  theme: string;
  titleFr: string;
  description: string;
}

export interface SkillItemSummary {
  id: string;
  kind: 'listening' | 'reading' | 'writing' | 'speaking';
  unitId: string;
  unitOrder: number;
  title: string;
  level: Level;
}

type PlacementQuestion = McqExercise & { band: Level };

interface ItemKindMap {
  word: VocabItem;
  grammar: GrammarLesson;
  exercise: Exercise;
  checkpoint: Exercise;
  listening: ListeningItem;
  reading: ReadingItem;
  writing: WritingTask;
  speaking: SpeakingTask;
  sentence: Sentence;
  placement: PlacementQuestion;
  mock: MockTest;
}

export class ContentRepository {
  private readonly cache = new Map<string, unknown>();
  private unitsCache: UnitSummary[] | null = null;
  private readonly fullUnits = new Map<string, Unit>();

  constructor(private readonly db: SqlDb) {}

  async units(): Promise<UnitSummary[]> {
    if (this.unitsCache) return this.unitsCache;
    const rows = await this.db.getAllAsync<{
      id: string;
      ord: number;
      level: Level;
      theme: string;
      title_fr: string;
      description: string;
    }>('SELECT * FROM content_units ORDER BY ord', []);
    this.unitsCache = rows.map((r) => ({
      id: r.id,
      order: r.ord,
      level: r.level,
      theme: r.theme,
      titleFr: r.title_fr,
      description: r.description,
    }));
    return this.unitsCache;
  }

  async item<K extends ItemKind>(kind: K, id: string): Promise<ItemKindMap[K] | null> {
    const key = `${kind}:${id}`;
    if (this.cache.has(key)) return this.cache.get(key) as ItemKindMap[K];
    const row = await this.db.getFirstAsync<{ json: string }>(
      'SELECT json FROM content_items WHERE kind = ? AND id = ?',
      [kind, id],
    );
    if (!row) return null;
    const parsed = JSON.parse(row.json) as ItemKindMap[K];
    this.cache.set(key, parsed);
    return parsed;
  }

  async items<K extends ItemKind>(kind: K, ids: readonly string[]): Promise<ItemKindMap[K][]> {
    const found = await Promise.all(ids.map((id) => this.item(kind, id)));
    return found.filter((x): x is Awaited<ItemKindMap[K]> => x !== null) as ItemKindMap[K][];
  }

  async listKind<K extends ItemKind>(kind: K, unitId?: string): Promise<ItemKindMap[K][]> {
    const rows = unitId
      ? await this.db.getAllAsync<{ json: string }>(
          'SELECT json FROM content_items WHERE kind = ? AND unit_id = ? ORDER BY ord',
          [kind, unitId],
        )
      : await this.db.getAllAsync<{ json: string }>(
          `SELECT i.json FROM content_items i LEFT JOIN content_units u ON u.id = i.unit_id
           WHERE i.kind = ? ORDER BY u.ord, i.ord`,
          [kind],
        );
    return rows.map((r) => JSON.parse(r.json) as ItemKindMap[K]);
  }

  /** The whole unit, assembled from its items. */
  async unit(id: string): Promise<Unit | null> {
    const cached = this.fullUnits.get(id);
    if (cached) return cached;
    const summary = (await this.units()).find((u) => u.id === id);
    if (!summary) return null;
    const [vocab, grammar, exercises, checkpoint, listening, reading, writing, speaking] = await Promise.all([
      this.listKind('word', id),
      this.listKind('grammar', id),
      this.listKind('exercise', id),
      this.listKind('checkpoint', id),
      this.listKind('listening', id),
      this.listKind('reading', id),
      this.listKind('writing', id),
      this.listKind('speaking', id),
    ]);
    const unit: Unit = { ...summary, vocab, grammar, exercises, checkpoint, listening, reading, writing, speaking };
    this.fullUnits.set(id, unit);
    return unit;
  }

  /**
   * Word ids in course order, optionally limited to the given units. With
   * `uniqueHeadwords`, a word taught in two units is listed once (first occurrence),
   * so Word of the Day never shows the same headword twice.
   */
  async wordIds(unitIds?: readonly string[], options: { uniqueHeadwords?: boolean } = {}): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string; unit_id: string; title: string }>(
      `SELECT i.id, i.unit_id, i.title FROM content_items i JOIN content_units u ON u.id = i.unit_id
       WHERE i.kind = 'word' ORDER BY u.ord, i.ord`,
      [],
    );
    const firstIdByHeadword = new Map<string, string>();
    for (const r of rows) {
      const key = r.title.toLowerCase();
      if (!firstIdByHeadword.has(key)) firstIdByHeadword.set(key, r.id);
    }
    const allowed = unitIds ? new Set(unitIds) : null;
    return rows
      .filter((r) => allowed === null || allowed.has(r.unit_id))
      .filter((r) => !options.uniqueHeadwords || firstIdByHeadword.get(r.title.toLowerCase()) === r.id)
      .map((r) => r.id);
  }

  /** CEFR level of every word and sentence, for picking daily items at the learner's level. */
  async itemLevels(): Promise<Map<string, Level>> {
    const rows = await this.db.getAllAsync<{ id: string; level: Level }>(
      "SELECT id, level FROM content_items WHERE kind IN ('word', 'sentence') AND level IS NOT NULL",
      [],
    );
    return new Map(rows.map((r) => [r.id, r.level]));
  }

  async sentenceIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      "SELECT id FROM content_items WHERE kind = 'sentence' ORDER BY id",
      [],
    );
    return rows.map((r) => r.id);
  }

  async skillItems(): Promise<SkillItemSummary[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      kind: SkillItemSummary['kind'];
      unit_id: string;
      ord: number;
      title: string;
      level: Level;
    }>(
      `SELECT i.id, i.kind, i.unit_id, u.ord, i.title, i.level FROM content_items i
       JOIN content_units u ON u.id = i.unit_id
       WHERE i.kind IN ('listening', 'reading', 'writing', 'speaking') ORDER BY u.ord, i.ord`,
      [],
    );
    return rows.map((r) => ({ id: r.id, kind: r.kind, unitId: r.unit_id, unitOrder: r.ord, title: r.title, level: r.level }));
  }

  async countKind(kind: ItemKind): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM content_items WHERE kind = ?', [kind]);
    return row?.n ?? 0;
  }

  /** Levels of items by id, used when scoring attempts. */
  async levelOf(id: string): Promise<Level | null> {
    const row = await this.db.getFirstAsync<{ level: Level | null }>('SELECT level FROM content_items WHERE id = ?', [id]);
    return row?.level ?? null;
  }

  async search(query: string, limit = 30): Promise<VocabItem[]> {
    const exact = foldForSearch(query);
    const term = exact.replace(/[\\%_]/g, (c) => `\\${c}`);
    if (term.length === 0) return [];
    const title = foldSql('title');
    const en = foldSql("json_extract(json, '$.en')");
    const example = foldSql("json_extract(json, '$.example.fr')");
    // Only the headword, meaning and example are searched (not JSON keys or ids), ignoring
    // case and accents; exact and prefix matches come first.
    const rows = await this.db.getAllAsync<{ json: string }>(
      `SELECT json FROM content_items
       WHERE kind = 'word' AND (${title} LIKE ? ESCAPE '\\' OR ${en} LIKE ? ESCAPE '\\' OR ${example} LIKE ? ESCAPE '\\')
       ORDER BY CASE WHEN ${title} = ? THEN 0 WHEN ${title} LIKE ? ESCAPE '\\' THEN 1
                     WHEN ${en} LIKE ? ESCAPE '\\' THEN 2 ELSE 3 END, title
       LIMIT ?`,
      [`%${term}%`, `%${term}%`, `%${term}%`, exact, `${term}%`, `%${term}%`, limit],
    );
    return rows.map((r) => JSON.parse(r.json) as VocabItem);
  }
}
