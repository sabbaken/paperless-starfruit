import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Brain, CheckCircle2, Inbox, Loader2, type LucideIcon, ScanText, Zap } from 'lucide-react';
import type { ProviderConfig, Settings, SettingsUpdate } from '@paperless-starfruit/shared';
import { useTranslation } from '@/i18n/I18nProvider';
import { useProviders } from '@/api/providers';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { ModelPicker } from '@/components/model-picker';
import { PageSection } from '@/components/ui/page-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectRow } from '@/components/ui/select-row';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SwitchRow } from '@/components/ui/switch-row';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { toastSave } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function ProcessingPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const providers = useProviders();

  if (settings.isLoading || providers.isLoading || !settings.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-8">
      <PipelineStepper
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={() => navigate('/settings/api-keys')}
      />
      <GeneralForm initial={settings.data} />
    </div>
  );
}

type PickerTarget = 'llm' | 'ocr';

/**
 * The pipeline as a vertical stepper: one card per stage (OCR → extraction →
 * apply), each carrying its own model and knobs, top to bottom the document's
 * journey. Each stage has a per-file page limit so a 1000-page scan doesn't
 * run up cloud OCR / LLM cost; the stages gate independently, and a document
 * over the extraction limit is skipped entirely.
 */
function PipelineStepper({
  settings,
  providers,
  onGoToProviders,
}: {
  settings: Settings;
  providers: ProviderConfig[];
  onGoToProviders: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Settings>(settings);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Read live from the prop (not local form state) so picking an OCR model
  // re-enables the OCR controls immediately on the next refetch.
  const ocrConfigured = settings.ocrProviderId != null && settings.ocrModel != null;
  const llmConfigured = settings.llmProviderId != null && settings.llmModel != null;

  const save = useUpdateSettings();
  const commit = (patch: SettingsUpdate) => void toastSave(save.mutateAsync(patch));

  // Toggles commit instantly; page-limit inputs commit a short pause after the
  // last keystroke. A limit is sent only when blank (cleared) or a positive
  // integer. Partial/invalid entries are skipped until corrected.
  const commitLimits = useDebouncedCallback(() => {
    const patch: SettingsUpdate = {};
    const ocr = sendableLimit(form.ocrMaxPages);
    if (ocr !== undefined) patch.ocrMaxPages = ocr;
    const extract = sendableLimit(form.extractMaxPages);
    if (extract !== undefined) patch.extractMaxPages = extract;
    if (Object.keys(patch).length > 0) commit(patch);
  }, 600);

  const providerName = (id: number | null) => providers.find((p) => p.id === id)?.name ?? null;
  const describe = (id: number | null, model: string | null) =>
    model ? `${providerName(id) ?? t('processing.unknownProvider')} · ${model}` : null;

  const onSelectModel = (providerId: number, model: string) => {
    void toastSave(
      save.mutateAsync(
        picker === 'ocr'
          ? { ocrProviderId: providerId, ocrModel: model }
          : { llmProviderId: providerId, llmModel: model },
      ),
    );
    setPicker(null);
  };

  return (
    <div>
      {/* --- Stage 1: OCR ----------------------------------------------- */}
      <Stage icon={ScanText}>
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">{t('processing.ocr.title')}</p>
            <p className="text-xs text-muted-foreground">{t('processing.ocr.subtitle')}</p>
          </div>
          <Switch
            aria-label={t('processing.ocr.runAria')}
            checked={form.ocrEnabled}
            disabled={!ocrConfigured}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, ocrEnabled: v }));
              commit({ ocrEnabled: v });
            }}
          />
        </div>

        {ocrConfigured && form.ocrEnabled ? (
          <div className="divide-y border-t">
            <SelectRow
              label={t('processing.model')}
              value={describe(settings.ocrProviderId, settings.ocrModel)}
              onClick={() => setPicker('ocr')}
            />
            <div className="py-3">
              <MaxPagesField
                label={t('processing.ocr.skipAbove')}
                hint={t('processing.ocr.skipAboveHint')}
                value={form.ocrMaxPages}
                onChange={(v) => {
                  setForm((f) => ({ ...f, ocrMaxPages: v }));
                  commitLimits();
                }}
              />
            </div>
          </div>
        ) : !ocrConfigured ? (
          // Keep the model row reachable. It's the only way to configure OCR.
          <div className="border-t">
            <SelectRow
              label={t('processing.model')}
              value={null}
              onClick={() => setPicker('ocr')}
            />
            <p className="pb-3 text-xs text-muted-foreground">{t('processing.ocr.pickToEnable')}</p>
          </div>
        ) : (
          <p className="border-t py-3 text-xs text-muted-foreground">
            {t('processing.ocr.usingBuiltIn')}
          </p>
        )}
      </Stage>

      {/* --- Stage 2: Extraction ----------------------------------------- */}
      <Stage icon={Brain}>
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">{t('processing.extraction.title')}</p>
            <p className="text-xs text-muted-foreground">{t('processing.extraction.subtitle')}</p>
          </div>
          {/* Unlike OCR the switch is never disabled: turning extraction OFF is
              exactly what an OCR-only user with no LLM key configured needs. */}
          <Switch
            aria-label={t('processing.extraction.runAria')}
            checked={form.extractionEnabled}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, extractionEnabled: v }));
              commit({ extractionEnabled: v });
            }}
          />
        </div>

        {form.extractionEnabled && llmConfigured ? (
          <div className="divide-y border-t">
            <SelectRow
              label={t('processing.model')}
              value={describe(settings.llmProviderId, settings.llmModel)}
              onClick={() => setPicker('llm')}
            />
            <div className="py-3">
              <SwitchRow
                label={t('processing.extraction.createNewTags')}
                checked={form.createNewTags}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, createNewTags: v }));
                  commit({ createNewTags: v });
                }}
              />
            </div>
            <div className="py-3">
              <SwitchRow
                label={t('processing.extraction.createNewCorrespondents')}
                checked={form.createNewCorrespondents}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, createNewCorrespondents: v }));
                  commit({ createNewCorrespondents: v });
                }}
              />
            </div>
            <div className="py-3">
              <MaxPagesField
                label={t('processing.extraction.skipAbove')}
                hint={t('processing.extraction.skipAboveHint')}
                value={form.extractMaxPages}
                onChange={(v) => {
                  setForm((f) => ({ ...f, extractMaxPages: v }));
                  commitLimits();
                }}
              />
            </div>
          </div>
        ) : form.extractionEnabled ? (
          // Keep the model row reachable. It's the only way to configure extraction.
          <div className="border-t">
            <SelectRow
              label={t('processing.model')}
              value={null}
              onClick={() => setPicker('llm')}
            />
            <p className="pb-3 text-xs text-muted-foreground">
              {t('processing.extraction.pickModel')}
            </p>
          </div>
        ) : (
          <div className="border-t py-3">
            <p className="text-xs text-muted-foreground">
              {t('processing.extraction.offMetadata')}
            </p>
            {(!ocrConfigured || !form.ocrEnabled) && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                {!ocrConfigured
                  ? t('processing.extraction.warnNoOcrModel')
                  : t('processing.extraction.warnOcrOff')}
              </p>
            )}
          </div>
        )}
      </Stage>

      {/* --- Stage 3: Apply ----------------------------------------------- */}
      <Stage icon={CheckCircle2} last>
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">{t('processing.apply.title')}</p>
            <p className="text-xs text-muted-foreground">{t('processing.apply.subtitle')}</p>
          </div>
        </div>

        {form.extractionEnabled ? (
          <div
            role="radiogroup"
            aria-label={t('processing.apply.modeAria')}
            className="grid grid-cols-2 gap-2 border-t py-3"
          >
            <ApplyOption
              icon={Inbox}
              title={t('processing.apply.review.title')}
              description={t('processing.apply.review.description')}
              selected={!form.autoApply}
              onSelect={() => {
                setForm((f) => ({ ...f, autoApply: false }));
                commit({ autoApply: false });
              }}
            />
            <ApplyOption
              icon={Zap}
              title={t('processing.apply.auto.title')}
              description={t('processing.apply.auto.description')}
              selected={form.autoApply}
              onSelect={() => {
                setForm((f) => ({ ...f, autoApply: true }));
                commit({ autoApply: true });
              }}
            />
          </div>
        ) : (
          <p className="border-t py-3 text-xs text-muted-foreground">
            {t('processing.apply.extractionOff')}
          </p>
        )}
      </Stage>

      {picker && (
        <ModelPicker
          title={
            picker === 'ocr' ? t('processing.picker.ocrTitle') : t('processing.picker.llmTitle')
          }
          visionOnly={picker === 'ocr'}
          selected={
            picker === 'ocr'
              ? { providerId: settings.ocrProviderId, model: settings.ocrModel }
              : { providerId: settings.llmProviderId, model: settings.llmModel }
          }
          onSelect={onSelectModel}
          onClose={() => setPicker(null)}
          onAddKey={() => {
            setPicker(null);
            onGoToProviders();
          }}
        />
      )}
    </div>
  );
}

