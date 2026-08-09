import type { Messages } from '../types';

/**
 * German dictionary. Checked against `Messages` (the shape of `en`) via
 * `satisfies`, so a missing or renamed key is a compile error right here.
 *
 * Conventions mirror `en.ts`:
 * - Same namespaces and keys as English; only the values are translated.
 * - `{{var}}` placeholders and any HTML (`<code>`, `<br>`, entities) are kept
 *   verbatim — only the surrounding prose is translated.
 * - Formal address (Sie); buttons and menu actions use the infinitive
 *   (`Speichern`, `Abbrechen`), which is the German UI norm.
 * - No plural engine, so count strings avoid a declining noun: either a neutral
 *   `Nomen: {{count}}` shape (`'Tags: {{count}}'`) or an invariant tail
 *   (`'{{count}} in Arbeit'`) rather than an inflected one.
 * - Glossary, kept consistent throughout: tag → Tag/Tags (neuter, `das Tag`, as
 *   in paperless-ngx's own German UI — not `der Tag` = day), correspondent →
 *   Korrespondent, review → Prüfung/prüfen (a connectivity check is
 *   `überprüfen`), approve → freigeben, extraction → Extraktion, prompt →
 *   Prompt, provider → Anbieter, API key → API-Schlüssel, AI → KI, run (noun) →
 *   Durchlauf, poll → Abruf, queue → Warteschlange/einreihen.
 * - Proper nouns stay as-is: paperless-ngx, Starfruit, Docker, GitHub, Ko-fi,
 *   Anthropic, OpenAI, Google, Mistral, Ollama, LM Studio, vLLM, OpenRouter.
 */
