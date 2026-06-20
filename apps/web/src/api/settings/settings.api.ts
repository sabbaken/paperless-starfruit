import type { Settings, SettingsUpdate } from '@paperless-ai/shared';
import { http } from '@/api/http';

export const settingsApi = {
  get: () => http.get<Settings>('/settings'),

  update: (patch: SettingsUpdate) => http.patch<Settings>('/settings', patch),
};
