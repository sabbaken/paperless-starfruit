import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  CheckCircle2,
  Inbox,
  Loader2,
  type LucideIcon,
  ScanText,
  Zap,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SwitchRow } from "@/components/ui/switch-row";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { toastSave } from "@/lib/toast";
import { cn } from "@/lib/utils";

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
      <PipelineStepper
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={() => navigate("/settings/api-keys")}
      />
      <GeneralForm initial={settings.data} />
    </div>
  );
}

type PickerTarget = "llm" | "ocr";

/**
 * The pipeline as a vertical stepper — one card per stage (OCR → extraction →
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
  const [form, setForm] = useState<Settings>(settings);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  // Read live from the prop (not local form state) so picking an OCR model
  // re-enables the OCR controls immediately on the next refetch.
  const ocrConfigured = settings.ocrProviderId != null && settings.ocrModel != null;

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

  const providerName = (id: number | null) =>
    providers.find((p) => p.id === id)?.name ?? null;
  const describe = (id: number | null, model: string | null) =>
    model ? `${providerName(id) ?? "Unknown"} · ${model}` : null;

  const onSelectModel = (providerId: number, model: string) => {
    void toastSave(
      save.mutateAsync(
        picker === "ocr"
          ? { ocrProviderId: providerId, ocrModel: model }
          : { llmProviderId: providerId, llmModel: model },
      ),
    );
    setPicker(null);
  };

  return (
    <div className="grid grid-cols-[36px_1fr] gap-x-3.5">
      {/* --- Stage 1: OCR ----------------------------------------------- */}
      <StageRail icon={ScanText} />
      <div className="mb-4 rounded-xl border bg-card px-5 py-2">
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">1. OCR</p>
            <p className="text-xs text-muted-foreground">
              Re-read scanned pages with a vision model
            </p>
          </div>
          <Switch
            aria-label="Run OCR"
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
              icon={<ScanText className="size-4" />}
              label="Model"
              value={describe(settings.ocrProviderId, settings.ocrModel)}
              onClick={() => setPicker("ocr")}
            />
            <div className="py-3">
              <MaxPagesField
                label="Skip OCR above"
                hint="Larger files reuse paperless's own text"
                value={form.ocrMaxPages}
                onChange={(v) => {
                  setForm((f) => ({ ...f, ocrMaxPages: v }));
                  commitLimits();
                }}
              />
            </div>
          </div>
        ) : !ocrConfigured ? (
          // Keep the model row reachable — it's the only way to configure OCR.
          <div className="border-t">
            <SelectRow
              icon={<ScanText className="size-4" />}
              label="Model"
              value={null}
              onClick={() => setPicker("ocr")}
            />
            <p className="pb-3 text-xs text-muted-foreground">
              Pick an OCR model to enable OCR — until then paperless's own text
              is used.
            </p>
          </div>
        ) : (
          <p className="border-t py-3 text-xs text-muted-foreground">
            Using paperless's built-in text
          </p>
        )}
      </div>

      {/* --- Stage 2: Extraction ----------------------------------------- */}
      <StageRail icon={Brain} />
      <div className="mb-4 rounded-xl border bg-card px-5 py-2">
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">2. Extraction</p>
            <p className="text-xs text-muted-foreground">
              Title, tags, correspondent and date
            </p>
          </div>
          <span className="text-xs text-muted-foreground">always on</span>
        </div>

        <div className="divide-y border-t">
          <SelectRow
            icon={<Brain className="size-4" />}
            label="Model"
            value={describe(settings.llmProviderId, settings.llmModel)}
            onClick={() => setPicker("llm")}
          />
          <div className="py-3">
            <SwitchRow
              label="Create new tags"
              checked={form.createNewTags}
              onCheckedChange={(v) => {
                setForm((f) => ({ ...f, createNewTags: v }));
                commit({ createNewTags: v });
              }}
            />
          </div>
          <div className="py-3">
            <SwitchRow
              label="Create new correspondents"
              checked={form.createNewCorrespondents}
              onCheckedChange={(v) => {
                setForm((f) => ({ ...f, createNewCorrespondents: v }));
                commit({ createNewCorrespondents: v });
              }}
            />
          </div>
          <div className="py-3">
            <MaxPagesField
              label="Skip extraction above"
              hint="Larger files are skipped entirely"
              value={form.extractMaxPages}
              onChange={(v) => {
                setForm((f) => ({ ...f, extractMaxPages: v }));
                commitLimits();
              }}
            />
          </div>
        </div>
      </div>

      {/* --- Stage 3: Apply ----------------------------------------------- */}
      <StageRail icon={CheckCircle2} last />
      <div className="rounded-xl border bg-card px-5 py-2">
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">3. Apply</p>
            <p className="text-xs text-muted-foreground">
              What happens with the suggestions
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Apply mode"
          className="grid grid-cols-2 gap-2 border-t py-3"
        >
          <ApplyOption
            icon={Inbox}
            title="Queue for review"
            description="You approve each document before paperless is touched"
            selected={!form.autoApply}
            onSelect={() => {
              setForm((f) => ({ ...f, autoApply: false }));
              commit({ autoApply: false });
            }}
          />
          <ApplyOption
            icon={Zap}
            title="Apply automatically"
            description="Suggestions land in paperless immediately"
            selected={form.autoApply}
            onSelect={() => {
              setForm((f) => ({ ...f, autoApply: true }));
              commit({ autoApply: true });
            }}
          />
        </div>
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

/** The stepper rail cell: stage icon in a circle, hairline down to the next stage. */
function StageRail({ icon: Icon, last }: { icon: LucideIcon; last?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      {!last && <div className="my-1.5 w-px flex-1 bg-border" aria-hidden />}
    </div>
  );
}

/** One of the two apply-mode choices — a selectable card with radio semantics. */
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
        "cursor-pointer rounded-lg border p-3 text-left transition-colors",
        selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          !selected && "text-muted-foreground",
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
