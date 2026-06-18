import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  PROVIDER_KIND,
  type ProviderConfig,
  type ProviderKind,
  type ProviderTestResult,
} from '@paperless-ai/shared';
import { providerApi } from '../lib/api';
import { cn } from '../lib/cn';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';

interface KindOption {
  value: ProviderKind;
  label: string;
  modelHint: string;
  needsBaseUrl: boolean;
}

const KIND_OPTIONS: KindOption[] = [
  { value: PROVIDER_KIND.ANTHROPIC, label: 'Anthropic (Claude)', modelHint: 'claude-haiku-4-5', needsBaseUrl: false },
  { value: PROVIDER_KIND.OPENAI, label: 'OpenAI', modelHint: 'gpt-4o-mini', needsBaseUrl: false },
  { value: PROVIDER_KIND.GOOGLE, label: 'Google (Gemini)', modelHint: 'gemini-2.0-flash', needsBaseUrl: false },
  { value: PROVIDER_KIND.MISTRAL, label: 'Mistral', modelHint: 'mistral-small-latest', needsBaseUrl: false },
  {
    value: PROVIDER_KIND.OPENAI_COMPATIBLE,
    label: 'OpenAI-compatible (Ollama, vLLM, …)',
    modelHint: 'llama3.1',
    needsBaseUrl: true,
  },
];

const kindLabel = (kind: string) =>
  KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;

export function ProvidersScreen() {
  const providers = useQuery({ queryKey: ['providers'], queryFn: providerApi.list });
  const [form, setForm] = useState<{ mode: 'new' } | { mode: 'edit'; provider: ProviderConfig } | null>(
    null,
  );

  if (providers.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  if (form) {
    return (
      <ProviderForm
        key={form.mode === 'edit' ? form.provider.id : 'new'}
        provider={form.mode === 'edit' ? form.provider : undefined}
        onDone={() => setForm(null)}
      />
    );
  }

  const list = providers.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          AI providers the pipeline can use to read and enrich your documents.
        </p>
        <Button size="sm" onClick={() => setForm({ mode: 'new' })}>
          <Plus className="size-4" />
          Add provider
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No providers yet</CardTitle>
            <CardDescription>
              Add an LLM provider (Anthropic, OpenAI, a local OpenAI-compatible endpoint, …)
              and its API key to start extracting metadata.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setForm({ mode: 'new' })}>
              <Plus className="size-4" />
              Add your first provider
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <ProviderRow key={p.id} provider={p} onEdit={() => setForm({ mode: 'edit', provider: p })} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProviderRow({ provider, onEdit }: { provider: ProviderConfig; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => providerApi.remove(provider.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers'] }),
  });

  return (
    <li className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{provider.name}</span>
          <Badge variant="secondary">{kindLabel(provider.kind)}</Badge>
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {provider.model}
          {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
        </p>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <Button size="sm" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending && <Loader2 className="animate-spin" />}
            Yes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            No
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Edit" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

interface FormValues {
  name: string;
  kind: ProviderKind;
  model: string;
  baseUrl: string;
  apiKey: string;
}

function ProviderForm({ provider, onDone }: { provider?: ProviderConfig; onDone: () => void }) {
  const editing = !!provider;
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  const { register, handleSubmit, watch, formState } = useForm<FormValues>({
    defaultValues: {
      name: provider?.name ?? '',
      kind: provider?.kind ?? PROVIDER_KIND.ANTHROPIC,
      model: provider?.model ?? '',
      baseUrl: provider?.baseUrl ?? '',
      apiKey: '',
    },
  });

  const kind = watch('kind');
  const kindOption = KIND_OPTIONS.find((k) => k.value === kind) ?? KIND_OPTIONS[0];

  const toInput = (v: FormValues) => ({
    name: v.name.trim(),
    kind: v.kind,
    model: v.model.trim(),
    baseUrl: v.baseUrl.trim() || undefined,
    apiKey: v.apiKey.trim() || undefined,
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const input = toInput(v);
      if (editing) return providerApi.update(provider.id, input);
      // create requires a key
      return providerApi.create({ ...input, apiKey: input.apiKey ?? '' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
      onDone();
    },
  });

  const test = useMutation({
    mutationFn: (v: FormValues) => {
      const input = toInput(v);
      return providerApi.test({
        ...input,
        id: editing ? provider.id : undefined,
      });
    },
    onSuccess: (r) => setTestResult(r),
  });

  const onSave = handleSubmit((v) => save.mutate(v));
  const onTest = handleSubmit((v) => {
    setTestResult(null);
    test.mutate(v);
  });
  const busy = save.isPending || test.isPending;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{editing ? 'Edit provider' : 'Add provider'}</CardTitle>
        <CardDescription>
          Keys are encrypted at rest and never returned to the browser.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="provider-form" onSubmit={onSave} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Claude key"
                aria-invalid={!!formState.errors.name}
                {...register('name', { required: 'Required' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Provider</Label>
              <Select id="kind" {...register('kind')}>
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              className="font-mono"
              placeholder={kindOption.modelHint}
              aria-invalid={!!formState.errors.model}
              {...register('model', { required: 'Required' })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              Base URL{' '}
              <span className="font-normal text-muted-foreground">
                {kindOption.needsBaseUrl ? '(required)' : '(optional)'}
              </span>
            </Label>
            <Input
              id="baseUrl"
              placeholder={kindOption.needsBaseUrl ? 'http://localhost:11434/v1' : 'leave blank for the default endpoint'}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.baseUrl}
              {...register('baseUrl', {
                validate: (v) =>
                  !kindOption.needsBaseUrl || v.trim().length > 0 || 'Required for this provider',
              })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                className="pr-9"
                placeholder={editing ? 'leave blank to keep current key' : 'provider API key'}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!formState.errors.apiKey}
                {...register('apiKey', {
                  validate: (v) => editing || v.trim().length > 0 || 'Required',
                })}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showKey ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
            {(formState.errors.name || formState.errors.model || formState.errors.apiKey || formState.errors.baseUrl) && (
              <p className="text-sm text-destructive">Fill in the required fields above.</p>
            )}
          </div>

          <TestLine pending={test.isPending} result={testResult} error={test.error} saveError={save.error} />
        </form>
      </CardContent>

      <CardFooter className="justify-between">
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onTest} disabled={busy}>
            {test.isPending && <Loader2 className="animate-spin" />}
            Test
          </Button>
          <Button type="submit" form="provider-form" disabled={busy}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {editing ? 'Save changes' : 'Add provider'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function TestLine({
  pending,
  result,
  error,
  saveError,
}: {
  pending: boolean;
  result: ProviderTestResult | null;
  error: Error | null;
  saveError: Error | null;
}) {
  if (saveError) return <Line tone="fault" text={saveError.message} />;
  if (pending) return <Line tone="probing" text="Contacting provider…" />;
  if (error) return <Line tone="fault" text={error.message} />;
  if (result?.ok) {
    return <Line tone="ok" text={`Reachable${result.latencyMs != null ? ` · ${result.latencyMs} ms` : ''}`} />;
  }
  if (result && !result.ok) return <Line tone="fault" text={result.error ?? 'Test failed.'} />;
  return null;
}

function Line({ tone, text }: { tone: 'probing' | 'ok' | 'fault'; text: string }) {
  const icon =
    tone === 'probing' ? (
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
    ) : tone === 'ok' ? (
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
    ) : (
      <XCircle className="size-4 shrink-0 text-destructive" />
    );
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm',
        tone === 'fault' && 'border-destructive/40 bg-destructive/5 text-destructive',
      )}
    >
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}
