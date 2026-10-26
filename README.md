# Chaque Jour — offline daily French trainer (A2 → B1, TCF)

A calm daily French habit for English speakers going from CEFR A2 to B1 and preparing for
the TCF. Everything — lessons, 1,500+ words, 380 sentences of the day, exercises, audio —
ships inside the app. No account, no server, no analytics, no ads. It works in airplane
mode from the first launch.


> **Name.** The app was first called *Chèque du jour*. Technical identifiers keep the old
> spelling on purpose (Android package and iOS bundle `com.emeka.chequejour`, URL scheme
> `chequejour://`, database `chequejour.db`, backup id `chequejour`) so existing installs
> update in place and every old backup still restores.

## Run it locally

Requirements: Node 20+, Android Studio (emulator or a USB device) or an EAS account.
Expo Go is **not** supported (the app uses native modules: SQLite, notifications, audio
recording), so you need a development build.

```bash
npm install
npm run content:build        # compiles content/source → content/build (already committed)
npx expo run:android         # builds and installs a development build, then starts Metro
```

Day to day, after the dev build is installed: `npm start`.

## Build an installable APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # APK you can sideload
```

The `preview` profile in `eas.json` produces an `.apk`; `production` produces an `.aab`
for the Play Store. Download the APK from the link EAS prints and open it on the phone.

## Checks

```bash
npm test                  # Jest: domain logic, data layer, notifications, contrast
npm run typecheck         # TypeScript strict
npm run lint              # expo lint
npm run content:validate  # every item has a level, translation, audio, valid answers
npm run check:offline     # no network calls or phone-home dependencies
npm run e2e               # Maestro flows in e2e/ (needs a device/emulator + Maestro CLI)
```

`e2e/01-offline-first-launch.yaml` switches the emulator to airplane mode, clears app
data and runs onboarding and every tab — the automated version of "works offline from a
fresh install". To check by hand: install the APK, turn on airplane mode, *then* open the
app for the first time.

## Curriculum

18 themed units, unlocked in order. Each unit has 15–25 core words plus a word bank
(1,512 items in total), two grammar lessons, practice sets, a listening and a reading
text with questions, a TCF-style writing task (model answer + checklist), a speaking
prompt (timer, recording, model answer) and an end-of-unit checkpoint (pass mark 70%).

| # | Level | Theme | Grammar |
|---|---|---|---|
| 1 | A2 | Daily life and introductions | Irregular present; ne… pas / jamais / plus / rien |
| 2 | A2 | Family and relationships | Passé composé with avoir, with être + agreement |
| 3 | A2 | Housing | Imparfait: form; descriptions and habits |
| 4 | A2 | Food and shopping | Articles and partitives; quantities and *en* |
| 5 | A2 | Getting around town | Prepositions of place and *y*; imperative |
| 6 | A2+ | Health and the body | COD pronouns; pronouns in PC and imperative |
| 7 | A2+ | Work | COI *lui/leur*; futur proche |
| 8 | A2+ | Leisure and free time | Passé composé vs imparfait |
| 9 | A2+ | Travel and holidays | Futur simple; *quand/si* + future |
| 10 | A2+ | Administration and services | *qui, que, où* |
| 11 | B1 | Studies and training | Comparatives and superlatives |
| 12 | B1 | Media and information | Reported speech |
| 13 | B1 | The environment | Conditionnel; *si* + imparfait |
| 14 | B1 | Opinions and debate | Connectors: *cependant, pourtant, alors que, donc* |
| 15 | B1 | Money and consumption | Subjonctif: form; *il faut que, vouloir que* |
| 16 | B1 | Plans and ambitions | Subjonctif after emotion/doubt; purpose |
| 17 | B1 | Culture and society | *dont*; *ce qui / ce que / ce dont* |
| 18 | B1 | Job applications and interviews | Advanced negation; pronoun order |

A 24-question placement test at first launch can start you at unit 1, 6 or 11 (earlier
units stay open).

### TCF Canada mock tests and NCLC estimate

Two original mock tests follow the TCF Canada format, set in `domain/tcf/exam-format.ts`
(counts, timings and word ranges live there, not in the screens):

| Test | Format | Time |
| --- | --- | --- |
| Compréhension orale | 39 questions, rising difficulty (A1 → B2), each recording plays **once** | 35 min |
| Compréhension écrite | 39 questions, rising difficulty | 60 min |
| Expression écrite | Task 1 message 60–120 words · Task 2 account 120–150 · Task 3 compare two documents + opinion 120–180 | 60 min for all three |
| Expression orale | Task 1 interview 2 min · Task 2 role-play 2 min prep + 3 min 30 · Task 3 opinion 4 min 30 | ≈ 12 min |

Take the full mock or any one test. Each test has its own countdown and ends by itself;
answers and explanations come at the end. Writing and speaking are self-assessed against
model answers. Results are kept as mock history. Mocks unlock near B1, once every A2/A2+
unit is done, or as soon as you set an exam date.

**Per-skill estimate** (Progress → Your level): each of the four skills gets a CEFR band
(A2 / A2+ / B1) and an approximate NCLC, from your latest mock (harder questions earn more
points) blended with recent practice. The weakest skill is highlighted, with the gap to
your target NCLC (default 7, Settings). These are **practice estimates**; the NCLC screen
says so and points to IRCC for official requirements. Details: `domain/tcf/nclc.ts`.

**Exam date** (optional, onboarding or Settings): Home shows a countdown ("63 days to your
TCF"). From 60 days out, sessions add extra practice in the weakest skill; in the last
14 days they drop the structures exercise and add a daily timed, mock-style set. Exam
date and target are included in backups. Details: `domain/tcf/exam-plan.ts`.

### The daily session

Built automatically each day: due reviews (spaced repetition, FSRS via `ts-fsrs`) →
up to 3 mistakes to retry → the next lesson segment of your current unit → one skill
exercise, rotating listening, reading, structures, writing, speaking (weighted towards
your weakest skill when an exam date is near). Review count scales
with the daily goal (10/15/20 min). Words and sentences of the day join the review queue
when you open them.

### Word and Sentence of the Day

Local notifications only (no push server), defaults 08:00 and 18:00, each can be moved
or turned off. Two weeks are scheduled ahead, and the schedule is rebuilt on every
launch and whenever the app returns to the foreground, so it survives restarts,
time-zone changes and days the app isn't opened. Both follow your level (the level of
the unit you're on): words and sentences at that level come first, then easier ones once
it's used up, then harder ones. Within a level, words from units you've unlocked come
first. When you move up a level, the upcoming days you haven't opened are re-picked at
the new level; today's items stay as announced. Headwords never repeat until all are
used, and the 380 sentences don't repeat within a year.

**Missed-day reminders** (on by default, 19:30, Settings → Notifications): if you haven't
studied, a reminder comes after 1, 2, 4, 7 and 12 missed days, then weekly. It is counted
from your last real study day, so it never fires on a day you studied, gets firmer as the
break grows, includes your TCF countdown if you set a date, and opens today's session.
Reminders use their own Android channel, so they can be silenced separately.

### Audio, feedback and messages

Every clip has Play and Replay plus a speed row (0.5×, 0.75×, 1×, 1.25×, 1.5×). The speed
applies to bundled clips and the text-to-speech fallback, changes what is playing straight
away, and is remembered (also under Settings → Audio). Answer feedback, confirmations and
errors appear as toasts at the top of the screen (`components/ui/Toast.tsx`); the app
never uses the system alert dialog. Wrong-answer toasts stay up to 10 seconds, depending
on length, and clear when you continue; confirmations close if you leave the screen.

### Logo and icons

The mark is a tear-off day-calendar page (*chaque jour*: every day) with a French
blue-white-red header, a bold **J** for *Jour*, and a speech-bubble tail (a language you
speak), on the app's navy. Its geometry lives in `components/brand/logo-geometry.ts` and
feeds both the in-app `<Logo />` and `npm run brand:build`, which writes the app icon,
Android adaptive and themed-icon layers, notification icon, splash image, favicon and the
logo lockups in `assets/brand/`. Native icons, the splash and the app name on the home
screen only change after a rebuild.

## How the level estimate works

The A2 → B1 bar is a **practice estimate**, not an official TCF score and not a
prediction of one. On a 0–1 scale (A2 = 0, B1 = 1):

```
estimate = max(placement baseline,
               0.45 × units completed / 18
             + 0.25 × mastered cards / 600
             + 0.30 × demonstrated level)
