import bundleJson from '../content/build/content.json';
import { ContentRepository } from '../data/content-repo';
import { seedContentIfNeeded } from '../data/content-seed';
import { migrate } from '../data/migrations';
import { ProgressRepository } from '../data/progress-repo';
import { DEFAULT_SETTINGS, type Settings } from '../data/settings-repo';
import type { ContentBundle } from '../domain/content-types';
import { createNodeDb } from './node-db';

export const realBundle = bundleJson as unknown as ContentBundle;

export interface RealApp {
  db: ReturnType<typeof createNodeDb>;
  content: ContentRepository;
  progress: ProgressRepository;
  settings: Settings;
}

/** An in-memory database migrated and seeded with the shipped content bundle. */
export async function setupRealContent(settings: Partial<Settings> = {}): Promise<RealApp> {
  const db = createNodeDb();
  await migrate(db);
  await seedContentIfNeeded(db, realBundle);
  return { db, content: new ContentRepository(db), progress: new ProgressRepository(db), settings: { ...DEFAULT_SETTINGS, ...settings } };
}
