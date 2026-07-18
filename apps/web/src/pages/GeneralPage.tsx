import { Monitor, Moon, Sun } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { LOCALES, type Locale } from '@paperless-starfruit/shared';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { useVersion, versionKeys } from '@/api/version';
import { LanguageCombobox } from '@/components/language-combobox';
import { SwitchRow } from '@/components/ui/switch-row';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

const languageOptions = LOCALES.map((locale) => ({
  code: locale.code,
  name: locale.label,
  emoji: locale.flag,
}));

export function GeneralPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const version = useVersion();
  const queryClient = useQueryClient();

  const themeOptions = [
    { value: 'light', label: t('general.themeLight'), icon: Sun },
    { value: 'system', label: t('general.themeSystem'), icon: Monitor },
    { value: 'dark', label: t('general.themeDark'), icon: Moon },
  ] as const;

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
    // Each setting is one row. The page header already names the page, so no
    // section chrome, and every hint is at most one short line.
    <div className="divide-y">
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="text-sm font-medium">{t('general.theme')}</p>
        <div
          role="radiogroup"
          aria-label={t('general.theme')}
          className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
        >
          {themeOptions.map(({ value, label, icon: Icon }) => {
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

      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="text-sm font-medium">{t('general.uiLanguage')}</p>
        <div className="w-full sm:w-56">
          <LanguageCombobox
            value={language}
            onChange={(code) => setLanguage(code as Locale)}
            options={languageOptions}
            placeholder={t('general.languagePlaceholder')}
            searchPlaceholder={t('general.languageSearch')}
            emptyText={t('general.languageEmpty')}
            align="end"
          />
        </div>
      </div>

      <div className="space-y-2 py-4">
        <SwitchRow
          label={t('general.checkForUpdates')}
          hint={t('general.checkForUpdatesHint')}
          checked={checkForUpdates}
          onCheckedChange={setCheckForUpdates}
          disabled={!settings.data || updateSettings.isPending}
        />
        {version.data && (
          <p className="text-xs text-muted-foreground">
            {t('general.currentVersion', { version: version.data.current })}
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
                    {t('general.versionAvailable', { version: version.data.latest })}
                  </a>
                ) : (
                  <span className="font-medium text-foreground">
                    {t('general.versionAvailable', { version: version.data.latest })}
                  </span>
                )}
              </>
            ) : version.data.latest ? (
              <>
                {' · '}
                {t('general.upToDate')}
              </>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