export const de = {
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schließen',
    add: 'Hinzufügen',
    remove: 'Entfernen',
    loading: 'Wird geladen…',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    saveFailed: 'Speichern fehlgeschlagen',
    retry: 'Wiederholen',
    retrying: 'Wird wiederholt…',
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    none: 'Keine',
    required: 'Pflichtfeld',
    optional: 'Optional',
    search: 'Suchen',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    test: 'Testen',
    reset: 'Zurücksetzen',
    refresh: 'Aktualisieren',
    apply: 'Anwenden',
    confirm: 'Bestätigen',
    copy: 'Kopieren',
    copied: 'Kopiert',
  },
  // Web-only display copy for provider kinds. `const.ts` PROVIDER_KIND_META stays
  // the source of the enum + behaviour flags (and is used server-side); these are
  // just the UI labels, looked up by kind so they can be translated.
  providerKinds: {
    anthropic: { label: 'Anthropic', description: 'Claude-Modelle' },
    openai: { label: 'OpenAI', description: 'GPT-/o-Modelle' },
    google: { label: 'Google', description: 'Gemini-Modelle' },
    mistral: { label: 'Mistral', description: 'Mistral-/Pixtral-Modelle' },
    'openai-compatible': {
      label: 'OpenAI-kompatibel',
      description: 'Lokal & selbst gehostet: Ollama, LM Studio, vLLM, OpenRouter',
    },
  },
  // Display labels for audit-log decisions. The values stay identifiers (`const.ts`
  // AUDIT_DECISIONS); only these labels — equal to the identifier in English today
  // — are translated. `unknown` covers a null decision.
  auditDecisions: {
    'auto-applied': 'automatisch angewendet',
    'review-queued': 'zur Prüfung eingereiht',
    'ocr-only': 'nur OCR',
    skipped: 'übersprungen',
    approved: 'freigegeben',
    rejected: 'abgelehnt',
    unknown: 'unbekannt',
  },
  general: {
    theme: 'Erscheinungsbild',
    themeLight: 'Hell',
    themeSystem: 'System',
    themeDark: 'Dunkel',
    uiLanguage: 'Anzeigesprache',
    languagePlaceholder: 'Sprache wählen',
    languageSearch: 'Sprachen suchen',
    languageEmpty: 'Keine Sprache gefunden',
    checkForUpdates: 'Nach Updates suchen',
    checkForUpdatesHint:
      'Hinweis in der Seitenleiste bei neuen Versionen. Es wird nur die Versionsnummer abgerufen.',
    currentVersion: 'Sie nutzen v{{version}}',
    versionAvailable: 'v{{version}} verfügbar',
    upToDate: 'aktuell',
  },
  apiKeys: {
    encryptedNote:
      'Schlüssel werden verschlüsselt gespeichert und nie an den Browser zurückgegeben.',
    addLocalEndpoint: 'Lokalen Endpunkt hinzufügen',
    connected: 'Verbunden',
    addKey: 'Schlüssel hinzufügen',
    dialogAdd: '{{provider}} hinzufügen',
    dialogEdit: '{{provider}} bearbeiten',
    name: 'Name',
    namePlaceholder: 'Ollama (Laptop)',
    baseUrl: 'Basis-URL',
    baseUrlPlaceholder: 'http://localhost:11434/v1',
    requiredHint: '(erforderlich)',
    optionalHint: '(optional)',
    apiKey: 'API-Schlüssel',
    apiKeyEditPlaceholder: 'leer lassen, um den aktuellen Schlüssel zu behalten',
    apiKeyPlaceholder: 'API-Schlüssel für {{provider}}',
    showKey: 'Schlüssel anzeigen',
    hideKey: 'Schlüssel verbergen',
    contactingProvider: 'Anbieter wird kontaktiert…',
    reachable: 'Erreichbar',
    reachableWithLatency: 'Erreichbar · {{latency}} ms',
    testFailed: 'Test fehlgeschlagen.',
  },
  app: {
    unknownError: 'unbekannter Fehler',
    loadingLabel: 'Wird geladen',
    backendUnreachable: 'Backend nicht erreichbar',
    updateAvailable: 'Update verfügbar',
    viewRelease: 'v{{version}}: Release ansehen',
    dismissUpdateNotice: 'Update-Hinweis ausblenden',
    docLink: 'Dok. #{{id}}',
    openInPaperless: 'In paperless öffnen',
  },
  auth: {
    backendUnreachable: 'Backend nicht erreichbar',
    unknownError: 'unbekannter Fehler',
    loading: 'Wird geladen',
    username: 'Benutzername',
    password: 'Passwort',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    passwordHint: 'Mindestens 8 Zeichen.',
    createAccountError: 'Konto konnte nicht erstellt werden',
    signInError: 'Anmeldung fehlgeschlagen',
    genericError: 'Bitte erneut versuchen.',
    setup: {
      title: 'Administrator-Konto erstellen',
      description:
        'Damit beanspruchen Sie diese Instanz. Sobald das Konto existiert, ist die Registrierung geschlossen.',
      cta: 'Konto erstellen',
    },
    login: {
      title: 'Anmelden',
      description: 'Geben Sie Ihre Administrator-Zugangsdaten ein, um fortzufahren.',
      cta: 'Anmelden',
    },
  },
  dashboard: {
    pipeline: 'Dokumentenverarbeitung',
    resume: 'Fortsetzen',
    pause: 'Pausieren',
    confirmClear: 'Leeren bestätigen',
    clearQueue: 'Warteschlange leeren',
    inQueue: 'In der Warteschlange',
    runningHint: '{{count}} in Arbeit',
    awaitingReview: 'Warten auf Prüfung',
    nothingToReview: 'nichts zu prüfen',
    review: 'Prüfen',
    todayHint: '{{count}} heute',
    failed: 'Fehlgeschlagen',
    noFailures: 'keine Fehler',
    retryAll: 'Alle wiederholen',
    succeeded: '{{done}} von {{finished}} erfolgreich',
    errorRate: '{{pct}} % Fehlerquote',
    processedToday: 'Heute verarbeitet',
    tokensUsed: 'Verbrauchte Tokens',
    avgTokensPerDoc: 'Ø Tokens pro Dokument',
    recentActivity: 'Letzte Aktivität',
    retryFailed: 'Wiederholen fehlgeschlagen',
    recentEmptyPrefix: 'Noch keine Aufträge. Versehen Sie in paperless ein Dokument mit dem Tag',
    recentEmptySuffix: ', um zu starten.',
    statusHeader: 'Status',
    documentHeader: 'Dokument',
    errorHeader: 'Fehler',
    tokensHeader: 'Tokens',
    actionsLabel: 'Aktionen',
    processingPaused: 'Verarbeitung pausiert',
    processingResumed: 'Verarbeitung fortgesetzt',
    clearing: 'Wird geleert…',
    queueCleared: 'Warteschlange geleert',
    clearQueueFailed: 'Warteschlange konnte nicht geleert werden',
  },
  history: {
    searchPlaceholder: 'Prompts und Antworten durchsuchen…',
    all: 'Alle',
    emptyTitle: 'Keine passenden Durchläufe',
    emptyDescriptionBefore: 'Jedes Mal, wenn ein Dokument mit dem Tag ',
    emptyDescriptionAfter:
      ' verarbeitet wird, werden der an das Modell gesendete Prompt und seine vollständige Antwort hier zur Fehlersuche festgehalten.',
    decisionHeader: 'Entscheidung',
    documentHeader: 'Dokument',
    whenHeader: 'Zeitpunkt',
    tokensHeader: 'Tokens',
    openAria: 'Öffnen',
    view: 'ansehen →',
    runCount: 'Durchläufe: {{total}}',
    pager: '{{from}}–{{to}} von {{total}}',
    previous: 'Zurück',
    backToHistory: 'Zurück zum Verlauf',
    jobLabel: 'Auftrag #{{jobId}}',
    tokensLabel: '{{tokens}} Tokens',
    promptTitle: 'An das Modell gesendeter Prompt',
    promptEmpty:
      'Es wurde kein Prompt aufgezeichnet. Übersprungene Dokumente, reine OCR-Durchläufe und Freigaben aus der Prüfung rufen das Extraktionsmodell nicht auf.',
    responseTitle: 'Antwort des Modells',
    responseEmpty: 'Für diesen Eintrag wurde keine Antwort des Modells aufgezeichnet.',
  },
  models: {
    dialogDescription:
      'Wählen Sie ein Modell. Gesperrte Zeilen benötigen einen API-Schlüssel. Fügen Sie einen hinzu, um sie freizuschalten.',
    searchPlaceholder: 'Modelle suchen…',
    unavailableTitle: 'Auch Anbieter anzeigen, für die kein API-Schlüssel hinterlegt ist',
    unavailableProviders: 'Nicht verfügbare Anbieter',
    showAllVersions: 'Alle Versionen anzeigen',
    addApiKey: 'API-Schlüssel hinzufügen',
    noMatch: 'Keine Treffer für Ihre Suche.',
    noModels: 'Keine Modelle verfügbar.',
    colModel: 'Modell',
    colProvider: 'Anbieter',
    colVision: 'Bilder',
    colInput: 'Eingabe',
    colOutput: 'Ausgabe',
    perMillion: '$/1M',
    colEst: 'ca.',
    perPageUnit: '/Seite',
    visionAria: 'Bildverarbeitung',
    unlockTooltip: 'Fügen Sie einen API-Schlüssel hinzu, um dieses Modell freizuschalten.',
    manualHint:
      'Die Modelle dieses Endpunkts konnten nicht abgerufen werden. Geben Sie eine Modell-ID manuell ein.',
    use: 'Auswählen',
    perPageTooltipOcr:
      'Grobe Schätzung: ca. 3.000 Eingabe- + 900 Ausgabe-Tokens pro Seite (OCR). Variiert je nach Dokument.',
    perPageTooltipAnalysis:
      'Grobe Schätzung: ca. 1.300 Eingabe- + 500 Ausgabe-Tokens pro Seite (Analyse). Variiert je nach Dokument.',
  },
  nav: {
    labels: {
      dashboard: 'Dashboard',
      review: 'Prüfung',
      history: 'Verlauf',
      tags: 'Tags',
      settings: 'Einstellungen',
      general: 'Allgemein',
      processing: 'Verarbeitung',
      prompts: 'Prompts',
      apiKeys: 'API-Schlüssel',
      connection: 'Verbindung',
    },
    meta: {
      dashboard: {
        title: 'Dashboard',
        description: 'Warteschlange, Durchsatz und letzte Aktivität',
      },
      review: {
        title: 'Warteschlange zur Prüfung',
        description: 'KI-Vorschläge freigeben, bearbeiten oder ablehnen',
      },
      history: {
        title: 'Verlauf',
        description: 'Die Prompts und Antworten des Modells hinter jedem Durchlauf einsehen',
      },
      tags: {
        title: 'Tags',
        description: 'Ihre paperless-Tags und die Hinweise, denen die KI folgt',
      },
      general: {
        title: 'Allgemein',
        description: 'Erscheinungsbild und App-Einstellungen',
      },
      connection: {
        title: 'Verbindung',
        description: 'Ihre paperless-ngx-Instanz',
      },
      apiKeys: {
        title: 'API-Schlüssel',
        description: 'KI-Anbieter verbinden',
      },
      processing: {
        title: 'Verarbeitung',
        description: 'Modelle und wie Dokumente angereichert werden',
      },
      prompts: {
        title: 'Prompts',
        description: 'Anpassen, was jedes Modell gefragt wird',
      },
    },
    footer: {
      openPaperless: 'paperless in einem neuen Tab öffnen',
      supportKofi: 'Auf Ko-fi unterstützen',
      signOut: 'Abmelden',
    },
    toggle: '{{label}} ein-/ausklappen',
  },
  onboarding: {
    connectPaperless: {
      title: 'paperless verbinden',
      description: 'Richten Sie Starfruit auf Ihre paperless-ngx-Instanz aus.',
    },
    apiKeys: {
      title: 'API-Schlüssel',
      description:
        'Verbinden Sie mindestens einen KI-Anbieter: einen Cloud-Schlüssel oder einen lokalen Endpunkt.',
    },
    processing: {
      title: 'Verarbeitung',
      description: 'Wählen Sie, welche Modelle Ihre Dokumente lesen und anreichern.',
      ocrModel: 'OCR-Modell',
      ocrHint: 'Text mit einem Vision-Modell auslesen',
      extractionModel: 'Extraktionsmodell',
      extractionHint: 'Schlägt Titel, Tags, Korrespondent und Datum vor',
      languageModel: 'Sprachmodell',
      modelValue: '{{name}} · {{model}}',
      unknownProvider: 'Unbekannt',
    },
    startProcessing: {
      label: 'Verarbeitung starten',
      title: 'Wie starte ich die Verarbeitung?',
      tagPrefix: 'Versehen Sie in paperless ein Dokument mit dem Tag',
      tagSuffix: '— Starfruit übernimmt es beim nächsten Abruf.',
    },
  },
  paperless: {
    cardTitle: 'paperless verbinden',
    cardDescription:
      'Nur Lesezugriff, wird vor dem Speichern überprüft. Das Token wird verschlüsselt gespeichert.',
    baseUrlLabel: 'paperless-ngx-URL',
    baseUrlPlaceholder: 'paperless.home.lan oder 192.168.1.10:8000',
    baseUrlHint:
      'Hostname oder IP + Port funktionieren beide — ohne Schema wird http:// angenommen.',
    tokenLabel: 'API-Token',
    tokenDocsLink: 'Wo finde ich es?',
    tokenPlaceholderUpdate: 'zum Aktualisieren neu eingeben',
    tokenPlaceholder: 'paperless-API-Token',
    hideToken: 'Token verbergen',
    showToken: 'Token anzeigen',
    advanced: 'Erweitert',
    apiVersionLabel: 'API-Version',
    apiVersionPlaceholder: 'automatisch',
    apiVersionHint: 'Leer lassen, um die API-Version des Servers automatisch zu erkennen.',
    testConnection: 'Verbindung testen',
    saveChanges: 'Änderungen speichern',
    saveContinue: 'Speichern & fortfahren',
    disconnect: 'Trennen',
    status: {
      checkingAccess: 'Serverzugriff wird überprüft…',
      verifyingStoring: 'Wird überprüft & gespeichert…',
      couldntConnect: 'Verbindung fehlgeschlagen',
      instanceRejected: 'Die Instanz hat die Anfrage abgelehnt.',
      connectionVerified: 'Verbindung überprüft',
      connected: 'Verbunden',
    },
    probe: {
      version: 'paperless-ngx {{version}}',
      documents: 'Dokumente: {{count}}',
      checkedJustNow: 'gerade überprüft',
    },
  },
  processing: {
    model: 'Modell',
    unknownProvider: 'Unbekannt',
    ocr: {
      title: '1. OCR',
      subtitle: 'Gescannte Seiten mit einem Vision-Modell neu einlesen',
      runAria: 'OCR ausführen',
      skipAbove: 'OCR überspringen ab',
      skipAboveHint:
        'Größere Dateien nutzen den Text von paperless; die Extraktion sieht nur ihre erste und letzte Seite',
      pickToEnable:
        'Wählen Sie ein OCR-Modell, um OCR zu aktivieren. Bis dahin wird der Text von paperless verwendet.',
      usingBuiltIn: 'Der eingebaute Text von paperless wird verwendet',
    },
    extraction: {
      title: '2. Extraktion',
      subtitle: 'Titel, Tags, Korrespondent und Datum',
      runAria: 'Extraktion ausführen',
      createNewTags: 'Neue Tags erstellen',
      createNewCorrespondents: 'Neue Korrespondenten erstellen',
      skipAbove: 'Extraktion überspringen ab',
      skipAboveHint: 'Größere Dateien werden vollständig übersprungen',
      pickModel: 'Wählen Sie ein Sprachmodell, um die Extraktion auszuführen.',
      offMetadata: 'Dokumente behalten ihre bestehenden Metadaten. Es läuft nur OCR.',
      warnNoOcrModel:
        'Es ist auch kein OCR-Modell konfiguriert, daher können Dokumente nicht verarbeitet werden. Wählen Sie eines im OCR-Schritt oder aktivieren Sie die Extraktion wieder.',
      warnOcrOff:
        'OCR ist ebenfalls aus, daher können Dokumente nicht verarbeitet werden. Aktivieren Sie mindestens einen Schritt.',
    },
    apply: {
      title: '3. Anwenden',
      subtitle: 'Was mit den Vorschlägen passiert',
      modeAria: 'Anwendungsmodus',
      review: {
        title: 'Zur Prüfung einreihen',
        description: 'Sie geben jedes Dokument frei, bevor etwas in paperless geändert wird',
      },
      auto: {
        title: 'Automatisch anwenden',
        description: 'Vorschläge landen sofort in paperless',
      },
      extractionOff:
        'Die Extraktion ist aus. Es gibt keine Vorschläge zum Anwenden. Der OCR-Text wird direkt in das Dokument geschrieben.',
    },
    picker: {
      ocrTitle: 'OCR-Modell',
      llmTitle: 'Sprachmodell',
    },
    general: {
      title: 'Allgemein',
      description:
        'Abrufintervall, Ausgabesprache, Größe des Anhangs und ausgeschlossene Korrespondenten.',
      pollInterval: 'Abrufintervall (Sekunden)',
      outputLanguage: 'Ausgabesprache',
      attachMaxMb: 'Maximale Größe des Anhangs (MB)',
      attachMaxMbHint:
        'Originale über dieser Größe werden nie an ein Modell gesendet; sie werden allein aus ihrem Text verarbeitet. Der Standardwert entspricht dem Limit für eingebettete Dateien, das die Anbieter ohnehin durchsetzen — er muss daher selten geändert werden.',
      correspondentBlacklist: 'Sperrliste für Korrespondenten',
      blacklistPlaceholder:
        'Ein Name pro Zeile\nWird nie als Korrespondent zugewiesen oder erstellt',
    },
    maxPages: {
      noLimit: 'Kein Limit',
      pages: 'Seiten',
    },
  },
  prompts: {
    navAriaLabel: 'Prompts',
    variables: 'Variablen',
    variablesHint:
      'Klicken, um an der Cursorposition einzufügen. Beim Ausführen werden sie durch die Werte des jeweiligen Dokuments ersetzt.',
    prompt: 'Prompt',
    autosaveHint: 'Änderungen werden automatisch gespeichert.',
    resetTitle: 'Diesen Prompt durch den eingebauten Standard ersetzen',
    resetToDefault: 'Auf Standard zurücksetzen',
    testTitle: 'An einem Dokument testen',
    testDescription:
      'Führt den aktuellen Prompt (inklusive nicht gespeicherter Änderungen) mit dem von Ihnen gewählten Modell an einem echten Dokument aus.',
    testUnavailable:
      'Verbinden Sie Ihre paperless-Instanz und wählen Sie unter „Einstellungen → Verarbeitung“ ein Modell, um Prompts zu testen.',
    document: 'Dokument',
    noDocuments: 'Keine Dokumente gefunden',
    documentFallback: 'Dokument #{{id}}',
    runTest: 'Test ausführen',
    testFailed: 'Test fehlgeschlagen.',
    result: 'Ergebnis',
    tokens: '{{tokens}} Tokens',
    pageBilled: 'Seitenabrechnung',
    fieldTitle: 'Titel',
    fieldTags: 'Tags',
    fieldCorrespondent: 'Korrespondent',
    fieldDate: 'Datum',
    noTextReturned: '(kein Text zurückgegeben)',
    promptSent: 'Gesendeter Prompt',
  },
  review: {
    emptyTitle: 'Nichts zu prüfen',
    emptyProcessedBefore: 'Wenn ein Dokument mit dem Tag',
    emptyProcessedAfter:
      'verarbeitet wird, landen seine KI-Vorschläge hier und warten auf Ihre Freigabe.',
    emptyExtractionOff:
      'Die Extraktion ist ausgeschaltet. Dokumente werden nur per OCR gelesen, daher werden keine Vorschläge eingereiht. Schalten Sie sie unter „Einstellungen → Verarbeitung“ wieder ein.',
    awaiting: 'Warten auf Prüfung: {{count}}',
    clear: 'Auswahl aufheben',
    approveSelected: 'Auswahl freigeben ({{count}})',
    bulkApproveFailed: 'Massenfreigabe fehlgeschlagen',
    someFailed: '{{failed}} von {{total}} nicht freigegeben',
    selectDocument: 'Dokument {{documentId}} auswählen',
    itemMeta: 'war „{{title}}“ · Dokument #{{documentId}} · Tags: {{count}}',
    review: 'Prüfen',
    backToQueue: 'Zurück zur Warteschlange',
    openInPaperless: 'In paperless öffnen',
    documentNumber: 'Dokument #{{documentId}}',
    noTextPreview: 'Keine Textvorschau verfügbar.',
    aiSuggestions: 'KI-Vorschläge',
    fieldTitle: 'Titel',
    tags: 'Tags',
    noTagsSuggested: 'Keine Tags vorgeschlagen.',
    new: 'neu',
    currentKept: 'Aktuell: {{tags}} (unverändert)',
    fieldCorrespondent: 'Korrespondent',
    nonePlaceholder: '(keiner)',
    fieldDate: 'Datum',
    actionFailed: 'Aktion fehlgeschlagen',
    reject: 'Ablehnen',
    approveApply: 'Freigeben & anwenden',
  },
  tags: {
    loadErrorTitle: 'Tags konnten nicht geladen werden',
    filterAriaLabel: 'Tags filtern',
    filterPlaceholder: 'Nach Name oder Hinweis filtern…',
    newTag: 'Neues Tag',
    emptyTitle: 'Noch keine Tags',
    emptyDescription: 'Erstellen Sie Ihr erstes Tag. Es erscheint sofort in paperless.',
    colTag: 'Tag',
    colHint: 'KI-Hinweis',
    colDocs: 'Dokumente',
    actionsAriaLabel: 'Aktionen',
    triggerTitle:
      'Starfruit übernimmt Dokumente mit diesem Tag; es kann hier nicht bearbeitet werden.',
    triggerBadge: 'Auslöser',
    triggerHint: 'Markiert Dokumente zur Verarbeitung',
    showToAi: '„{{name}}“ der KI zeigen',
    hideFromAi: '„{{name}}“ vor der KI verbergen',
    hiddenTitle: 'Vor der KI verborgen. Klicken, um es wieder anzuzeigen',
    visibleTitle: 'Für die KI sichtbar. Klicken, um es zu verbergen',
    editAria: '„{{name}}“ bearbeiten',
    noMatch: 'Keine Treffer für „{{query}}“.',
    editTitle: '„{{name}}“ bearbeiten',
    nameLabel: 'Name',
    namePlaceholder: 'Versicherung',
    colorLabel: 'Farbe',
    charCount: '{{count}}/{{max}}',
    hintPlaceholder:
      'z. B. Alles von einer Versicherung: Policen, Schadensmeldungen, Verlängerungsschreiben.',
    createTag: 'Tag erstellen',
  },
  site: {
    byok: {
      eyebrow: 'Mit eigenen Schlüsseln',
      title: 'Nutzen Sie Ihre eigenen API-Schlüssel.',
      lead: 'Verbinden Sie die Anbieter, für die Sie schon zahlen — oder ein Modell, das auf Ihrer eigenen Hardware läuft.',
      logoAlt: '{{name}}-Logo',
      localName: 'Alles OpenAI-Kompatible',
      localModels: 'Ollama · LM Studio · vLLM · OpenRouter (lokal oder remote)',
      note: 'Verschlüsselt gespeichert und direkt an den Anbieter gesendet, niemals über uns.',
    },
    ctaFooter: {
      title: 'Einfach einzurichten. Einfach zu nutzen.',
      lead: 'Kostenlos, Open Source und selbst gehostet. Schlüssel verbinden, ein Dokument taggen — die Ablage übernimmt Starfruit für Sie.',
      deployButton: 'Mit Docker bereitstellen',
      docsButton: 'Doku lesen',
      footerNavLabel: 'Fußzeile',
      linkDocs: 'Dokumentation',
      linkInstall: 'Installation',
      disclaimer:
        'Ein unabhängiger Begleiter für paperless-ngx, nicht mit dem paperless-ngx-Projekt verbunden.',
    },
    features: {
      eyebrow: 'Funktionen',
      title: 'Alles, was es kann.',
      ocr: {
        title: 'Bessere OCR',
        description:
          'Scans mit einem Vision-Modell neu einlesen, wenn der eigene Text von paperless nicht ausreicht.',
      },
      metadata: {
        title: 'Automatische Metadaten',
        description: 'Ein klarer Titel, Tags, Korrespondent und Datum für jedes Dokument.',
      },
      review: {
        title: 'Prüfen oder automatisch anwenden',
        description:
          'Jeden Vorschlag freigeben, bearbeiten oder ablehnen — oder direkt zurückschreiben.',
      },
      prompts: {
        title: 'Prompts unter Ihrer Kontrolle',
        description:
          'Ändern Sie, was jedes Modell gefragt wird, und testen Sie es zuerst an einem echten Dokument.',
      },
      providers: {
        title: 'Jeder Anbieter',
        description:
          'Anthropic, OpenAI, Google, Mistral oder jedes lokale OpenAI-kompatible Modell.',
      },
      history: {
        title: 'Vollständiger Verlauf',
        description:
          'Sehen Sie zu jedem Durchlauf den genauen Prompt, der gesendet wurde, und die Antwort des Modells.',
      },
    },
    hero: {
      eyebrow: 'Begleiter für paperless-ngx',
      // Split around the scoped <br>, <span class="hl"> and <em> so those elements
      // stay in the template and keep Astro's scoped-CSS class (the .hl highlight).
      titleLine1: 'Ein Dokument taggen.',
      titleAfterBr: 'Sie bekommen es ',
      titleHighlight: 'abgelegt',
      titleAfterHighlight: ' zurück.',
      leadBefore:
        'Es liest die Dokumente, die Sie taggen, und schreibt einen klaren Titel, Tags, Korrespondent und Datum zurück — mit den OCR- und Sprachmodellen, die ',
      leadEm: 'Sie',
      leadAfter: ' mitbringen.',
      ctaPrimary: 'Mit Docker bereitstellen',
      ctaSecondary: 'Doku lesen',
      trustLabel: 'Auf einen Blick',
      trustKeys: 'Eigene Schlüssel',
      trustSelfHosted: 'Selbst gehostet',
      trustContainer: 'Ein Container',
      trustTelemetry: 'Keine Telemetrie',
      figureLabel: 'Ein gescanntes Dokument wird zu strukturierten Metadaten',
    },
    layout: {
      title: 'Paperless Starfruit: KI-Metadaten & OCR für paperless-ngx',
      description:
        'Ein selbst gehosteter KI-Begleiter für paperless-ngx mit Ihren eigenen Schlüsseln: bessere OCR und automatisch Titel, Tags, Korrespondent und Datum — alles über eine Web-Oberfläche konfiguriert.',
    },
    nav: {
      brandHomeAria: 'Startseite von Paperless Starfruit',
      primaryAria: 'Hauptnavigation',
      docs: 'Doku',
      githubAria: 'Quellcode auf GitHub ansehen',
      deploy: 'Bereitstellen',
    },
    notFound: {
      metaTitle: 'Seite nicht gefunden · Paperless Starfruit',
      metaDescription:
        'Diese Seite existiert nicht. Zurück zur Startseite oder in die Dokumentation.',
      eyebrow: 'Fehler 404',
      title: 'Diese Seite wurde woanders abgelegt.',
      lead: 'Die Seite, die Sie suchen, existiert nicht — oder hat nie existiert. Schauen Sie in die Dokumentation oder gehen Sie zurück zum Start.',
      backHome: 'Zur Startseite',
      readDocs: 'Doku lesen',
    },
    pipeline: {
      eyebrow: 'So funktioniert es',
      title: 'Ein Tag rein. Ein abgelegtes Dokument raus.',
      foot: 'Erneut taggen, um ein Dokument noch einmal zu verarbeiten. Unveränderte Inhalte werden übersprungen, Wiederholungen sind also kostenlos.',
      step1: {
        title: 'Dokument taggen',
        d: 'Fügen Sie in paperless <code>psf-process</code> hinzu. Dieses eine Tag ist der ganze Auslöser.',
      },
      step2: {
        title: 'OCR',
        d: 'Ein Vision-Modell liest den Scan neu ein — oder Sie überspringen den Schritt und nutzen paperless&rsquo; eigenen Text.',
        note: 'optional',
      },
      step3: {
        title: 'Extrahieren',
        d: 'Ein Modellaufruf liefert Titel, Tags, Korrespondent und Datum.',
      },
      step4: {
        title: 'Anwenden oder prüfen',
        d: 'Automatisch in paperless zurückgeschrieben — oder zur Freigabe eingereiht.',
      },
    },
    screenshots: {
      eyebrow: 'Screenshots',
      title: 'Ein Blick in die App.',
      prevLabel: 'Vorheriger Screenshot',
      nextLabel: 'Nächster Screenshot',
      trackLabel: 'App-Screenshots, horizontal scrollbar',
      imageAlt: '{{label}} in Paperless Starfruit',
      dashboardLabel: 'Dashboard',
      dashboardCaption: 'Länge der Warteschlange, Durchsatz und letzte Durchläufe.',
      reviewLabel: 'Prüfung',
      reviewCaption: 'Vorschläge direkt neben dem Dokument.',
      tagsLabel: 'Tags',
      tagsCaption: 'Geben Sie jedem Tag einen Hinweis, dem die KI folgt.',
      promptsLabel: 'Prompts',
      promptsCaption: 'Bearbeiten und testen Sie die Prompts, die jedes Modell erhält.',
      apiKeysLabel: 'API-Schlüssel',
      // Drops the object noun: the label already says `API-Schlüssel`, and a
      // second compound (`Anbieter-Schlüssel`) would read as a different credential.
      apiKeysCaption: 'Für jeden Anbieter hinzufügen, testen und maskieren.',
    },
  },
} satisfies Messages;
