import {useRef, useState} from 'react';
import {useForm} from 'react-hook-form';
import {CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Server, Trash2, XCircle,} from 'lucide-react';
import {
  CLOUD_PROVIDER_KINDS,
  PROVIDER_KIND,
  PROVIDER_KIND_META,
  type ProviderConfig,
  type ProviderKind,
  type ProviderTestResult,
} from '@paperless-ai/shared';
import {useCreateProvider, useDeleteProvider, useProviders, useTestProvider, useUpdateProvider,} from '@/api/providers';
import {cn} from '@/lib/utils';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from '@/components/ui/dialog';
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';

type FormState = { mode: 'create'; kind: ProviderKind } | { mode: 'edit'; cred: ProviderConfig };

export function ApiKeysPage() {
  const providers = useProviders();
  const [form, setForm] = useState<FormState | null>(null);
  // Keep the last form around so the dialog body stays rendered through the
  // close animation instead of collapsing the instant `form` clears.
  const lastForm = useRef<FormState | null>(null);
  if (form) lastForm.current = form;
  const shown = form ?? lastForm.current;

  if (providers.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground"/>;
  }

  const list = providers.data ?? [];
  const cloudByKind = new Map(list.filter((p) => p.kind !== PROVIDER_KIND.OPENAI_COMPATIBLE).map((p) => [p.kind, p]));
  const localCreds = list.filter((p) => p.kind === PROVIDER_KIND.OPENAI_COMPATIBLE);
  const shownKind = shown ? (shown.mode === 'edit' ? shown.cred.kind : shown.kind) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cloud providers</CardTitle>
          <CardDescription>
            Keys are encrypted at rest and never returned to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {CLOUD_PROVIDER_KINDS.map((kind) => {
              const cred = cloudByKind.get(kind);
              const meta = PROVIDER_KIND_META[kind];
              return (
                <li key={kind} className="flex items-center gap-3 py-3">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground"/>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {cred && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-500"/>
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  {cred ? (
                    <RowActions
                      onEdit={() => setForm({mode: 'edit', cred})}
                      providerId={cred.id}
                    />
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setForm({mode: 'create', kind})}>
                      <Plus className="size-4"/>
                      Add key
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Local &amp; OpenAI-compatible</CardTitle>
          {localCreds.length !== 0 && <Button
            size="sm"
            variant="outline"
            onClick={() => setForm({mode: 'create', kind: PROVIDER_KIND.OPENAI_COMPATIBLE})}
          >
            <Plus className="size-4"/>
            Add endpoint
          </Button>}
        </CardHeader>
        <CardContent>
          {localCreds.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Server />
                </EmptyMedia>
                <EmptyTitle>No local endpoints</EmptyTitle>
                <EmptyDescription>
                  Add Ollama, LM Studio, vLLM or any OpenAI-compatible server.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({mode: 'create', kind: PROVIDER_KIND.OPENAI_COMPATIBLE})}
                >
                  <Plus className="size-4" />
                  Add endpoint
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="divide-y">
              {localCreds.map((cred) => (
                <li key={cred.id} className="flex items-center gap-3 py-3">
                  <Server className="size-4 shrink-0 text-muted-foreground"/>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{cred.name}</span>
                    <p className="truncate font-mono text-xs text-muted-foreground">{cred.baseUrl}</p>
                  </div>
                  <RowActions onEdit={() => setForm({mode: 'edit', cred})} providerId={cred.id}/>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {shown && shownKind
                ? `${shown.mode === 'edit' ? 'Edit' : 'Add'} ${PROVIDER_KIND_META[shownKind].label}`
                : ''}
            </DialogTitle>
            <DialogDescription>
              Keys are encrypted at rest and never returned to the browser.
            </DialogDescription>
          </DialogHeader>
          {shown && shownKind && (
            <CredentialForm
              key={shown.mode === 'edit' ? shown.cred.id : shown.kind}
              kind={shownKind}
              cred={shown.mode === 'edit' ? shown.cred : undefined}
              onDone={() => setForm(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowActions({onEdit, providerId}: { onEdit: () => void; providerId: number }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteProvider();

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="destructive" onClick={() => remove.mutate(providerId)} disabled={remove.isPending}>
          {remove.isPending && <Loader2 className="animate-spin"/>}
          Remove
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" aria-label="Edit" onClick={onEdit}>
        <Pencil className="size-4"/>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Remove"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4"/>
      </Button>
    </div>
  );
}

interface FormValues {
  name: string;
  baseUrl: string;
  apiKey: string;
}

function CredentialForm({
                          kind,
                          cred,
                          onDone,
                        }: {
  kind: ProviderKind;
  cred?: ProviderConfig;
  onDone: () => void;
}) {
  const editing = !!cred;
  const meta = PROVIDER_KIND_META[kind];
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);

  const {register, handleSubmit, formState} = useForm<FormValues>({
    defaultValues: {
      name: cred?.name ?? '',
      baseUrl: cred?.baseUrl ?? '',
      apiKey: '',
    },
  });

  const create = useCreateProvider();
  const update = useUpdateProvider();
  const test = useTestProvider();
  const save = editing ? update : create;

  const toInput = (v: FormValues) => ({
    name: meta.local ? v.name.trim() : meta.label,
    kind,
    baseUrl: v.baseUrl.trim() || undefined,
    apiKey: v.apiKey.trim() || undefined,
  });

  const onSave = handleSubmit((v) => {
    if (editing && cred) {
      update.mutate({id: cred.id, input: toInput(v)}, {onSuccess: onDone});
    } else {
      create.mutate(toInput(v), {onSuccess: onDone});
    }
  });
  const onTest = handleSubmit((v) => {
    setTestResult(null);
    test.mutate(
      {...toInput(v), id: editing && cred ? cred.id : undefined},
      {onSuccess: (r) => setTestResult(r)},
    );
  });
  const busy = save.isPending || test.isPending;

  return (
    <>
      <form id="credential-form" onSubmit={onSave} className="space-y-4" noValidate>
        {meta.local && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Ollama (laptop)"
              aria-invalid={!!formState.errors.name}
              {...register('name', {required: meta.local ? 'Required' : false})}
            />
          </div>
        )}

        {(meta.needsBaseUrl || meta.local) && (
          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              Base URL{' '}
              <span className="font-normal text-muted-foreground">
                  {meta.needsBaseUrl ? '(required)' : '(optional)'}
                </span>
            </Label>
            <Input
              id="baseUrl"
              placeholder="http://localhost:11434/v1"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.baseUrl}
              {...register('baseUrl', {
                validate: (v) => !meta.needsBaseUrl || v.trim().length > 0 || 'Required',
              })}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="apiKey">
            API key{' '}
            {!meta.keyRequired && <span className="font-normal text-muted-foreground">(optional)</span>}
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              className="pr-9"
              placeholder={editing ? 'leave blank to keep current key' : `${meta.label} API key`}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.apiKey}
              {...register('apiKey', {
                validate: (v) =>
                  !meta.keyRequired || editing || v.trim().length > 0 || 'Required',
              })}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showKey ? <Eye className="size-4"/> : <EyeOff className="size-4"/>}
            </button>
          </div>
        </div>

        <TestLine pending={test.isPending} result={testResult} error={test.error} saveError={save.error}/>
      </form>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={onTest} disabled={busy}>
          {test.isPending && <Loader2 className="animate-spin"/>}
          Test
        </Button>
        <Button type="submit" form="credential-form" disabled={busy}>
          {save.isPending && <Loader2 className="animate-spin"/>}
          {editing ? 'Save' : 'Add key'}
        </Button>
      </div>
    </>
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
  let tone: 'probing' | 'ok' | 'fault' | null = null;
  let text = '';
  if (saveError) {
    tone = 'fault';
    text = saveError.message;
  } else if (pending) {
    tone = 'probing';
    text = 'Contacting provider…';
  } else if (error) {
    tone = 'fault';
    text = error.message;
  } else if (result?.ok) {
    tone = 'ok';
    text = `Reachable${result.latencyMs != null ? ` · ${result.latencyMs} ms` : ''}`;
  } else if (result && !result.ok) {
    tone = 'fault';
    text = result.error ?? 'Test failed.';
  }
  if (!tone) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm',
        tone === 'fault' && 'border-destructive/40 bg-destructive/5 text-destructive',
      )}
    >
      {tone === 'probing' ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground"/>
      ) : tone === 'ok' ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500"/>
      ) : (
        <XCircle className="size-4 shrink-0 text-destructive"/>
      )}
      <span className="truncate">{text}</span>
    </div>
  );
}
