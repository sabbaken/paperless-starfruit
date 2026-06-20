import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, ChevronDown, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import {
  paperlessConnectionInputSchema,
  type ConnectionStatus,
  type ConnectionTestResult,
  type PaperlessConnectionInput,
} from '@paperless-ai/shared';
import { useConnection, useDisconnect, useSaveConnection, useTestConnection } from '@/api/connection';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tone = 'standby' | 'probing' | 'online' | 'connected' | 'fault';

export function ConnectionPage() {
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

  const result = computeStatus({
    status,
    testPending: test.isPending,
    savePending: save.isPending,
    testResult: test.data,
    testError: test.error,
    saveError: save.error,
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Connect paperless</CardTitle>
          {connected && <Badge variant="secondary">Connected</Badge>}
        </div>
        <CardDescription>
          Point Paperless AI at your paperless-ngx instance. Access is verified with a
          read-only test before anything is stored; the token is encrypted at rest.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form id="connect-form" onSubmit={onSave} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Paperless URL</Label>
            <Input
              id="baseUrl"
              placeholder="https://paperless.home.lan"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!formState.errors.baseUrl}
              {...register('baseUrl')}
            />
            {formState.errors.baseUrl && (
              <p className="text-sm text-destructive">{formState.errors.baseUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">API token</Label>
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
                {showToken ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
            {formState.errors.token && (
              <p className="text-sm text-destructive">{formState.errors.token.message}</p>
            )}
          </div>

          <StatusLine tone={result.tone} message={result.message} />

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
                <p className="text-sm text-destructive">
                  {formState.errors.apiVersion.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Leave blank to detect the server&apos;s API version automatically.
                </p>
              )}
            </div>
          </details>
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-2">
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
        {connected && (
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
      </CardFooter>
    </Card>
  );
}

function StatusLine({ tone, message }: { tone: Tone; message: string }) {
  const icon =
    tone === 'probing' ? (
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
    ) : tone === 'online' || tone === 'connected' ? (
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
    ) : tone === 'fault' ? (
      <XCircle className="size-4 shrink-0 text-destructive" />
    ) : (
      <span className="size-2 shrink-0 rounded-full bg-muted-foreground/60" />
    );

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm',
        tone === 'fault' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      {icon}
      <span className={cn('truncate', tone === 'fault' ? 'text-destructive' : 'text-foreground')}>
        {message}
      </span>
    </div>
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
}): { tone: Tone; message: string } {
  if (testPending) return { tone: 'probing', message: 'Contacting paperless…' };
  if (savePending) return { tone: 'probing', message: 'Verifying & storing…' };

  if (saveError) return { tone: 'fault', message: saveError.message };
  if (testError) return { tone: 'fault', message: testError.message };
  if (testResult && !testResult.ok) {
    return { tone: 'fault', message: testResult.error ?? 'Connection failed.' };
  }
  if (testResult?.ok) {
    return { tone: 'online', message: describeProbe(testResult.documentCount, testResult.version) };
  }
  if (status.connected) return { tone: 'connected', message: status.baseUrl };
  return { tone: 'standby', message: 'Not connected yet — run a test to verify access.' };
}

function describeProbe(count: number | undefined, version: string | undefined): string {
  const docs = count === undefined ? 'Reachable' : `${count.toLocaleString()} documents`;
  return version ? `${docs} · paperless ${version}` : docs;
}
