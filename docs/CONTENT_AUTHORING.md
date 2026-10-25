# Content authoring guide

All learning content lives in versioned JSON under `content/source/`. A build step
validates it and compiles it into `content/build/content.json`, which ships inside the
app and is loaded into SQLite on first launch (and again whenever the content version
changes). You can add or edit content without touching app code.

```
content/source/
  units/u01.json … u18.json   one file per unit
  sentences/*.json            arrays of sentences of the day (365+ in total)
  placement.json              first-launch placement test
  mock-tests/*.json           timed TCF-style mock tests
```

The TypeScript types in `domain/content-types.ts` are the source of truth; the Zod
schemas in `content/scripts/schema.ts` enforce them.

## Workflow

```bash
npx tsx content/scripts/validate.ts content/source/units/u07.json   # check one file
npm run content:validate   # check everything (ids, duplicates, counts, audio)
npm run content:audio      # (macOS) generate missing audio clips with the system French voice
npm run content:build      # compile content/build/content.json + the audio manifest
```

After changing content, bump `CONTENT_VERSION` in `content/scripts/load.ts` so installed
apps reload it. Progress is keyed by item id, so **never reuse or renumber an id** — add
new ids instead.

## Ids

| Item | Pattern | Example |
| --- | --- | --- |
| Unit | `uNN` | `u07` |
| Word | `uNN-wNNN` | `u07-w014` |
| Grammar lesson | `uNN-gNN` | `u07-g01` |
| Exercise | `uNN-exNN` | `u07-ex12` |
| Checkpoint question | `uNN-cpNN` | `u07-cp03` |
| Listening | `uNN-liNN`, questions `uNN-liNN-qN` | `u07-li02-q1` |
| Reading | `uNN-reNN`, questions `uNN-reNN-qN` | `u07-re01-q3` |
| Writing | `uNN-wrNN` | `u07-wr01` |
| Speaking | `uNN-spNN` | `u07-sp02` |
| Sentence of the day | `sNNN` | `s142` |
| Placement | `plNN` | `pl12` |
| Mock test | `mkN-…` | `mk1-st04` |

## Levels

Every item carries `level`: `"A2"`, `"A2+"` or `"B1"`. Tag the item, not just the unit:
a B1 unit can contain an A2+ warm-up exercise.

## Words (`vocab`)

```json
{
  "id": "u03-w001",
  "fr": "loyer",
  "en": "rent",
  "pos": "noun",
  "gender": "m",
  "plural": "loyers",
  "level": "A2",
  "core": true,
  "example": { "fr": "Le loyer est payé le premier du mois.", "en": "The rent is paid on the first of the month." }
}
```

- `fr` is the headword **without an article**. The app adds le / la / l' from `gender`
  (it knows the common aspirated-h words such as *hasard* and *haricot*).
- `gender` is required for nouns: `m`, `f`, or `mf` for nouns such as *collègue*.
- Verbs go in the infinitive (`se lever`); adjectives in the masculine singular, with the
  feminine after a slash when it is irregular (`heureux / heureuse`).
- `core: true` marks the 15–25 words taught in the unit lesson. The rest form the unit's
  word bank, which feeds Word of the Day and reviews.
- Each example must be a natural, complete sentence that uses the word in context.

## Sentences of the day

```json
{
  "id": "s001",
  "fr": "Quand j'étais petit, je passais mes vacances chez ma grand-mère.",
  "en": "When I was little, I used to spend my holidays at my grandmother's.",
  "grammarNote": "Imparfait for habits and background in the past.",
  "grammarTag": "imparfait",
  "level": "A2+"
}
```

The app shows sentences in id order, one per day, so nothing repeats within a year.
Spread grammar points and levels across the file instead of grouping them.

## Exercises

Every exercise has `id`, `type`, `level`, `skill` (`structures`, `listening` or
`reading`), `grammarTag` and a short English `explanation` saying *why* the answer is right.

