import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, CheckCircle2, ChevronRight, Loader2, ScanText } from 'lucide-react';
import type { ProviderConfig, Settings } from '@paperless-ai/shared';
import { providerApi, settingsApi } from '../lib/api';
import { ModelPicker } from '../components/model-picker';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';

export function ProcessingSettings({ onGoToProviders }: { onGoToProviders: () => void }) {
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const providers = useQuery({ queryKey: ['providers'], queryFn: providerApi.list });

  if (settings.isLoading || providers.isLoading || !settings.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-6">
      <ModelsCard
        settings={settings.data}
        providers={providers.data ?? []}
        onGoToProviders={onGoToProviders}
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
  const queryClient = useQueryClient();
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  const update = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

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
        <ModelRow
          icon={<Brain className="size-4" />}
          label="Language model"
          hint="Extracts title, tags, correspondent and date."
          value={describe(settings.llmProviderId, settings.llmModel)}
          onClick={() => setPicker('llm')}
        />
        <ModelRow
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

function ModelRow({
  icon,
  label,
  hint,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string | null;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className={value ? 'truncate font-mono text-xs' : 'text-xs text-muted-foreground'}>
        {value ?? 'Not set'}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ProcessingForm({ initial }: { initial: Settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>(initial);
  const [blacklistText, setBlacklistText] = useState(initial.correspondentBlacklist.join('\n'));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const save = useMutation({
    mutationFn: () =>
      settingsApi.update({
        pollIntervalSec: form.pollIntervalSec,
        autoApply: form.autoApply,
        createNewTags: form.createNewTags,
        language: form.language.trim() || 'auto',
        correspondentBlacklist: blacklistText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (updated) => {
      setForm((f) => ({ ...f, ...updated }));
      setBlacklistText(updated.correspondentBlacklist.join('\n'));
      setDirty(false);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
          <CardDescription>How documents are picked up and enriched.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            label="Auto-apply suggestions"
            hint="Apply AI suggestions immediately instead of queueing them for review. Documents tagged ai-process-auto always auto-apply."
            checked={form.autoApply}
            onChange={(v) => set('autoApply', v)}
          />
          <ToggleRow
            label="Create new tags & correspondents"
            hint="Let the AI create tags/correspondents that don't exist yet. When off, only existing ones are applied."
            checked={form.createNewTags}
            onChange={(v) => set('createNewTags', v)}
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
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
