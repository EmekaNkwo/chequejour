/**
 * Generates missing audio clips with the macOS French system voice (`say`), then
 * converts them to AAC (.m4a) with `afconvert`. Run on a Mac:
 *
 *   npm run content:audio            # generate missing clips
 *   npm run content:audio -- --force # regenerate everything
 *
 * Clips are only made for personal builds of the app. Check the voice's licence
 * before distributing generated audio. Any other TTS engine or recorded audio can
 * replace these files as long as the names (<audio key>.m4a) stay the same.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cpus, tmpdir } from 'node:os';
import { collectAudioClips, type AudioClip } from '../../domain/audio-keys';
import { AUDIO_DIR, AUDIO_EXT, loadAll, type Report } from './load';

const VOICE = process.env.CHEQUEJOUR_VOICE ?? 'Thomas';
const RATE_WPM = '170';
const force = process.argv.includes('--force');
const run = promisify(execFile);

async function synthesize(clip: AudioClip, workDir: string): Promise<void> {
  const aiff = join(workDir, `${clip.key}.aiff`);
  const out = join(AUDIO_DIR, `${clip.key}${AUDIO_EXT}`);
  // Line breaks in dialogues become short pauses.
  const text = clip.text.replace(/\n/g, ' [[slnc 450]] ');
  await run('say', ['-v', VOICE, '-r', RATE_WPM, '-o', aiff, text]);
  await run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', aiff, out]);
  rmSync(aiff, { force: true });
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    process.stdout.write('Audio generation uses macOS `say`; run it on a Mac.\n');
    process.exit(1);
  }
  const report: Report = { errors: [], warnings: [] };
  const bundle = loadAll(report);
  if (report.errors.length > 0) {
    process.stdout.write('Fix content errors first (npm run content:validate).\n');
    process.exit(1);
  }
  mkdirSync(AUDIO_DIR, { recursive: true });
  const unique = new Map(collectAudioClips(bundle).map((c) => [c.key, c]));
  const todo = [...unique.values()].filter((c) => force || !existsSync(join(AUDIO_DIR, `${c.key}${AUDIO_EXT}`)));
  process.stdout.write(`${todo.length} clip(s) to generate with voice "${VOICE}".\n`);

  const workDir = join(tmpdir(), 'chequejour-audio');
  mkdirSync(workDir, { recursive: true });
  const workers = Math.max(1, Math.min(8, cpus().length - 1));
  let next = 0;
  let done = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < todo.length) {
        const clip = todo[next];
        next += 1;
        try {
          await synthesize(clip, workDir);
        } catch (error: unknown) {
          failures.push(`${clip.key}: ${error instanceof Error ? error.message : String(error)}`);
        }
        done += 1;
        if (done % 200 === 0) process.stdout.write(`  ${done}/${todo.length}\n`);
      }
    }),
  );
  for (const f of failures) process.stdout.write(`FAILED ${f}\n`);
  process.stdout.write(`Done: ${done - failures.length} generated, ${failures.length} failed. Now run npm run content:build.\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
