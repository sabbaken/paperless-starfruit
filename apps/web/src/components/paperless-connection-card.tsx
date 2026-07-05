import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  paperlessConnectionInputSchema,
  type ConnectionStatus,
  type ConnectionTestResult,
  type PaperlessConnectionInput,
} from '@paperless-starfruit/shared';
import {
  useConnection,
  useDisconnect,
  useSaveConnection,
  useTestConnection,
} from '@/api/connection';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Where paperless-ngx documents how to mint an API token. */
const TOKEN_DOCS_URL = 'https://docs.paperless-ngx.com/api/#authorization';

type Tone = 'idle' | 'probing' | 'success' | 'connected' | 'fault';
interface StatusView {
  tone: Tone;
  title: string;
  detail?: string;
}

export interface PaperlessConnectionCardProps {
  className?: string;
  /**
   * Called after the connection is successfully saved — e.g. so an onboarding
   * flow can advance to the next step. The card itself stays mounted.
   */
  onConnected?: () => void;
}

/** The settings-page presentation: the bare form wrapped in card chrome. */
export function PaperlessConnectionCard({ className, onConnected }: PaperlessConnectionCardProps) {
  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader>
        <CardTitle>Connect paperless</CardTitle>
        <CardDescription>
          Read-only access, verified before saving. The token is encrypted at rest.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PaperlessConnectionForm onConnected={onConnected} showDisconnect />
      </CardContent>
    </Card>
  );
}

export interface PaperlessConnectionFormProps {
  className?: string;
  /** Called after the connection is successfully saved. */
  onConnected?: () => void;
  /** Offer disconnect when connected — wanted in settings, not in onboarding. */
  showDisconnect?: boolean;
}

/**
 * Self-contained paperless-ngx connection form: URL + token, a read-only test,
 * and save — with live status feedback. Owns its own data (react-query), so it
 * drops straight into the settings card or the onboarding flow unchanged.
 */
