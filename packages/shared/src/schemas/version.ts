import { z } from 'zod';

/**
 * The public release manifest, served as a static file from the website
 * (`/version.json`). The backend fetches and validates it to learn the latest
 * published version. Everything but `version` is optional so the manifest can
 * grow without breaking older instances.
 */
export const versionManifestSchema = z.object({
  version: z.string().min(1),
  releaseUrl: z.string().url().optional(),
});
export type VersionManifest = z.infer<typeof versionManifestSchema>;

/**
 * Resolved update status returned by `GET /api/version`. The backend compares
 * its own running build (`current`) against the manifest's `latest`. `latest`
 * is `null` when update checks are disabled or the manifest couldn't be fetched.
 */
export const versionInfoSchema = z.object({
  current: z.string(),
  latest: z.string().nullable(),
  updateAvailable: z.boolean(),
  releaseUrl: z.string().url().nullable(),
});
export type VersionInfo = z.infer<typeof versionInfoSchema>;
