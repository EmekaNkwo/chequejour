/**
 * First-launch and every-launch setup: schema migrations, content seeding and the
 * install date. Runs before any screen renders.
 */
import { seedContentIfNeeded } from '../../data/content-seed';
import { migrate } from '../../data/migrations';
import { loadSettings, saveSetting } from '../../data/settings-repo';
import type { SqlDb } from '../../data/sql';
import type { ContentBundle } from '../../domain/content-types';
import { toDayKey } from '../../domain/dates';

// The compiled content bundle ships inside the app; nothing is downloaded.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundle = require('../../content/build/content.json') as ContentBundle;

/** Kept from the app's first name so installs update in place with their data. */
export const DATABASE_NAME = 'chequejour.db';

export async function initDatabase(db: SqlDb): Promise<void> {
  await migrate(db);
  await seedContentIfNeeded(db, bundle);
  const settings = await loadSettings(db);
  if (!settings.installDay) await saveSetting(db, 'installDay', toDayKey(new Date()));
}