export function PaperlessConnectionForm({
  className,
  onConnected,
  showDisconnect = false,
}: PaperlessConnectionFormProps) {
  const connection = useConnection();
  const status = connection.data;

  const form = useForm<PaperlessConnectionInput>({
    resolver: zodResolver(paperlessConnectionInputSchema),
    defaultValues: { baseUrl: '', token: '', apiVersion: undefined },
  });
  const { register, handleSubmit, reset, formState } = form;

  // Prefill from the stored connection once it loads; token is never returned,
  // so it stays blank and must be re-entered to save changes.
  useEffect(() => {
    if (status?.connected) {
      reset({ baseUrl: status.baseUrl, token: '', apiVersion: status.apiVersion });
    }
  }, [status, reset]);

  const test = useTestConnection();
  const save = useSaveConnection();
  const disconnect = useDisconnect();

  const onTest = handleSubmit((values) => test.mutate(values));
  const onSave = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        // Clear any prior Test result so it can't outrank the freshly-saved state.
        test.reset();
        form.resetField('token');
        onConnected?.();
      },
    }),
  );
  const onDisconnect = () =>
    disconnect.mutate(undefined, {
      onSuccess: () => {
        test.reset();
        save.reset();
        reset({ baseUrl: '', token: '', apiVersion: undefined });
      },
    });

  const busy = test.isPending || save.isPending || disconnect.isPending;
  const [showToken, setShowToken] = useState(false);

  if (!status) return null;
  const connected = status.connected;

  const view = computeStatus({
    status,
    testPending: test.isPending,
    savePending: save.isPending,
    testResult: test.data,
    testError: test.error,
    saveError: save.error,
  });

  return (
    <div className={cn('w-full', className)}>
      <form id="connect-form" onSubmit={onSave} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="baseUrl">paperless-ngx URL</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
            <Input
              id="baseUrl"
              className="pl-9"
              placeholder="https://paperless.home.lan"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.baseUrl}
              {...register('baseUrl')}
            />
          </div>
          {formState.errors.baseUrl && (
            <p className="text-sm text-destructive">{formState.errors.baseUrl.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="token">API token</Label>
            <a
              href={TOKEN_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              tabIndex={-1}
              className="inline-flex items-center gap-0.5 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-500"
            >
              Where to get it?
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="relative">
            <Input
              id="token"
              type={showToken ? 'text' : 'password'}
              className="pr-9"
              placeholder={connected ? 're-enter to update' : 'paperless API token'}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.token}
              {...register('token')}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formState.errors.token && (
            <p className="text-sm text-destructive">{formState.errors.token.message}</p>
          )}
        </div>

        <ConnectionStatusAlert view={view} />

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            Advanced
          </summary>
          <div className="space-y-2 pt-3">
            <Label htmlFor="apiVersion">API version</Label>
            <Input
              id="apiVersion"
              type="number"
              min={1}
              placeholder="auto-detect"
              className="max-w-32"
              aria-invalid={!!formState.errors.apiVersion}
              {...register('apiVersion', {
                // Empty/blank/non-numeric -> undefined (auto-detect from the
                // server) rather than NaN, which would fail validation silently.
                setValueAs: (v) => {
                  if (v === '' || v == null) return undefined;
                  const n = Number(v);
                  return Number.isNaN(n) ? undefined : n;
                },
              })}
            />
            {formState.errors.apiVersion ? (
              <p className="text-sm text-destructive">{formState.errors.apiVersion.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave blank to detect the server&apos;s API version automatically.
              </p>
            )}
          </div>
        </details>
      </form>

      <div className="mt-5 flex flex-col gap-2">
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onTest}
            disabled={busy}
          >
            {test.isPending && <Loader2 className="animate-spin" />}
            Test connection
          </Button>
          <Button type="submit" form="connect-form" className="flex-1" disabled={busy}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {connected ? 'Save changes' : 'Save & continue'}
          </Button>
        </div>
        {showDisconnect && connected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onDisconnect}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending && <Loader2 className="animate-spin" />}
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionStatusAlert({ view }: { view: StatusView }) {
  if (view.tone === 'idle') return null;

  if (view.tone === 'probing') {
    return (
      <Alert className="bg-muted/40">
        <Loader2 className="animate-spin text-muted-foreground" />
        <AlertTitle>{view.title}</AlertTitle>
      </Alert>
    );
  }

  if (view.tone === 'fault') {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{view.title}</AlertTitle>
        {view.detail && <AlertDescription>{view.detail}</AlertDescription>}
      </Alert>
    );
  }

  return (
    <Alert variant="success">
      <CheckCircle2 />
      <AlertTitle>{view.title}</AlertTitle>
      {view.detail && <AlertDescription>{view.detail}</AlertDescription>}
    </Alert>
  );
}

function computeStatus({
  status,
  testPending,
  savePending,
  testResult,
  testError,
  saveError,
}: {
  status: ConnectionStatus;
  testPending: boolean;
  savePending: boolean;
  testResult: ConnectionTestResult | undefined;
  testError: Error | null;
  saveError: Error | null;
}): StatusView {
  if (testPending) return { tone: 'probing', title: 'Checking server access…' };
  if (savePending) return { tone: 'probing', title: 'Verifying & storing…' };

  if (saveError) return { tone: 'fault', title: "Couldn't connect", detail: saveError.message };
  if (testError) return { tone: 'fault', title: "Couldn't connect", detail: testError.message };
  if (testResult && !testResult.ok) {
    return {
      tone: 'fault',
      title: "Couldn't connect",
      detail: testResult.error ?? 'The instance rejected the request.',
    };
  }
  if (testResult?.ok) {
    return {
      tone: 'success',
      title: 'Connection verified',
      detail: describeProbe(testResult.documentCount, testResult.version),
    };
  }
  if (status.connected) return { tone: 'connected', title: 'Connected', detail: status.baseUrl };
  return { tone: 'idle', title: '' };
}

function describeProbe(count: number | undefined, version: string | undefined): string {
  const parts: string[] = [];
  if (version) parts.push(`paperless-ngx ${version}`);
  if (count !== undefined) parts.push(`${count.toLocaleString()} documents`);
  parts.push('checked just now');
  return parts.join(' · ');
}
