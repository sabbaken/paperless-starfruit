import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, CheckCircle2, Loader2, ScanText } from 'lucide-react';
import type { ProviderConfig, Settings } from '@paperless-ai/shared';
import { useProviders } from '@/api/providers';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectRow } from '@/components/ui/select-row';
import { Textarea } from '@/components/ui/textarea';
import { SwitchRow } from '@/components/ui/switch-row';

export function ProcessingPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const providers = useProviders();

  if (settings.isLoading || providers.isLoading || !settings.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-6">
      <ModelsCard
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={() => navigate('/settings/api-keys')}
      />
      <ProcessingForm initial={settings.data} />
    </div>
  );
}

type PickerTarget = 'llm' | 'ocr';

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

  const providerName = (id: number | null) => providers.find((p) => p.id === id)?.name ?? null;
  const describe = (id: number | null, model: string | null) =>
    model ? `${providerName(id) ?? 'Unknown'} · ${model}` : null;

  const onSelect = (providerId: number, model: string) => {
    update.mutate(
      picker === 'ocr'
        ? { ocrProviderId: providerId, ocrModel: model }
        : { llmProviderId: providerId, llmModel: model },
    );
    setPicker(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
        <CardDescription>Choose which model handles extraction and OCR.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <SelectRow
          icon={<Brain className="size-4" />}
          label="Language model"
          hint="Extracts title, tags, correspondent and date."
          value={describe(settings.llmProviderId, settings.llmModel)}
          onClick={() => setPicker('llm')}
        />
        <SelectRow
          icon={<ScanText className="size-4" />}
          label="OCR model"
          hint="Reads scanned documents (used when OCR is enabled)."
          value={describe(settings.ocrProviderId, settings.ocrModel)}
          onClick={() => setPicker('ocr')}
        />
      </CardContent>

      {picker && (
        <ModelPicker
          title={picker === 'ocr' ? 'OCR model' : 'Language model'}
          visionOnly={picker === 'ocr'}
          selected={
            picker === 'ocr'
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
  const [blacklistText, setBlacklistText] = useState(initial.correspondentBlacklist.join('\n'));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const save = useUpdateSettings();

  const onSave = () =>
    save.mutate(
      {
        pollIntervalSec: form.pollIntervalSec,
        autoApply: form.autoApply,
        createNewTags: form.createNewTags,
        language: form.language.trim() || 'auto',
        correspondentBlacklist: blacklistText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      {
        onSuccess: (updated) => {
          setForm((f) => ({ ...f, ...updated }));
          setBlacklistText(updated.correspondentBlacklist.join('\n'));
          setDirty(false);
          setSaved(true);
        },
      },
    );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
          <CardDescription>How documents are picked up and enriched.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SwitchRow
            label="Auto-apply suggestions"
            hint="Apply AI suggestions immediately instead of queueing them for review. Documents tagged ai-process-auto always auto-apply."
            checked={form.autoApply}
            onCheckedChange={(v) => set('autoApply', v)}
          />
          <SwitchRow
            label="Create new tags & correspondents"
            hint="Let the AI create tags/correspondents that don't exist yet. When off, only existing ones are applied."
            checked={form.createNewTags}
            onCheckedChange={(v) => set('createNewTags', v)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pollInterval">Poll interval (seconds)</Label>
              <Input
                id="pollInterval"
                type="number"
                min={15}
                value={form.pollIntervalSec}
                onChange={(e) => set('pollIntervalSec', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Output language</Label>
              <Input
                id="language"
                placeholder="auto"
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blacklist">Correspondent blacklist</Label>
            <Textarea
              id="blacklist"
              placeholder={'One name per line\nNever assigned or created as a correspondent'}
              value={blacklistText}
              onChange={(e) => {
                setBlacklistText(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-500" />
            Saved
          </span>
        )}
        {save.isError && (
          <span className="text-sm text-destructive">
            {save.error instanceof Error ? save.error.message : 'Save failed'}
          </span>
        )}
        <Button onClick={onSave} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </>
  );
}
