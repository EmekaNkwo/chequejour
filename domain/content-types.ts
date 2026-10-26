/**
 * Content data model shared by the content build scripts and the app.
 * Pure types only — no runtime imports — so it can be used everywhere.
 * See docs/CONTENT_AUTHORING.md for the authoring rules.
 */

export type Level = 'A1' | 'A1+' | 'A2' | 'A2+' | 'B1';

export const LEVELS: readonly Level[] = ['A1', 'A1+', 'A2', 'A2+', 'B1'];

export type Skill = 'listening' | 'reading' | 'structures' | 'writing' | 'speaking';

export const SKILLS: readonly Skill[] = ['listening', 'reading', 'structures', 'writing', 'speaking'];

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'expression'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'other';

export type Gender = 'm' | 'f' | 'mf';

/** Grammar tags let the app find the learner's weakest grammar points. */
export type GrammarTag =
  | 'present'
  | 'negation'
  | 'passe-compose'
  | 'imparfait'
  | 'pc-vs-imparfait'
  | 'futur-proche'
  | 'futur-simple'
  | 'conditionnel'
  | 'cod'
  | 'coi'
  | 'y-en'
  | 'relatifs'
  | 'dont'
  | 'questions'
  | 'comparatifs'
  | 'partitifs'
  | 'imperatif'
  | 'subjonctif'
  | 'connecteurs'
  | 'discours-indirect'
  | 'prepositions'
  | 'accord'
  | 'pronoms-sujets'
  | 'etre-avoir'
  | 'possessifs'
  | 'il-y-a'
  | 'pronominaux'
  | 'vocabulary';

export const GRAMMAR_TAGS: readonly GrammarTag[] = [
  'present',
  'negation',
  'passe-compose',
  'imparfait',
  'pc-vs-imparfait',
  'futur-proche',
  'futur-simple',
  'conditionnel',
  'cod',
  'coi',
  'y-en',
  'relatifs',
  'dont',
  'questions',
  'comparatifs',
  'partitifs',
  'imperatif',
  'subjonctif',
  'connecteurs',
  'discours-indirect',
  'prepositions',
  'accord',
  'pronoms-sujets',
  'etre-avoir',
  'possessifs',
  'il-y-a',
  'pronominaux',
  'vocabulary',
];

export const GRAMMAR_TAG_LABELS: Readonly<Record<GrammarTag, string>> = {
  present: 'Present tense',
  negation: 'Negation',
  'passe-compose': 'Passé composé',
  imparfait: 'Imparfait',
  'pc-vs-imparfait': 'Passé composé vs imparfait',
  'futur-proche': 'Futur proche',
  'futur-simple': 'Futur simple',
  conditionnel: 'Conditionnel présent',
  cod: 'Direct object pronouns',
  coi: 'Indirect object pronouns',
  'y-en': 'The pronouns y and en',
  relatifs: 'Relative pronouns qui, que, où',
  dont: 'The relative pronoun dont',
  questions: 'Asking questions',
  comparatifs: 'Comparatives and superlatives',
  partitifs: 'Articles and partitives',
  imperatif: 'Imperative',
  subjonctif: 'Subjonctif présent',
  connecteurs: 'Connectors',
  'discours-indirect': 'Reported speech',
  prepositions: 'Prepositions',
  accord: 'Agreement',
  'pronoms-sujets': 'Subject pronouns, tu and vous',
  'etre-avoir': 'Être and avoir',
  possessifs: 'Possessive adjectives',
  'il-y-a': 'Il y a',
  pronominaux: 'Reflexive verbs',
  vocabulary: 'Vocabulary',
};

export interface Bilingual {
  fr: string;
  en: string;
}

export interface VocabItem {
  /** e.g. "u01-w001" */
  id: string;
  /** French headword without article, e.g. "réveil", "se lever", "à l'heure". */
  fr: string;
  /** English meaning. */
  en: string;
  pos: PartOfSpeech;
  /** Required for nouns. */
  gender?: Gender;
  /** Plural form for nouns, e.g. "réveils". */
  plural?: string;
  /** Nouns used only in the plural (les vacances, les toilettes) take "les". */
  pluralOnly?: boolean;
  level: Level;
  /** Core words are taught in the unit lesson; the rest form the unit's word bank. */
  core: boolean;
  example: Bilingual;
}

export interface Sentence {
  /** e.g. "s001" */
  id: string;
  fr: string;
  en: string;
  /** One-line explanation of the grammar point the sentence shows. */
  grammarNote: string;
  grammarTag: GrammarTag;
  level: Level;
}

export interface GrammarLesson {
  /** e.g. "u01-g01" */
  id: string;
  title: string;
  level: Level;
  grammarTag: GrammarTag;
  /** Short paragraphs of English explanation. */
  explanation: string[];
  /** Optional rule table, e.g. conjugations. First row is the header. */
  table?: string[][];
  examples: Bilingual[];
  commonMistakes: { wrong: string; right: string; why: string }[];
}

interface ExerciseBase {
  /** e.g. "u01-ex01" */
  id: string;
  level: Level;
  skill: 'structures' | 'listening' | 'reading';
  grammarTag: GrammarTag;
  /** Short English explanation shown after answering. */
  explanation: string;
}

