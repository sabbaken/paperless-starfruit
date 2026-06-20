import { useQuery } from '@tanstack/react-query';
import { settingsApi } from './settings.api';
import { settingsKeys } from './settings.keys';

/** Processing settings (models, polling, language, blacklist…). */
export function useSettings() {
  return useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.get });
}
