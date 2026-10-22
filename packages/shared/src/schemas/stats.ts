import { z } from 'zod';
import { jobStatusSchema } from './job';

export const statsPeriodSchema = z.enum(['30', '90', '365', 'all']);
export type StatsPeriod = z.infer<typeof statsPeriodSchema>;

export const statsQuerySchema = z.object({
  period: statsPeriodSchema.default('30'),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

/** A recent job row for the dashboard's activity list. */
export const jobSummarySchema = z.object({
  id: z.number().int(),
  documentId: z.number().int(),
  documentTitle: z.string().nullable(),
  status: jobStatusSchema,
  cost: z.number().int().nullable(),
  error: z.string().nullable(),
  updatedAt: z.number().int(),
});
export type JobSummary = z.infer<typeof jobSummarySchema>;

/** Dashboard snapshot: queue depth, review backlog, token spend, throughput, recent jobs. */
export const statsSchema = z.object({
  queue: z.object({
    queued: z.number().int(),
    running: z.number().int(),
    done: z.number().int(),
    failed: z.number().int(),
  }),
  pendingReview: z.number().int(),
  tokenSpend: z.number().int(),
  /** Jobs completed in the selected period. */
  throughput: z.number().int(),
  /** Share of finished jobs (done + failed) that failed in the selected period. 0..1; 0 when none have finished. */
  errorRate: z.number(),
  recentJobs: z.array(jobSummarySchema),
});
export type Stats = z.infer<typeof statsSchema>;
