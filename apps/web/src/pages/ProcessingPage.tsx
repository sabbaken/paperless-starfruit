import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="space-y-6">
      <ModelsCard
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={() => navigate("/settings/api-keys")}
      />
      <ProcessingForm initial={settings.data} />
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
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
        <CardDescription>
          Choose which model handles extraction and OCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
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
      </CardContent>

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
    </Card>
  );
}

function ProcessingForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState<Settings>(initial);
  const [blacklistText, setBlacklistText] = useState(
    initial.correspondentBlacklist.join("\n"),
  );

  const save = useUpdateSettings();
  const commit = (patch: SettingsUpdate) =>
    void toastSave(save.mutateAsync(patch));

  // Toggles commit instantly; free-text fields commit a short pause after the last
  // keystroke so we don't fire a request per character.
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
    <Card>
      <CardHeader>
        <CardTitle>Processing</CardTitle>
        <CardDescription>
          How documents are picked up and enriched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SwitchRow
          label="Run OCR before extraction"
          hint="Re-OCR each document's original with the selected OCR model and write the text back to paperless. When off, paperless's existing text is reused (free)."
          checked={form.ocrEnabled}
          onCheckedChange={(v) => {
            setForm((f) => ({ ...f, ocrEnabled: v }));
            commit({ ocrEnabled: v });
          }}
        />
        <SwitchRow
          label="Auto-apply suggestions"
          hint="Apply AI suggestions immediately instead of queueing them for review. Documents tagged ai-process-auto always auto-apply."
          checked={form.autoApply}
          onCheckedChange={(v) => {
            setForm((f) => ({ ...f, autoApply: v }));
            commit({ autoApply: v });
          }}
        />
        <SwitchRow
          label="Create new tags & correspondents"
          hint="Let the AI create tags/correspondents that don't exist yet. When off, only existing ones are applied."
          checked={form.createNewTags}
          onCheckedChange={(v) => {
            setForm((f) => ({ ...f, createNewTags: v }));
            commit({ createNewTags: v });
          }}
        />

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
      </CardContent>
    </Card>
  );
}