export interface McqExercise extends ExerciseBase {
  type: 'mcq';
  /** Instruction or question in English (may contain French). */
  prompt: string;
  /** Optional French sentence shown large, with ___ for a gap. */
  promptFr?: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  prompt: string;
  /** French sentence with exactly one "___". */
  sentence: string;
  /** Accepted answers (first is canonical). */
  answers: string[];
  hint?: string;
  translation: string;
}

export interface ConjugationExercise extends ExerciseBase {
  type: 'conjugation';
  verb: string;
  tense: string;
  /** e.g. "nous", "elle", "ils". */
  person: string;
  /** Accepted answers WITHOUT the subject pronoun, first is canonical. */
  answers: string[];
}

export interface ReorderExercise extends ExerciseBase {
  type: 'reorder';
  prompt: string;
  /** Tokens in the CORRECT order; the app shuffles them. */
  tokens: string[];
  translation: string;
}

export interface MatchExercise extends ExerciseBase {
  type: 'match';
  prompt: string;
  /** 3–5 pairs. Left is French. */
  pairs: { left: string; right: string }[];
}

export interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  direction: 'fr-en' | 'en-fr';
  source: string;
  /** Accepted answers, first is canonical. */
  answers: string[];
}

export interface DictationExercise extends ExerciseBase {
  type: 'dictation';
  /** French text the learner hears and types. */
  text: string;
  translation: string;
}

export type Exercise =
  | McqExercise
  | FillBlankExercise
  | ConjugationExercise
  | ReorderExercise
  | MatchExercise
  | TranslateExercise
  | DictationExercise;

export type ExerciseType = Exercise['type'];

/** Comprehension question attached to a listening or reading text. */
export interface ComprehensionQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface ListeningItem {
  /** e.g. "u01-li01" */
  id: string;
  title: string;
  level: Level;
  kind: 'dialogue' | 'announcement' | 'message' | 'interview';
  /** Short English context line, e.g. "Two colleagues at the coffee machine." */
  context: string;
  lines: { speaker: string; fr: string }[];
  translation: string;
  questions: ComprehensionQuestion[];
}

export interface ReadingItem {
  /** e.g. "u01-re01" */
  id: string;
  title: string;
  level: Level;
  kind: 'message' | 'notice' | 'email' | 'article' | 'advert' | 'letter';
  text: string;
  translation: string;
  questions: ComprehensionQuestion[];
}

export interface WritingTask {
  /** e.g. "u01-wr01" */
  id: string;
  title: string;
  level: Level;
  /** TCF-style task type. */
  taskType: 'message' | 'description' | 'opinion';
  instructions: string;
  /** Task statement in French, as on the exam. */
  promptFr: string;
  minWords: number;
  maxWords: number;
  /** Task 3 (opinion): two short documents giving opposing views, compared before giving an opinion. */
  documents?: { title: string; text: string }[];
  modelAnswer: string;
  checklist: string[];
}

export interface SpeakingTask {
  /** e.g. "u01-sp01" */
  id: string;
  title: string;
  level: Level;
  taskType: 'entretien' | 'interaction' | 'opinion';
  instructions: string;
  promptFr: string;
  prepSeconds: number;
  speakSeconds: number;
  modelAnswer: string;
  tips: string[];
}

export interface Unit {
  /** e.g. "u01" */
  id: string;
  order: number;
  level: Level;
  /** English theme, e.g. "Daily life". */
  theme: string;
  titleFr: string;
  description: string;
  vocab: VocabItem[];
  grammar: GrammarLesson[];
  exercises: Exercise[];
  listening: ListeningItem[];
  reading: ReadingItem[];
  writing: WritingTask[];
  speaking: SpeakingTask[];
  /** End-of-unit checkpoint quiz. */
  checkpoint: Exercise[];
}

export interface PlacementTest {
  version: number;
  questions: (McqExercise & { band: Level })[];
}

/**
 * Difficulty band of a mock question. TCF questions rise in difficulty through each
 * test; this course's mocks go from A1 to B2. Harder questions earn more points.
 */
export type CefrBand = 'A1' | 'A2' | 'B1' | 'B2';

export const CEFR_BANDS: readonly CefrBand[] = ['A1', 'A2', 'B1', 'B2'];

export interface MockQuestion extends ComprehensionQuestion {
  band: CefrBand;
}

export interface MockListeningItem extends Omit<ListeningItem, 'questions'> {
  questions: MockQuestion[];
}

export interface MockReadingItem extends Omit<ReadingItem, 'questions'> {
  questions: MockQuestion[];
}

/** A TCF Canada-style mock: four tests, items in rising order of difficulty. */
export interface MockTest {
  id: string;
  title: string;
  listening: MockListeningItem[];
  reading: MockReadingItem[];
  /** Tasks 1, 2, 3 in order (message, description, opinion). */
  writing: WritingTask[];
  /** Tasks 1, 2, 3 in order (entretien, interaction, opinion). */
  speaking: SpeakingTask[];
}

/** The compiled bundle that ships with the app. */
export interface ContentBundle {
  version: number;
  builtAt: string;
  units: Unit[];
  sentences: Sentence[];
  placement: PlacementTest;
  mockTests: MockTest[];
  /** Question-forming drills for speaking task 2; stored as exercises outside any unit. */
  questionDrills?: Exercise[];
}
