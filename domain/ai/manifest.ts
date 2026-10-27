/**
 * The AI pack's model manifest (content/ai/manifest.json): which files exist, where they
 * are downloaded from, and their sizes and SHA-256 checksums. Models are chosen here,
 * not in code, so they can be swapped by editing the manifest.
 */
import { z } from 'zod';

/** Language models only: speech uses the phone's own on-device recognizer. */
export type ModelKind = 'llm';

export interface ModelEntry {
  id: string;
  kind: ModelKind;
  name: string;
  file: string;
  url: string;
  bytes: number;
  sha256: string;
  licence: string;
  source: string;
}

export interface Manifest {
  version: number;
  allowedHosts: readonly string[];
  /** Language model per tier; the low tier gets none. */
  llm: { high: string; mid: string };
  models: readonly ModelEntry[];
}

const modelSchema = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  kind: z.literal('llm'),
  name: z.string().min(1),
  file: z.string().regex(/^[A-Za-z0-9._-]+$/),
  url: z.string().url().refine((u) => new URL(u).protocol === 'https:', 'Model URLs must use https'),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  licence: z.string().min(1),
  source: z.string().min(1),
});

const manifestSchema = z.object({
  version: z.number().int().positive(),
  allowedHosts: z.array(z.string().min(1)).min(1),
  llm: z.object({ high: z.string(), mid: z.string() }),
  models: z.array(modelSchema).min(1),
});

/** Validates the manifest and every cross-reference in it; throws with the first problem. */
export function parseManifest(raw: unknown): Manifest {
  const manifest = manifestSchema.parse(raw);
  const byId = new Map<string, ModelEntry>();
  for (const model of manifest.models) {
    if (byId.has(model.id)) throw new Error(`Model ${model.id} is listed twice`);
    const host = new URL(model.url).hostname;
    if (!manifest.allowedHosts.includes(host)) throw new Error(`Model ${model.id} is hosted on ${host}, which is not an allowed host`);
    byId.set(model.id, model);
  }
  const expect = (id: string, kind: ModelKind) => {
    const model = byId.get(id);
    if (!model) throw new Error(`The manifest refers to ${id}, which isn't listed`);
    if (model.kind !== kind) throw new Error(`${id} is used as an ${kind} model but is ${model.kind}`);
  };
  expect(manifest.llm.high, 'llm');
  expect(manifest.llm.mid, 'llm');
  return manifest;
}

export function modelById(manifest: Manifest, id: string): ModelEntry {
  const model = manifest.models.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model ${id}`);
  return model;
}
