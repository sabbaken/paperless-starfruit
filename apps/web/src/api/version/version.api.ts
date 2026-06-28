import type { VersionInfo } from '@paperless-starfruit/shared';
import { http } from '@/api/http';

export const versionApi = {
  get: () => http.get<VersionInfo>('/version'),
};
