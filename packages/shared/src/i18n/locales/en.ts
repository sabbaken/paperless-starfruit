/**
 * English dictionary — the single source of truth for the UI's copy and, via
 * `typeof en`, the translation contract every other locale is checked against.
 *
 * Conventions:
 * - Namespaced by area (`common`, `general`, `nav`, page/feature names, `site`).
 * - `common` holds strings reused across many screens; a string used on one
 *   screen lives in that screen's namespace.
 * - Interpolate with `{{var}}` placeholders (see `createT`). No plural engine —
 *   English-only for now; a value like `'{{count}} tag(s)'` is a deliberate
 *   pseudo-plural to revisit when a real plural locale is added.
 *
 * Adding a locale later: create a sibling `ru.ts` exporting
 * `export const ru = { … } satisfies Messages` — every missing/renamed key is a
 * compile error right there — then register it in `dictionaries` and `LOCALES`.
 */
export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    add: 'Add',
    remove: 'Remove',
    loading: 'Loading…',
    saving: 'Saving…',
    retry: 'Retry',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    none: 'None',
    required: 'Required',
    optional: 'Optional',
    search: 'Search',
    enabled: 'Enabled',
    disabled: 'Disabled',
  },
  general: {
    theme: 'Theme',
    themeLight: 'Light',
    themeSystem: 'System',
    themeDark: 'Dark',
    uiLanguage: 'UI language',
    languagePlaceholder: 'Select language',
    languageSearch: 'Search languages',
    languageEmpty: 'No language found',
    checkForUpdates: 'Check for updates',
    checkForUpdatesHint: 'Sidebar notice on new releases. Only the version number is fetched.',
    currentVersion: 'You’re on v{{version}}',
    versionAvailable: 'v{{version}} available',
    upToDate: 'up to date',
  },
} as const;
