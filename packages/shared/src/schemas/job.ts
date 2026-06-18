import { z } from 'zod';
import { JOB_STATUS } from '../const';

export const jobStatusSchema = z.enum([
  JOB_STATUS.QUEUED,
  JOB_STATUS.RUNNING,
  JOB_STATUS.DONE,
  JOB_STATUS.FAILED,
]);