| `type` | Extra fields | Notes |
| --- | --- | --- |
| `mcq` | `prompt`, `promptFr?`, `options`, `answer` | `answer` is an index. Use `___` in `promptFr` for a gap. |
| `fill_blank` | `prompt`, `sentence`, `answers`, `hint?`, `translation` | `sentence` has exactly one `___`. List every acceptable answer. |
| `conjugation` | `verb`, `tense`, `person`, `answers` | Answers **without** the subject (`sommes allés`). Include agreement variants. |
| `reorder` | `prompt`, `tokens`, `translation` | Tokens in the **correct** order; the app shuffles them. Avoid repeated tokens. |
| `match` | `prompt`, `pairs` | 3–5 pairs, French on the left. |
| `translate` | `direction`, `source`, `answers` | List several natural answers; matching ignores case and punctuation. |
| `dictation` | `text`, `translation` | Short (6–14 words). The learner hears it and types it. |

Answer matching ignores case, extra spaces, final punctuation and apostrophe style
(' vs ’). Missing accents count as "almost right" and are flagged to the learner.

## Listening and reading

Listening items hold a script (`lines` with `speaker` and `fr`), a `context` line in
English, a `translation`, and 2–4 multiple-choice `questions`. Reading items hold `text`
(use `\n` for line breaks), a `translation` and 2–4 questions. Questions are written in
English or French, with 3–4 options.

## Writing and speaking

Writing tasks follow the TCF written-expression format: a short message (60–120 words),
a description or account (120–150 words), and an argued opinion (120–180 words). Give
`promptFr` as it would appear on the exam, a `modelAnswer` within the word range, and a
self-assessment `checklist`.

Speaking tasks follow the three TCF oral tasks: `entretien` (guided interview, no prep),
`interaction` (role-play after 2 minutes' prep), and `opinion` (give and justify a point
of view). Give `prepSeconds`, `speakSeconds`, a `modelAnswer` and `tips`.

## Quality rules

- Write everything originally. Do not copy official TCF questions or textbook material.
- Use natural, current standard (metropolitan) French with correct accents, agreement,
  elision and typographic spaces before `? ! : ;` left as normal spaces.
- Explanations are in English; examples are in French with an English translation.
- Every wrong option in a multiple-choice question must be clearly wrong for a reason a
  learner can understand.

## Curriculum map

| Unit | Level | Theme | Grammar focus |
| --- | --- | --- | --- |
| u01 | A2 | Daily life and introductions | Present tense of common irregular verbs; basic negation |
| u02 | A2 | Family and relationships | Passé composé with avoir and être |
| u03 | A2 | Housing | Imparfait for descriptions and habits |
| u04 | A2 | Food and shopping | Articles and partitives; en for quantities |
| u05 | A2 | Getting around town | The pronoun y; prepositions of place; imperative |
| u06 | A2+ | Health and the body | Direct object pronouns (le, la, les) |
| u07 | A2+ | Work | Indirect object pronouns (lui, leur); futur proche |
| u08 | A2+ | Leisure and free time | Passé composé vs imparfait |
| u09 | A2+ | Travel and holidays | Futur simple |
| u10 | A2+ | Administration and services | Relative pronouns qui, que, où |
| u11 | B1 | Studies and training | Comparatives and superlatives |
| u12 | B1 | Media and information | Reported speech (present reporting verb) |
| u13 | B1 | The environment | Conditionnel présent; si + imparfait |
| u14 | B1 | Opinions and debate | Connectors: cependant, pourtant, donc, alors que… |
| u15 | B1 | Money and consumption | Subjonctif présent after il faut que, vouloir que |
| u16 | B1 | Plans and ambitions | Subjonctif after emotion and doubt; pour que / afin de |
| u17 | B1 | Culture and society | The relative pronoun dont; ce qui / ce que |
| u18 | B1 | Job applications and interviews | Advanced negation (personne, aucun, ne… que); y and en together |
