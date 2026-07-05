import { z } from 'zod';

/**
 * The subset of a GitHub "latest release" response the update check reads
 * (`GET /repos/{owner}/{repo}/releases/latest`). The backend fetches and
 * validates it to learn the latest published version; `tag_name` is the
 * release tag (e.g. `v1.2.0`), `html_url` the release page to link to.
 */
export const latestReleaseSchema = z.object({
  tag_name: z.string().min(1),
  html_url: z.string().url().optional(),
});
export type LatestRelease = z.infer<typeof latestReleaseSchema>;

/**
 * Resolved update status returned by `GET /api/version`. The backend compares
 * its own running build (`current`) against the release's `latest`. `latest`
 * is `null` when update checks are disabled or the release couldn't be fetched.
 */
export const versionInfoSchema = z.object({
  current: z.string(),
  latest: z.string().nullable(),
  updateAvailable: z.boolean(),
  releaseUrl: z.string().url().nullable(),
});
export type VersionInfo = z.infer<typeof versionInfoSchema>;
