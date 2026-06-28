import { Monitor, Moon, Sun } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { useVersion, versionKeys } from '@/api/version';
import { PageSection } from '@/components/ui/page-section';
import { SwitchRow } from '@/components/ui/switch-row';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import type { Theme } from '@/store/settings.slice';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function GeneralPage() {
  const { theme, setTheme } = useTheme();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const version = useVersion();
  const queryClient = useQueryClient();

  const checkForUpdates = settings.data?.checkForUpdates ?? true;
  const setCheckForUpdates = (value: boolean) => {
    updateSettings.mutate(
      { checkForUpdates: value },
      {
        // Toggling the check flips whether the backend reaches out to the site,
        // so re-resolve the update status straight away.
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: versionKeys.all }),
      },
    );
  };

  return (
    <div className="space-y-8">
      <PageSection
        title="Appearance"
        description="Choose how Paperless Starfruit looks on this device."
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              “System” follows your operating system’s appearance.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Updates"
        description="Get notified in the sidebar when a newer version is released."
      >
        <div className="space-y-4">
          <SwitchRow
            label="Check for updates"
            hint="Periodically checks for a newer release. Only the version number is fetched — no document data ever leaves your instance."
            checked={checkForUpdates}
            onCheckedChange={setCheckForUpdates}
            disabled={!settings.data || updateSettings.isPending}
          />
          {version.data && (
            <p className="text-xs text-muted-foreground">
              You’re on v{version.data.current}
              {version.data.updateAvailable && version.data.latest ? (
                <>
                  {' · '}
                  {version.data.releaseUrl ? (
                    <a
                      href={version.data.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground underline underline-offset-2"
                    >
                      v{version.data.latest} available
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">
                      v{version.data.latest} available
                    </span>
                  )}
                </>
              ) : version.data.latest ? (
                ' · up to date'
              ) : null}
            </p>
          )}
        </div>
      </PageSection>
    </div>
  );
}
