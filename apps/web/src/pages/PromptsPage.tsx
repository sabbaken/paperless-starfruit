import { useEffect, useRef, useState } from 'react';
import {
  FlaskConical,
  Loader2,
  type LucideIcon,
  RotateCcw,
  ScanText,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  PROMPT_KEY,
  type PromptConfig,
  type PromptKey,
  type PromptTestResult,
} from '@paperless-starfruit/shared';
import {
  usePrompts,
  useResetPrompt,
  useTestDocuments,
  useTestPrompt,
  useUpdatePrompt,
} from '@/api/prompts';
import { cn } from '@/lib/utils';
import { toastSave } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const ICONS: Record<PromptKey, LucideIcon> = {
  [PROMPT_KEY.EXTRACTION]: Wand2,
  [PROMPT_KEY.OCR]: ScanText,
};

export function PromptsPage() {
  const prompts = usePrompts();
  const [selected, setSelected] = useState<PromptKey>(PROMPT_KEY.EXTRACTION);

  if (prompts.isLoading || !prompts.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  const list = prompts.data;
  const active = list.find((p) => p.key === selected) ?? list[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <PromptList list={list} selected={active.key} onSelect={setSelected} />
      {/* Key by prompt so switching prompts resets the editor's local draft. */}
      <PromptEditor key={active.key} prompt={active} />
    </div>
  );
}

function PromptList({
  list,
  selected,
  onSelect,
}: {
  list: PromptConfig[];
  selected: PromptKey;
  onSelect: (key: PromptKey) => void;
}) {
  return (
    // Horizontal pair on small screens, a quiet vertical rail on desktop — no card.
    <nav aria-label="Prompts" className="flex gap-1 lg:flex-col lg:gap-0.5 lg:pt-1">
      {list.map((p) => {
        const Icon = ICONS[p.key];
        const isActive = p.key === selected;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p.key)}
            aria-current={isActive ? 'true' : undefined}
            // Match the sidebar's active item exactly: brand-tinted background,
            // foreground text, and the icon inherits that colour (black) — not brand.
            className={cn(
              'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:flex-none',
              isActive
                ? 'bg-brand/20 text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            {p.customized && (
              <span
                title="Customised"
                aria-label="customised"
                className="size-1.5 shrink-0 rounded-full bg-brand"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function PromptEditor({ prompt }: { prompt: PromptConfig }) {
  const [body, setBody] = useState(prompt.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const update = useUpdatePrompt();
  const reset = useResetPrompt();

  // After a save the query refetches; once prompt.body matches, the editor is no
  // longer dirty. After a reset we explicitly snap the draft back to the default.
  const dirty = body !== prompt.body;
  const canReset = prompt.customized || body !== prompt.default;
  const canSave = dirty && body.trim().length > 0;

  const insertVar = (name: string) => {
    const token = `{{${name}}}`;
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    el.focus();
    // Insert through the browser's native edit pipeline: it fires `input` (so the
    // onChange below updates `body`) AND keeps the undo/redo history intact —
    // a programmatic value set would wipe the native undo stack.
    const inserted = document.execCommand('insertText', false, token);
    if (!inserted) {
      // Fallback if execCommand is unavailable; loses one undo step but works.
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      setBody(body.slice(0, start) + token + body.slice(end));
    }
  };

  const onSave = () => {
    void toastSave(update.mutateAsync({ key: prompt.key, body }));
  };

  const onReset = () => {
    void toastSave(
      reset.mutateAsync(prompt.key).then((cfg) => {
        setBody(cfg.body);
        return cfg;
      }),
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{prompt.label}</CardTitle>
          <CardDescription>{prompt.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Variables</Label>
            <p className="text-xs text-muted-foreground">
              Click to insert at the cursor. They’re replaced with each document’s values at run time.
            </p>
            <div className="flex flex-wrap gap-2">
              {prompt.variables.map((v) => (
                <Button
                  key={v.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={v.description}
                  onClick={() => insertVar(v.name)}
                  className="font-mono text-xs"
                >
                  {`{{${v.name}}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt-body">Prompt</Label>
            <Textarea
              id="prompt-body"
              ref={textareaRef}
              value={body}
              spellCheck={false}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-72 font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSave} disabled={!canSave || update.isPending}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setBody(prompt.body)}>
                Discard
              </Button>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={!canReset || reset.isPending}
                title="Replace this prompt with the built-in default"
              >
                <RotateCcw className="size-4" />
                Reset to default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TestPanel promptKey={prompt.key} body={body} />
    </div>
  );
}

function TestPanel({ promptKey, body }: { promptKey: PromptKey; body: string }) {
  const docs = useTestDocuments(true);
  const test = useTestPrompt();
  const [docId, setDocId] = useState<number | ''>('');

  // Default the picker to the most recent document once the list loads.
  useEffect(() => {
    if (docId === '' && docs.data && docs.data.length > 0) setDocId(docs.data[0].id);
  }, [docs.data, docId]);

  const onRun = () => {
    if (docId === '') return;
    test.mutate({ key: promptKey, input: { documentId: docId, body } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test on a document</CardTitle>
        <CardDescription>
          Runs the current prompt (including unsaved edits) against a real document using your
          selected model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {docs.isError ? (
          <p className="text-sm text-muted-foreground">
            Connect your paperless instance and select a model in Settings → Processing to test
            prompts.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="test-doc">Document</Label>
              <Select
                id="test-doc"
                value={docId === '' ? '' : String(docId)}
                disabled={docs.isLoading || !docs.data?.length}
                onChange={(e) => setDocId(e.target.value ? Number(e.target.value) : '')}
              >
                {docs.isLoading && <option value="">Loading…</option>}
                {!docs.isLoading && !docs.data?.length && <option value="">No documents found</option>}
                {docs.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || `Document #${d.id}`}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={onRun} disabled={docId === '' || test.isPending}>
              {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Run test
            </Button>
          </div>
        )}

        {test.isError && (
          <p className="text-sm text-destructive">
            {test.error instanceof Error ? test.error.message : 'Test failed.'}
          </p>
        )}

        {test.data && <TestResult result={test.data} promptKey={promptKey} />}
      </CardContent>
    </Card>
  );
}

function TestResult({ result, promptKey }: { result: PromptTestResult; promptKey: PromptKey }) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <span className="text-sm font-medium">Result</span>
        <Badge variant="secondary" className="ml-auto">
          {result.tokens != null ? `${result.tokens.toLocaleString()} tokens` : 'page-billed'}
        </Badge>
      </div>

      {promptKey === PROMPT_KEY.EXTRACTION && result.extraction ? (
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <Field label="Title" value={result.extraction.title} />
          <Field
            label="Tags"
            value={result.extraction.tags.length ? result.extraction.tags.join(', ') : '—'}
          />
          <Field label="Correspondent" value={result.extraction.correspondent ?? '—'} />
          <Field label="Date" value={result.extraction.date ?? '—'} />
        </dl>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-xs whitespace-pre-wrap">
          {result.text || '(no text returned)'}
        </pre>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground select-none">Prompt sent</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-background p-3 whitespace-pre-wrap">
          {result.rendered}
        </pre>
      </details>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium wrap-break-word">{value}</dd>
    </>
  );
}