/**
 * One pipeline stage: the card itself plus the rail icon hanging in the margin
 * to its left. The rail is absolutely positioned so it never affects the card's
 * width (every card on the page lines up) and hidden when the viewport has no
 * spare margin to hang it in.
 */
function Stage({
  icon: Icon,
  last,
  children,
}: {
  icon: LucideIcon;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative', !last && 'mb-4')}>
      <div
        aria-hidden
        className={cn(
          'absolute top-0 -left-12 hidden w-8 flex-col items-center xl:flex',
          !last && '-bottom-4',
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        {!last && <div className="my-1.5 w-px flex-1 bg-border" />}
      </div>
      <div className="rounded-xl border bg-card px-5 py-2">{children}</div>
    </div>
  );
}

/** One of the two apply-mode choices: a selectable card with radio semantics. */
function ApplyOption({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-brand ring-1 ring-brand' : 'hover:bg-muted/50',
      )}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 text-sm font-medium',
          !selected && 'text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
        {title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function GeneralForm({ initial }: { initial: Settings }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Settings>(initial);
  const [blacklistText, setBlacklistText] = useState(initial.correspondentBlacklist.join('\n'));

  const save = useUpdateSettings();
  const commit = (patch: SettingsUpdate) => void toastSave(save.mutateAsync(patch));

  // Free-text fields commit a short pause after the last keystroke so we don't
  // fire a request per character.
  const commitText = useDebouncedCallback(() => {
    const patch: SettingsUpdate = {
      language: form.language.trim() || 'auto',
      correspondentBlacklist: blacklistText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    // Skip out-of-range intervals (e.g. mid-edit empties). The server rejects < 15.
    if (Number.isFinite(form.pollIntervalSec) && form.pollIntervalSec >= 15) {
      patch.pollIntervalSec = form.pollIntervalSec;
    }
    const attach = sendableLimit(form.attachMaxMb);
    if (attach !== undefined) patch.attachMaxMb = attach;
    commit(patch);
  }, 600);

  return (
    <PageSection
      title={t('processing.general.title')}
      description={t('processing.general.description')}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pollInterval">{t('processing.general.pollInterval')}</Label>
            <Input
              id="pollInterval"
              type="number"
              min={15}
              value={form.pollIntervalSec}
              onChange={(e) => {
                setForm((f) => ({
                  ...f,
                  pollIntervalSec: Number(e.target.value),
                }));
                commitText();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">{t('processing.general.outputLanguage')}</Label>
            <Input
              id="language"
              placeholder="auto"
              value={form.language}
              onChange={(e) => {
                setForm((f) => ({ ...f, language: e.target.value }));
                commitText();
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachMaxMb">{t('processing.general.attachMaxMb')}</Label>
          <Input
            id="attachMaxMb"
            type="number"
            min={1}
            inputMode="numeric"
            className="w-40"
            placeholder={t('processing.maxPages.noLimit')}
            value={form.attachMaxMb ?? ''}
            onChange={(e) => {
              setForm((f) => ({
                ...f,
                attachMaxMb: e.target.value === '' ? null : Number(e.target.value),
              }));
              commitText();
            }}
          />
          <p className="text-xs text-muted-foreground">{t('processing.general.attachMaxMbHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="blacklist">{t('processing.general.correspondentBlacklist')}</Label>
          <Textarea
            id="blacklist"
            placeholder={t('processing.general.blacklistPlaceholder')}
            value={blacklistText}
            onChange={(e) => {
              setBlacklistText(e.target.value);
              commitText();
            }}
          />
        </div>
      </div>
    </PageSection>
  );
}

/** A page-limit field laid out like SwitchRow: label/hint left, number input right. */
function MaxPagesField({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          id={id}
          type="number"
          min={1}
          inputMode="numeric"
          placeholder={t('processing.maxPages.noLimit')}
          disabled={disabled}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-28"
        />
        <span className="text-xs text-muted-foreground">{t('processing.maxPages.pages')}</span>
      </div>
    </div>
  );
}

/** A page limit is valid to persist when cleared (null) or a positive integer. */
function sendableLimit(v: number | null): number | null | undefined {
  if (v === null) return null;
  return Number.isInteger(v) && v > 0 ? v : undefined;
}
