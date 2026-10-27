/**
 * Validates content. Usage:
 *   npm run content:validate              # everything
 *   npx tsx content/scripts/validate.ts content/source/units/u03.json   # one unit
 */
import { checkUnit, loadAll, loadUnit, summarize, type Report } from './load';

function print(report: Report): void {
  for (const w of report.warnings) process.stdout.write(`warn  ${w}\n`);
  for (const e of report.errors) process.stdout.write(`ERROR ${e}\n`);
}

const report: Report = { errors: [], warnings: [] };
const files = process.argv.slice(2);

if (files.length > 0) {
  for (const f of files) {
    const unit = loadUnit(f, report);
    if (unit) {
      checkUnit(unit, report);
      process.stdout.write(
        `${unit.id}: ${unit.vocab.length} words (${unit.vocab.filter((v) => v.core).length} core), ` +
          `${unit.exercises.length} exercises, ${unit.checkpoint.length} checkpoint\n`,
      );
    }
  }
} else {
  const bundle = loadAll(report);
  process.stdout.write(`${summarize(bundle)}\n`);
}

print(report);
process.stdout.write(report.errors.length === 0 ? 'OK\n' : `${report.errors.length} error(s)\n`);
process.exit(report.errors.length === 0 ? 0 : 1);
