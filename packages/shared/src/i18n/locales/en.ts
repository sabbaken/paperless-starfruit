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
    saved: 'Saved',
    saveFailed: 'Save failed',
    retry: 'Retry',
    retrying: 'Retrying…',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    none: 'None',
    required: 'Required',
    optional: 'Optional',
    search: 'Search',
    enabled: 'Enabled',
    disabled: 'Disabled',
    test: 'Test',
    reset: 'Reset',
    refresh: 'Refresh',
    apply: 'Apply',
    confirm: 'Confirm',
    copy: 'Copy',
    copied: 'Copied',
  },
  // Web-only display copy for provider kinds. `const.ts` PROVIDER_KIND_META stays
  // the source of the enum + behaviour flags (and is used server-side); these are
  // just the UI labels, looked up by kind so they can be translated.
  providerKinds: {
    anthropic: { label: 'Anthropic', description: 'Claude models' },
    openai: { label: 'OpenAI', description: 'GPT / o-series models' },
    google: { label: 'Google', description: 'Gemini models' },
    mistral: { label: 'Mistral', description: 'Mistral / Pixtral models' },
    'openai-compatible': {
      label: 'OpenAI-compatible',
      description: 'Local & self-hosted: Ollama, LM Studio, vLLM, OpenRouter',
    },
  },
  // Display labels for audit-log decisions. The values stay identifiers (`const.ts`
  // AUDIT_DECISIONS); only these labels — equal to the identifier in English today
  // — are translated. `unknown` covers a null decision.
  auditDecisions: {
    'auto-applied': 'auto-applied',
    'review-queued': 'review-queued',
    'ocr-only': 'ocr-only',
    skipped: 'skipped',
    approved: 'approved',
    rejected: 'rejected',
    unknown: 'unknown',
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