```

*Demonstrated level* uses your last 120 answers: a correct answer earns its item's level
weight (A2 0.2, A2+ 0.6, B1 1.0), scaled down until you have 30 answers. Labels: A2 below
0.35, A2+ from 0.35, B1 from 0.75. A card counts as mastered when FSRS stability reaches
21 days. Details: `domain/level.ts`.

## Project layout

```
app/          Expo Router screens (tabs: Home, Learn, Practice, Progress)
components/   UI kit, theme tokens, exercise renderers, audio controls
features/     app services: session, daily items, notifications, audio, progress
domain/       pure TypeScript learning logic (SRS, session builder, scoring, level)
data/         SQLite access, migrations, backup/restore
content/      source JSON, validation and build scripts → content/build
assets/audio  bundled clips (<audio key>.m4a)
assets/brand  logo source (mark.svg) and lockups
e2e/          Maestro flows
```

Adding content: see [docs/CONTENT_AUTHORING.md](docs/CONTENT_AUTHORING.md).

## Limits and known gaps

- **Audio** is synthesised with the macOS "Thomas" voice (`npm run content:audio`), not
  recorded by native speakers. Check that voice's licence before distributing the app
  beyond personal use. Missing clips fall back to the phone's French text-to-speech.
- **Writing and speaking are self-assessed** against a model answer and checklist. The app
  can't grade free text or pronunciation offline.
- **Two mock tests** ship; more can be added as JSON (`content/source/mock-tests/`). The
  final-stretch practice sets reuse their questions, so they repeat after a few weeks.
- **NCLC is approximate.** The app's score-to-NCLC scale is its own, not the official
  TCF Canada conversion, and writing/speaking rely on self-assessment.
- **Content review**: all French was written originally for this app (no TCF or textbook
  material). The validation script checks structure, answers and duplicates, but the
  language itself has not yet been reviewed by a native-speaker teacher. Fix errors by
  editing the JSON.
- **Exact timing**: on Android 12+ notifications may arrive a few minutes late unless you
  allow "Alarms & reminders" (Settings → Notifications in the app links to it). Aggressive
  battery savers on some phones can delay them further.
- **iOS** builds should work but v1 is only tested on Android.
- Recordings and backups stay on the device; uninstalling the app deletes them, so
  export a backup first.
