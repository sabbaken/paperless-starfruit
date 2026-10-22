import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Eye, EyeOff, Loader2, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import {
  CLOUD_PROVIDER_KINDS,
  PROVIDER_KIND,
  PROVIDER_KIND_META,
  type ProviderConfig,
  type ProviderKind,
} from '@paperless-starfruit/shared';
import {
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useTestProvider,
  useUpdateProvider,
} from '@/api/providers';
import { ConnectionTest } from '@/components/connection-test';
import { ProviderLogo } from '@/components/provider-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/I18nProvider';

type FormState = { mode: 'create'; kind: ProviderKind } | { mode: 'edit'; cred: ProviderConfig };

export function ApiKeysPage() {
  const { t } = useTranslation();
  const providers = useProviders();
  const [form, setForm] = useState<FormState | null>(null);
  // Keep the last form around so the dialog body stays rendered through the
  // close animation instead of collapsing the instant `form` clears.
  const lastForm = useRef<FormState | null>(null);
  if (form) lastForm.current = form;
  const shown = form ?? lastForm.current;

  if (providers.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  const list = providers.data ?? [];
  const cloudByKind = new Map(
    list.filter((p) => p.kind !== PROVIDER_KIND.OPENAI_COMPATIBLE).map((p) => [p.kind, p]),
  );
  const localCreds = list.filter((p) => p.kind === PROVIDER_KIND.OPENAI_COMPATIBLE);
  const shownKind = shown ? (shown.mode === 'edit' ? shown.cred.kind : shown.kind) : null;

  return (
    <div className="space-y-4">
      {/* One list for everything: the four cloud providers are fixed rows with
          their own Add/Edit actions; local endpoints are open-ended, so their
          "add" lives up here. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('apiKeys.encryptedNote')}</p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => setForm({ mode: 'create', kind: PROVIDER_KIND.OPENAI_COMPATIBLE })}
        >
          <Plus className="size-4" />
          {t('apiKeys.addLocalEndpoint')}
        </Button>
      </div>

      <ul className="divide-y">
        {CLOUD_PROVIDER_KINDS.map((kind) => {
          const cred = cloudByKind.get(kind);
          return (
            <li key={kind} className="flex items-center gap-3 py-3">
              <ProviderLogo kind={kind} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t(`providerKinds.${kind}.label`)}</span>
                  {cred && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-500" />
                      {t('apiKeys.connected')}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t(`providerKinds.${kind}.description`)}
                </p>
              </div>
              {cred ? (
                <RowActions onEdit={() => setForm({ mode: 'edit', cred })} providerId={cred.id} />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({ mode: 'create', kind })}
                >
                  <Plus className="size-4" />
                  {t('apiKeys.addKey')}
                </Button>
              )}
            </li>
          );
        })}
        {localCreds.map((cred) => (
          <li key={cred.id} className="flex items-center gap-3 py-3">
            <Server className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="font-medium">{cred.name}</span>
              <p className="truncate font-mono text-xs text-muted-foreground">{cred.baseUrl}</p>
            </div>
            <RowActions onEdit={() => setForm({ mode: 'edit', cred })} providerId={cred.id} />
          </li>
        ))}
      </ul>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {shown && shownKind
                ? t(shown.mode === 'edit' ? 'apiKeys.dialogEdit' : 'apiKeys.dialogAdd', {
                    provider: t(`providerKinds.${shownKind}.label`),
                  })
                : ''}
            </DialogTitle>
            <DialogDescription>{t('apiKeys.encryptedNote')}</DialogDescription>
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

function RowActions({ onEdit, providerId }: { onEdit: () => void; providerId: number }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteProvider();

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => remove.mutate(providerId)}
          disabled={remove.isPending}
        >
          {remove.isPending && <Loader2 className="animate-spin" />}
          {t('common.remove')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" aria-label={t('common.edit')} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t('common.remove')}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-4" />
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
  const { t } = useTranslation();
  const editing = !!cred;
  const meta = PROVIDER_KIND_META[kind];
  const [showKey, setShowKey] = useState(false);

  const { register, handleSubmit, formState } = useForm<FormValues>({
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
      update.mutate({ id: cred.id, input: toInput(v) }, { onSuccess: onDone });
    } else {
      create.mutate(toInput(v), { onSuccess: onDone });
    }
  });
  const onTest = handleSubmit((v) => {
    test.mutate({ ...toInput(v), id: editing && cred ? cred.id : undefined });
  });
  const busy = save.isPending || test.isPending;

  return (
    <>
      <form id="credential-form" onSubmit={onSave} className="space-y-4" noValidate>
        {meta.local && (
          <div className="space-y-2">
            <Label htmlFor="name">{t('apiKeys.name')}</Label>
            <Input
              id="name"
              placeholder={t('apiKeys.namePlaceholder')}
              aria-invalid={!!formState.errors.name}
              {...register('name', { required: meta.local ? t('common.required') : false })}
            />
          </div>
        )}

        {(meta.needsBaseUrl || meta.local) && (
          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              {t('apiKeys.baseUrl')}{' '}
              <span className="font-normal text-muted-foreground">
                {meta.needsBaseUrl ? t('apiKeys.requiredHint') : t('apiKeys.optionalHint')}
              </span>
            </Label>
            <Input
              id="baseUrl"
              placeholder={t('apiKeys.baseUrlPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.baseUrl}
              {...register('baseUrl', {
                validate: (v) => !meta.needsBaseUrl || v.trim().length > 0 || t('common.required'),
              })}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="apiKey">
            {t('apiKeys.apiKey')}{' '}
            {!meta.keyRequired && (
              <span className="font-normal text-muted-foreground">{t('apiKeys.optionalHint')}</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              className="pr-9"
              placeholder={
                editing
                  ? t('apiKeys.apiKeyEditPlaceholder')
                  : t('apiKeys.apiKeyPlaceholder', { provider: t(`providerKinds.${kind}.label`) })
              }
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.apiKey}
              {...register('apiKey', {
                validate: (v) =>
                  !meta.keyRequired || editing || v.trim().length > 0 || t('common.required'),
              })}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? t('apiKeys.hideKey') : t('apiKeys.showKey')}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showKey ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
        </div>

        <ConnectionTest
          label={t('common.test')}
          onTest={onTest}
          pending={test.isPending}
          disabled={busy}
          error={
            test.error?.message ??
            (test.data && !test.data.ok ? (test.data.error ?? t('apiKeys.testFailed')) : undefined)
          }
          success={
            test.data?.ok
              ? test.data.latencyMs != null
                ? t('apiKeys.reachableWithLatency', { latency: test.data.latencyMs })
                : t('apiKeys.reachable')
              : undefined
          }
        />
        {save.error && (
          <p role="alert" className="text-sm text-destructive">
            {save.error.message}
          </p>
        )}
      </form>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="credential-form" disabled={busy}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {editing ? t('common.save') : t('apiKeys.addKey')}
        </Button>
      </div>
    </>
  );
}
