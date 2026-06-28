import { useId, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Loader2, ScanText } from "lucide-react";
import type {
  ProviderConfig,
  Settings,
  SettingsUpdate,
} from "@paperless-starfruit/shared";
import { useProviders } from "@/api/providers";
import { useSettings, useUpdateSettings } from "@/api/settings";
import { ModelPicker } from "@/components/model-picker";
import { PageSection } from "@/components/ui/page-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectRow } from "@/components/ui/select-row";
import { Textarea } from "@/components/ui/textarea";
import { SwitchRow } from "@/components/ui/switch-row";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { toastSave } from "@/lib/toast";

export function ProcessingPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const providers = useProviders();

  if (settings.isLoading || providers.isLoading || !settings.data) {
    return (
      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
    );
  }

  return (
    <div className="space-y-8">
      <ModelsCard
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={() => navigate("/settings/api-keys")}
      />
      <PipelineForm initial={settings.data} />
      <GeneralForm initial={settings.data} />
    </div>
  );
}

type PickerTarget = "llm" | "ocr";

function ModelsCard({
  settings,
  providers,
  onGoToProviders,
}: {
  settings: Settings;
  providers: ProviderConfig[];
  onGoToProviders: () => void;
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  const update = useUpdateSettings();

  const providerName = (id: number | null) =>
    providers.find((p) => p.id === id)?.name ?? null;
  const describe = (id: number | null, model: string | null) =>
    model ? `${providerName(id) ?? "Unknown"} · ${model}` : null;

  const onSelect = (providerId: number, model: string) => {
    void toastSave(
      update.mutateAsync(
        picker === "ocr"
          ? { ocrProviderId: providerId, ocrModel: model }
          : { llmProviderId: providerId, llmModel: model },
      ),
    );
    setPicker(null);
  };

  return (
    <PageSection title="Models" description="Choose which model handles extraction and OCR.">
      <div className="divide-y">
        <SelectRow
          icon={<ScanText className="size-4" />}
          label="OCR model"
          hint="Reads scanned documents (used when OCR is enabled)."
          value={describe(settings.ocrProviderId, settings.ocrModel)}
          onClick={() => setPicker("ocr")}
        />
        <SelectRow
          icon={<Brain className="size-4" />}
          label="Language model"
          hint="Extracts title, tags, correspondent and date."
          value={describe(settings.llmProviderId, settings.llmModel)}
          onClick={() => setPicker("llm")}
        />
      </div>

      {picker && (
        <ModelPicker
          title={picker === "ocr" ? "OCR model" : "Language model"}
          visionOnly={picker === "ocr"}
          selected={
            picker === "ocr"
              ? { providerId: settings.ocrProviderId, model: settings.ocrModel }
              : { providerId: settings.llmProviderId, model: settings.llmModel }
          }
          onSelect={onSelect}
          onClose={() => setPicker(null)}
          onAddKey={() => {
            setPicker(null);
            onGoToProviders();
          }}
        />
      )}
    </PageSection>
  );
}

/**
 * The processing pipeline: OCR → extraction → apply. Each stage has its own
 * toggles, plus a per-file page limit so a 1000-page scan doesn't run up cloud
 * OCR / LLM cost. The two stages gate independently — e.g. OCR up to 10 pages but
 * still extract up to 50 — and a document over the extraction limit is skipped
 * entirely, keeping whatever paperless already recognised.
 */
function PipelineForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState<Settings>(initial);
  // Read live from the prop (not local form state) so picking an OCR model in the
  // Models card above re-enables these controls immediately on the next refetch.
  const ocrConfigured = initial.ocrProviderId != null && initial.ocrModel != null;

  const save = useUpdateSettings();
  const commit = (patch: SettingsUpdate) =>
    void toastSave(save.mutateAsync(patch));

  // Toggles commit instantly; page-limit inputs commit a short pause after the
  // last keystroke. A limit is sent only when blank (cleared) or a positive
  // integer — partial/invalid entries are skipped until corrected.
  const commitLimits = useDebouncedCallback(() => {
    const patch: SettingsUpdate = {};
    const ocr = sendableLimit(form.ocrMaxPages);
    if (ocr !== undefined) patch.ocrMaxPages = ocr;
    const extract = sendableLimit(form.extractMaxPages);
    if (extract !== undefined) patch.extractMaxPages = extract;
    if (Object.keys(patch).length > 0) commit(patch);
  }, 600);

  return (
    <PageSection
      title="Pipeline"
      description="How each document flows through OCR, extraction and apply."
    >
      <div className="space-y-6">
        <Section title="OCR">
          {!ocrConfigured && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Pick an{" "}
              <span className="font-medium text-foreground">OCR model</span> in
              Models above to enable OCR. Until then paperless's own text is used.
            </p>
          )}
          <SwitchRow
            label="Run OCR before extraction"
            hint="Re-OCR each original with the OCR model. Off: reuse paperless's text (free)."
            checked={form.ocrEnabled}
            disabled={!ocrConfigured}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, ocrEnabled: v }));
              commit({ ocrEnabled: v });
            }}
          />
          <MaxPagesField
            label="Skip OCR above"
            hint="Larger files reuse paperless's text instead of paying for OCR. Blank = no limit."
            value={form.ocrMaxPages}
            disabled={!ocrConfigured || !form.ocrEnabled}
            onChange={(v) => {
              setForm((f) => ({ ...f, ocrMaxPages: v }));
              commitLimits();
            }}
          />
        </Section>

        <Section title="Extraction">
          <SwitchRow
            label="Create new tags"
            hint="Let the AI create tags that don't exist yet."
            checked={form.createNewTags}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, createNewTags: v }));
              commit({ createNewTags: v });
            }}
          />
          <SwitchRow
            label="Create new correspondents"
            hint="Let the AI create correspondents that don't exist yet."
            checked={form.createNewCorrespondents}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, createNewCorrespondents: v }));
              commit({ createNewCorrespondents: v });
            }}
          />
          <MaxPagesField
            label="Skip extraction above"
            hint="Larger files are skipped entirely — no OCR, no extraction. Blank = no limit."
            value={form.extractMaxPages}
            onChange={(v) => {
              setForm((f) => ({ ...f, extractMaxPages: v }));
              commitLimits();
            }}
          />
        </Section>

        <Section title="Apply">
          <SwitchRow
            label="Auto-apply suggestions"
            hint="Apply to paperless immediately. Off: queue for review."
            checked={form.autoApply}
            onCheckedChange={(v) => {
              setForm((f) => ({ ...f, autoApply: v }));
              commit({ autoApply: v });
            }}
          />
        </Section>
      </div>
    </PageSection>
  );
}

function GeneralForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState<Settings>(initial);
  const [blacklistText, setBlacklistText] = useState(
    initial.correspondentBlacklist.join("\n"),
  );

  const save = useUpdateSettings();
  const commit = (patch: SettingsUpdate) =>
    void toastSave(save.mutateAsync(patch));

  // Free-text fields commit a short pause after the last keystroke so we don't
  // fire a request per character.
  const commitText = useDebouncedCallback(() => {
    const patch: SettingsUpdate = {
      language: form.language.trim() || "auto",
      correspondentBlacklist: blacklistText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    // Skip out-of-range intervals (e.g. mid-edit empties) — the server rejects < 15.
    if (Number.isFinite(form.pollIntervalSec) && form.pollIntervalSec >= 15) {
      patch.pollIntervalSec = form.pollIntervalSec;
    }
    commit(patch);
  }, 600);

  return (
    <PageSection
      title="General"
      description="Polling, output language and correspondent exclusions."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pollInterval">Poll interval (seconds)</Label>
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
            <Label htmlFor="language">Output language</Label>
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
          <Label htmlFor="blacklist">Correspondent blacklist</Label>
          <Textarea
            id="blacklist"
            placeholder={
              "One name per line\nNever assigned or created as a correspondent"
            }
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

/** A titled group of rows within a settings section. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
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
          placeholder="No limit"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className="w-28"
        />
        <span className="text-xs text-muted-foreground">pages</span>
      </div>
    </div>
  );
}

/** A page limit is valid to persist when cleared (null) or a positive integer. */
function sendableLimit(v: number | null): number | null | undefined {
  if (v === null) return null;
  return Number.isInteger(v) && v > 0 ? v : undefined;
}
