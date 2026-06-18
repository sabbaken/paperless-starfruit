import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  paperlessConnectionInputSchema,
  type ConnectionStatus,
  type ConnectionTestResult,
  type PaperlessConnectionInput,
} from '@paperless-ai/shared';
import { connectionApi } from '../lib/api';
import { cn } from '../lib/cn';
import { Button, Field, TextInput } from '../components/ui';

type Tone = 'standby' | 'probing' | 'online' | 'fault' | 'connected';

const TONE: Record<Tone, { dot: string; text: string; rail: string; label: string }> = {
  standby: { dot: 'bg-warn', text: 'text-warn', rail: 'border-warn/60', label: 'STANDBY' },
  probing: { dot: 'bg-warn', text: 'text-warn', rail: 'border-warn/60', label: 'PROBING' },
  online: { dot: 'bg-signal', text: 'text-signal', rail: 'border-signal/60', label: 'ONLINE' },
  connected: {
    dot: 'bg-signal',
    text: 'text-signal',
    rail: 'border-signal/60',
    label: 'CONNECTED',
  },
  fault: { dot: 'bg-alert', text: 'text-alert', rail: 'border-alert/60', label: 'FAULT' },
};

export function ConnectScreen({ status }: { status: ConnectionStatus }) {
  const queryClient = useQueryClient();
  const connected = status.connected;

  const form = useForm<PaperlessConnectionInput>({
    resolver: zodResolver(paperlessConnectionInputSchema),
    defaultValues: { baseUrl: '', token: '', apiVersion: undefined },
  });
  const { register, handleSubmit, reset, formState } = form;

  // Prefill from the stored connection once it loads; token is never returned,
  // so it stays blank and must be re-entered to save changes.
  useEffect(() => {
    if (status.connected) {
      reset({ baseUrl: status.baseUrl, token: '', apiVersion: status.apiVersion });
    }
  }, [status, reset]);

  const test = useMutation({ mutationFn: connectionApi.test });
  const save = useMutation({
    mutationFn: connectionApi.save,
    onSuccess: () => {
      // Clear any prior Test result so it can't outrank the freshly-saved
      // CONNECTED state in the readout (computeReadout checks test before status).
      test.reset();
      void queryClient.invalidateQueries({ queryKey: ['connection'] });
      form.resetField('token');
    },
  });
  const disconnect = useMutation({
    mutationFn: connectionApi.remove,
    onSuccess: () => {
      test.reset();
      save.reset();
      reset({ baseUrl: '', token: '', apiVersion: undefined });
      void queryClient.invalidateQueries({ queryKey: ['connection'] });
    },
  });

  const onTest = handleSubmit((values) => test.mutate(values));
  const onSave = handleSubmit((values) => save.mutate(values));

  const readout = computeReadout({
    status,
    testPending: test.isPending,
    savePending: save.isPending,
    testResult: test.data,
    testError: test.error,
    saveError: save.error,
  });
  const [showToken, setShowToken] = useState(false);
  const busy = test.isPending || save.isPending || disconnect.isPending;

  return (
    <div className="w-full max-w-xl">
      <div className="overflow-hidden rounded-xl border border-line bg-ink-900 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-signal/60 to-transparent" />

        <div className="space-y-7 p-7 sm:p-9">
          <header className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint">
                <span className="inline-block h-1.5 w-1.5 bg-signal" />
                paperless·ai
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint">
                setup · 01 connect
              </span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-paper">
              Connect your archive
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-paper-dim">
              Point Paperless AI at your paperless-ngx instance and verify access with a
              read-only test before anything is stored. The token is encrypted at rest.
            </p>
          </header>

          <form onSubmit={onSave} className="space-y-5" noValidate>
            <Field
              label="paperless URL"
              htmlFor="baseUrl"
              hint="incl. http(s)://"
              error={formState.errors.baseUrl?.message}
            >
              <TextInput
                id="baseUrl"
                placeholder="https://paperless.home.lan"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!formState.errors.baseUrl}
                {...register('baseUrl')}
              />
            </Field>

            <Field
              label="API token"
              htmlFor="token"
              hint={
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="uppercase tracking-[0.18em] transition-colors hover:text-paper-dim"
                >
                  {showToken ? 'hide' : 'reveal'}
                </button>
              }
              error={formState.errors.token?.message}
            >
              <TextInput
                id="token"
                type={showToken ? 'text' : 'password'}
                placeholder={connected ? 're-enter to update' : 'paperless API token'}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!formState.errors.token}
                {...register('token')}
              />
            </Field>

            <details className="group">
              <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.18em] text-paper-faint transition-colors hover:text-paper-dim">
                <span className="group-open:hidden">+ advanced</span>
                <span className="hidden group-open:inline">− advanced</span>
              </summary>
              <div className="pt-4">
                <Field
                  label="API version"
                  htmlFor="apiVersion"
                  hint="blank = auto-detect"
                  error={formState.errors.apiVersion?.message}
                >
                  <TextInput
                    id="apiVersion"
                    type="number"
                    min={1}
                    placeholder="auto"
                    className="max-w-28"
                    aria-invalid={!!formState.errors.apiVersion}
                    {...register('apiVersion', {
                      // Empty/blank/non-numeric -> undefined (auto-detect) rather
                      // than NaN, which would fail validation silently.
                      setValueAs: (v) => {
                        if (v === '' || v == null) return undefined;
                        const n = Number(v);
                        return Number.isNaN(n) ? undefined : n;
                      },
                    })}
                  />
                </Field>
              </div>
            </details>

            <ReadoutStrip {...readout} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={onTest}
                disabled={busy}
                className="sm:flex-1"
              >
                {test.isPending ? 'Testing…' : 'Test connection'}
              </Button>
              <Button type="submit" disabled={busy} className="sm:flex-1">
                {save.isPending ? 'Saving…' : connected ? 'Save changes' : 'Save & continue'}
              </Button>
            </div>
          </form>

          <footer className="flex items-center justify-between border-t border-line pt-5">
            <span className="font-mono text-[11px] text-paper-faint">
              {connected ? 'Providers configured next.' : 'Step 1 of onboarding.'}
            </span>
            {connected && (
              <button
                type="button"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-faint transition-colors hover:text-alert disabled:opacity-40"
              >
                {disconnect.isPending ? 'disconnecting…' : 'disconnect'}
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

function ReadoutStrip({ tone, detail }: { tone: Tone; detail: string }) {
  const t = TONE[tone];
  return (
    <div className={cn('flex items-center gap-3 rounded-md border-l-2 bg-ink-950 px-4 py-3', t.rail)}>
      <span
        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', t.dot, tone === 'probing' && 'animate-pulse')}
      />
      <span className={cn('font-mono text-xs font-semibold tracking-[0.18em]', t.text)}>
        {t.label}
      </span>
      <span className="truncate font-mono text-xs text-paper-dim">{detail}</span>
    </div>
  );
}

function computeReadout({
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
}): { tone: Tone; detail: string } {
  if (testPending) return { tone: 'probing', detail: 'contacting paperless…' };
  if (savePending) return { tone: 'probing', detail: 'verifying & storing…' };

  if (saveError) return { tone: 'fault', detail: saveError.message };
  // A non-2xx from our own API (500, proxy/network failure) rejects the test
  // mutation rather than returning { ok:false }; surface it like the save path.
  if (testError) return { tone: 'fault', detail: testError.message };
  if (testResult && !testResult.ok) {
    return { tone: 'fault', detail: testResult.error ?? 'connection failed' };
  }
  if (testResult?.ok) {
    return { tone: 'online', detail: describeProbe(testResult.documentCount, testResult.version) };
  }
  if (status.connected) return { tone: 'connected', detail: status.baseUrl };
  return { tone: 'standby', detail: 'Run a test to verify access.' };
}

function describeProbe(count: number | undefined, version: string | undefined): string {
  const docs = count === undefined ? 'reachable' : `${count.toLocaleString()} documents`;
  return version ? `${docs} · v${version}` : docs;
}
